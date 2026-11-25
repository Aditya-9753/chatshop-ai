const crypto = require("crypto");
const { DelayedError, Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const WhatsAppBillJob = require("../models/WhatsAppBillJob.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const messageService = require("./message.service");
const invoicePdf = require("../emi/services/invoicePdf.service");

const MAX_ATTEMPTS = 4;
const LEASE_MS = 60 * 1000;
const CONCURRENCY = 2;
const WORKER_ID = `${process.pid}:${crypto.randomUUID()}`;
let active = 0;
let polling = false;
let timer;
let cleanupTimer;
let stopping = false;
let bullQueue;
let bullWorker;
let bullConnection;
let bullWorkerConnection;
let reconcileTimer;
const BULL_QUEUE_NAME = "chatshop-whatsapp-bills";

function bullMode() {
  const backend = process.env.JOB_QUEUE_BACKEND || "mongodb";
  if (!["mongodb", "bullmq"].includes(backend)) {
    throw new Error("JOB_QUEUE_BACKEND must be either mongodb or bullmq");
  }
  return backend === "bullmq";
}

function createRedisConnection() {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required when JOB_QUEUE_BACKEND=bullmq");
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

function getBullQueue() {
  if (!bullQueue) {
    bullConnection = createRedisConnection();
    bullQueue = new Queue(BULL_QUEUE_NAME, { connection: bullConnection });
  }
  return bullQueue;
}

async function dispatchBullJob(job) {
  return getBullQueue().add(
    "process-bill",
    { mongoJobId: String(job._id) },
    {
      jobId: `bill-${job._id}-${job.attempts || 0}`,
      delay: Math.max(0, new Date(job.availableAt).getTime() - Date.now()),
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: true,
    },
  );
}

async function deferBullJob(job, delayMs = 500) {
  if (!job.token) throw new Error("BullMQ worker did not provide a job lock token");
  await job.moveToDelayed(Date.now() + Math.max(250, delayMs), job.token);
  throw new DelayedError();
}

async function enqueue({ tenantId, invoiceId, customerId, idempotencyKey }) {
  let job;
  try {
    job = await WhatsAppBillJob.findOneAndUpdate(
      { tenantId, idempotencyKey },
      {
        $setOnInsert: {
          tenantId,
          invoiceId,
          customerId,
          idempotencyKey,
          status: "queued",
          availableAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    job = await WhatsAppBillJob.findOne({ tenantId, idempotencyKey });
  }
  if (bullMode() && job?.status === "queued") await dispatchBullJob(job);
  return job;
}

async function claim() {
  const now = new Date();
  return WhatsAppBillJob.findOneAndUpdate(
    {
      $or: [
        { status: "queued", availableAt: { $lte: now } },
        { status: "processing", leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "processing",
        leaseOwner: WORKER_ID,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { createdAt: 1, _id: 1 } },
  );
}

async function renewLease(jobId) {
  const renewed = await WhatsAppBillJob.updateOne(
    { _id: jobId, status: "processing", leaseOwner: WORKER_ID },
    { $set: { leaseExpiresAt: new Date(Date.now() + LEASE_MS) } },
  );
  if (!renewed.matchedCount) throw new Error("WhatsApp bill worker lost its processing lease");
}

async function processJob(job) {
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    renewLease(job._id).catch((error) =>
      console.error("WhatsApp bill lease renewal failed:", error.message),
    );
  }, Math.max(1000, Math.floor(LEASE_MS / 3)));
  if (heartbeat.unref) heartbeat.unref();
  try {
    const invoiceData = await invoicePdf.loadInvoice(job.tenantId, job.invoiceId);
    const { invoice } = invoiceData;
    const customer = await Customer.findOne({
      _id: job.customerId,
      userId: job.tenantId,
    }).select("phone platform platformId isBlocked");
    if (!customer || customer.isBlocked) throw new Error("Invoice customer is unavailable or blocked");
    if (customer.platform !== "whatsapp" || !customer.phone) {
      throw new Error("Customer has no WhatsApp phone number for bill delivery");
    }

    let pdfFileId = job.pdfFileId;
    if (!pdfFileId) {
      const pdf = await invoicePdf.renderInvoicePdf(invoiceData);
      pdfFileId = await invoicePdf.storeBillPdf({
        jobId: job._id,
        tenantId: job.tenantId,
        invoiceId: invoice._id,
        buffer: pdf,
      });
      const pdfUpdate = await WhatsAppBillJob.updateOne(
        { _id: job._id, status: "processing", leaseOwner: WORKER_ID },
        { $set: { pdfFileId } },
      );
      if (!pdfUpdate.matchedCount) {
        throw new Error("WhatsApp bill worker lost its lease before saving the invoice PDF");
      }
    }

    const mediaUrl = invoicePdf.createBillSignedUrl(job._id);
    const message = await messageService.sendMessage(job.tenantId, {
      customerId: customer._id,
      platform: "whatsapp",
      type: "document",
      idempotencyKey: `whatsapp-bill:${job._id}`,
      content: {
        mediaUrl,
        fileName: `Invoice-${invoice.invoiceNo}.pdf`,
        caption: `Invoice ${invoice.invoiceNo} · ${new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2,
        }).format((Number(invoice.grossTotal) || 0) / 100)}`,
      },
    });

    if (message.status === "failed") {
      throw new Error(message.errorDetails?.message || "WhatsApp bill delivery failed");
    }
    const completion = await WhatsAppBillJob.updateOne(
      { _id: job._id, status: "processing", leaseOwner: WORKER_ID },
      {
        $set: {
          status: "completed",
          messageId: message._id,
          deleteAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        $unset: { leaseOwner: 1, leaseExpiresAt: 1, lastError: 1 },
      },
    );
    if (!completion.matchedCount) {
      throw new Error("WhatsApp bill worker lost its lease before completing the job");
    }
    console.info(`WhatsApp bill job ${job._id} completed in ${Date.now() - startedAt}ms`);
  } catch (error) {
    const retry = job.attempts < MAX_ATTEMPTS;
    const delay = Math.min(1000 * 2 ** (job.attempts - 1), 30000);
    const failureUpdate = await WhatsAppBillJob.updateOne(
      { _id: job._id, status: "processing", leaseOwner: WORKER_ID },
      {
        $set: {
          status: retry ? "queued" : "failed",
          availableAt: new Date(Date.now() + delay),
          lastError: String(error.message || "Bill delivery failed").slice(0, 500),
          ...(!retry && { deleteAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }),
        },
        $unset: { leaseOwner: 1, leaseExpiresAt: 1 },
      },
    );
    if (!failureUpdate.matchedCount) {
      console.error(`WhatsApp bill job ${job._id} could not record failure because its lease was lost:`, error.message);
      return;
    }
    console.error(`WhatsApp bill job ${job._id} ${retry ? "will retry" : "failed"}:`, error.message);
  } finally {
    clearInterval(heartbeat);
  }
}

async function processBullJob(queueJob) {
  const current = await WhatsAppBillJob.findById(queueJob.data.mongoJobId).lean();
  if (!current || ["completed", "failed"].includes(current.status)) return;

  const now = new Date();
  if (current.status === "queued" && current.availableAt > now) {
    return deferBullJob(queueJob, current.availableAt.getTime() - now.getTime());
  }
  if (current.status === "processing" && current.leaseExpiresAt > now) {
    return deferBullJob(queueJob, current.leaseExpiresAt.getTime() - now.getTime());
  }

  const claimed = await WhatsAppBillJob.findOneAndUpdate(
    {
      _id: current._id,
      $or: [
        { status: "queued", availableAt: { $lte: now } },
        { status: "processing", leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "processing",
        leaseOwner: WORKER_ID,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
  if (!claimed) return deferBullJob(queueJob);

  active += 1;
  try {
    await processJob(claimed);
  } finally {
    active -= 1;
  }
  const updated = await WhatsAppBillJob.findById(current._id)
    .select("_id attempts availableAt status")
    .lean();
  if (updated?.status === "queued") await dispatchBullJob(updated);
}

async function reconcileBullJobs() {
  const now = new Date();
  const pending = await WhatsAppBillJob.find({
    $or: [
      { status: "queued", availableAt: { $lte: now } },
      { status: "processing", leaseExpiresAt: { $lte: now } },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(CONCURRENCY * 20)
    .select("_id attempts availableAt")
    .lean();
  await Promise.all(pending.map(dispatchBullJob));
}

async function startBullWorker() {
  if (bullWorker) return;
  bullWorkerConnection = createRedisConnection();
  bullWorker = new Worker(BULL_QUEUE_NAME, processBullJob, {
    connection: bullWorkerConnection,
    concurrency: CONCURRENCY,
  });
  bullWorker.on("error", (error) =>
    console.error("WhatsApp bill BullMQ worker error:", error.message),
  );
  bullWorker.on("failed", (job, error) =>
    console.error(`WhatsApp bill BullMQ job ${job?.id || "unknown"} failed:`, error.message),
  );
  try {
    await bullWorker.waitUntilReady();
    await reconcileBullJobs();
    reconcileTimer = setInterval(() => {
      reconcileBullJobs().catch((error) =>
        console.error("WhatsApp bill BullMQ reconciliation failed:", error.message),
      );
    }, 5000);
    if (reconcileTimer.unref) reconcileTimer.unref();
  } catch (error) {
    const failedWorker = bullWorker;
    bullWorker = null;
    if (failedWorker) {
      await failedWorker.close().catch((closeError) =>
        console.error("Failed to close WhatsApp bill BullMQ worker after startup error:", closeError.message),
      );
    }
    if (bullWorkerConnection) bullWorkerConnection.disconnect();
    bullWorkerConnection = null;
    throw error;
  }
}

async function pump() {
  if (polling) return;
  polling = true;
  try {
    while (!stopping && active < CONCURRENCY) {
      const job = await claim();
      if (!job) break;
      active += 1;
      processJob(job)
        .catch((error) => console.error("WhatsApp bill worker failed:", error.message))
        .finally(() => {
          active -= 1;
          pump().catch((error) => console.error("WhatsApp bill queue polling failed:", error.message));
        });
    }
  } finally {
    polling = false;
  }
}

async function start() {
  if (timer || bullWorker || process.env.NODE_ENV === "test") return;
  stopping = false;
  const cleanup = () =>
    invoicePdf
      .deleteExpiredBillPdfs()
      .then((count) => {
        if (count) console.info(`Removed ${count} expired WhatsApp invoice PDF(s)`);
      })
      .catch((error) =>
        console.error("Expired WhatsApp invoice PDF cleanup failed:", error.message),
      );
  cleanup();
  cleanupTimer = setInterval(cleanup, 60 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
  if (bullMode()) {
    await startBullWorker();
    return;
  }
  timer = setInterval(() => {
    pump().catch((error) => console.error("WhatsApp bill queue polling failed:", error.message));
  }, 500);
  if (timer.unref) timer.unref();
  pump().catch((error) => console.error("WhatsApp bill queue startup failed:", error.message));
}

async function stop() {
  stopping = true;
  if (timer) clearInterval(timer);
  if (cleanupTimer) clearInterval(cleanupTimer);
  if (reconcileTimer) clearInterval(reconcileTimer);
  timer = null;
  cleanupTimer = null;
  reconcileTimer = null;
  const currentWorker = bullWorker;
  const currentQueue = bullQueue;
  bullWorker = null;
  bullQueue = null;
  if (currentWorker) await currentWorker.close();
  if (currentQueue) await currentQueue.close();
  await Promise.all(
    [bullWorkerConnection, bullConnection]
      .filter(Boolean)
      .map((connection) =>
        connection.status === "ready" ? connection.quit() : connection.disconnect(),
      ),
  );
  bullWorkerConnection = null;
  bullConnection = null;
  while (active || polling) await new Promise((resolve) => setTimeout(resolve, 25));
}

async function status() {
  const [queued, processing, failed, oldest] = await Promise.all([
    WhatsAppBillJob.countDocuments({ status: "queued" }),
    WhatsAppBillJob.countDocuments({ status: "processing" }),
    WhatsAppBillJob.countDocuments({ status: "failed" }),
    WhatsAppBillJob.findOne({ status: "queued" }).sort({ createdAt: 1 }).select("createdAt").lean(),
  ]);
  return { backend: bullMode() ? "bullmq" : "mongodb", queued, processing, failed, activeHere: active, concurrency: CONCURRENCY, oldestWaitMs: oldest ? Math.max(0, Date.now() - oldest.createdAt.getTime()) : 0 };
}

async function drain() {
  while (active) await new Promise((resolve) => setTimeout(resolve, 5));
  const job = await claim();
  if (!job) return;
  active += 1;
  try {
    await processJob(job);
  } finally {
    active -= 1;
  }
  return drain();
}

module.exports = { enqueue, start, stop, drain, status };
