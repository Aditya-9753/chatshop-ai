const crypto = require("crypto");
const os = require("os");
const { DelayedError, Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const WhatsAppWebhookJob = require("../models/WhatsAppWebhookJob.model");
const WhatsAppWebhookLock = require("../models/WhatsAppWebhookLock.model");
const whatsappService = require("./whatsapp.service");

function positiveIntegerEnv(name, fallback, minimum = 1) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer of at least ${minimum}`);
  }
  return value;
}

const LEASE_MS = positiveIntegerEnv("WHATSAPP_WEBHOOK_LEASE_MS", 60000, 6000);
const MAX_ATTEMPTS = positiveIntegerEnv("WHATSAPP_WEBHOOK_MAX_ATTEMPTS", 8);
const WORKER_CONCURRENCY = positiveIntegerEnv("WHATSAPP_WEBHOOK_CONCURRENCY", 8);
const MAX_BACKLOG = positiveIntegerEnv("WHATSAPP_WEBHOOK_MAX_BACKLOG", 5000);
const MAX_EVENTS_PER_REQUEST = positiveIntegerEnv("WHATSAPP_WEBHOOK_MAX_EVENTS_PER_REQUEST", MAX_BACKLOG);
if (MAX_EVENTS_PER_REQUEST > MAX_BACKLOG) throw new Error("WHATSAPP_WEBHOOK_MAX_EVENTS_PER_REQUEST cannot exceed WHATSAPP_WEBHOOK_MAX_BACKLOG");
const ADMISSION_LOCK = "__whatsapp_webhook_admission__";
const WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;

let activeJobs = 0;
let pumping = false;
let timer;
let stopping = false;
let bullQueue;
let bullWorker;
let bullConnection;
let bullWorkerConnection;
let reconcileTimer;
const BULL_QUEUE_NAME = "chatshop-whatsapp-webhooks";

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
    "process-webhook",
    { mongoJobId: String(job._id) },
    {
      jobId: `webhook-${job._id}-${job.attempts || 0}`,
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

const digest = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function splitWebhookEvents(webhookData) {
  const events = [];
  if (webhookData?.object !== "whatsapp_business_account") return events;

  for (const entry of webhookData.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const metadata = value.metadata || {};
      const phoneNumberId = String(metadata.phone_number_id || "unknown");
      const eventBase = {
        object: webhookData.object,
        entry: [
          {
            id: entry.id,
            changes: [{ field: change.field, value: { ...value } }],
          },
        ],
      };

      for (const message of value.messages || []) {
        const messageValue = {
          ...value,
          messages: [message],
          contacts: (value.contacts || []).filter(
            (contact) => contact.wa_id === message.from,
          ),
        };
        const payload = {
          ...eventBase,
          entry: [
            {
              id: entry.id,
              changes: [{ field: change.field, value: messageValue }],
            },
          ],
        };
        events.push({
          idempotencyKey: `message:${message.id || digest(messageValue)}`,
          partitionKey: `${phoneNumberId}:sender:${message.from || "unknown"}`,
          payload,
        });
      }

      for (const status of value.statuses || []) {
        const statusValue = { ...value, statuses: [status] };
        const payload = {
          ...eventBase,
          entry: [
            {
              id: entry.id,
              changes: [{ field: change.field, value: statusValue }],
            },
          ],
        };
        events.push({
          idempotencyKey: `status:${digest({
            phoneNumberId,
            id: status.id,
            status: status.status,
            timestamp: status.timestamp,
          })}`,
          partitionKey: `${phoneNumberId}:status:${status.id || "unknown"}`,
          payload,
        });
      }
    }
  }
  return events;
}

async function enqueueWebhook(webhookData) {
  const allEvents = splitWebhookEvents(webhookData);
  if (allEvents.length > MAX_EVENTS_PER_REQUEST) {
    const error = new Error("WhatsApp webhook contains too many events for one delivery");
    error.code = "WEBHOOK_EVENT_BATCH_LIMIT";
    throw error;
  }
  const events = [...new Map(allEvents.map((event) => [event.idempotencyKey, event])).values()];
  if (!events.length) return { accepted: 0 };

  const startedAt = Date.now();
  const admissionLocked = await acquirePartitionLock(ADMISSION_LOCK, new Date());
  if (!admissionLocked) {
    const error = new Error("WhatsApp webhook queue admission is busy");
    error.code = "WEBHOOK_QUEUE_BUSY";
    throw error;
  }
  try {
    const existing = await WhatsAppWebhookJob.find({ idempotencyKey: { $in: events.map((event) => event.idempotencyKey) } }).select("idempotencyKey").lean();
    const seen = new Set(existing.map((job) => job.idempotencyKey));
    const newEvents = events.filter((event) => !seen.has(event.idempotencyKey));
    const pending = await WhatsAppWebhookJob.countDocuments({ status: { $in: ["queued", "processing"] } });
    if (pending + newEvents.length > MAX_BACKLOG) {
      const error = new Error("WhatsApp webhook queue is at its configured backlog limit");
      error.code = "WEBHOOK_QUEUE_FULL";
      throw error;
    }

    for (const event of newEvents) {
      try {
        await WhatsAppWebhookJob.updateOne(
          { idempotencyKey: event.idempotencyKey },
          { $setOnInsert: { ...event, status: "queued", availableAt: new Date() } },
          { upsert: true },
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
  } finally {
    await releaseLease(ADMISSION_LOCK);
  }

  if (bullMode()) {
    const queuedJobs = await WhatsAppWebhookJob.find({
      idempotencyKey: { $in: events.map((event) => event.idempotencyKey) },
      status: "queued",
    })
      .select("_id attempts availableAt")
      .lean();
    await Promise.all(queuedJobs.map(dispatchBullJob));
  }

  console.info(
    `WhatsApp webhook accepted: ${events.length} event(s) in ${Date.now() - startedAt}ms`,
  );
  return { accepted: events.length };
}

async function acquirePartitionLock(partitionKey, now) {
  try {
    const lock = await WhatsAppWebhookLock.findOneAndUpdate(
      { partitionKey, leaseExpiresAt: { $lte: now } },
      {
        $set: {
          leaseOwner: WORKER_ID,
          leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        },
      },
      { new: true, upsert: true },
    );
    return Boolean(lock);
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

async function claimNextJob() {
  const blockedPartitions = [];
  for (;;) {
    const now = new Date();
    const job = await WhatsAppWebhookJob.findOne({
      partitionKey: { $nin: blockedPartitions },
      $or: [
        { status: "queued", availableAt: { $lte: now } },
        { status: "processing", leaseExpiresAt: { $lte: now } },
      ],
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    if (!job) return null;
    const locked = await acquirePartitionLock(job.partitionKey, now);
    if (!locked) {
      blockedPartitions.push(job.partitionKey);
      continue;
    }

    const claimed = await WhatsAppWebhookJob.findOneAndUpdate(
      {
        _id: job._id,
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

    if (claimed) return claimed;
    await WhatsAppWebhookLock.updateOne(
      { partitionKey: job.partitionKey, leaseOwner: WORKER_ID },
      { $set: { leaseExpiresAt: new Date() } },
    );
    blockedPartitions.push(job.partitionKey);
  }
}

async function renewLease(jobId, partitionKey) {
  const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
  const [jobResult, lockResult] = await Promise.all([
    WhatsAppWebhookJob.updateOne(
      { _id: jobId, status: "processing", leaseOwner: WORKER_ID },
      { $set: { leaseExpiresAt } },
    ),
    WhatsAppWebhookLock.updateOne(
      { partitionKey, leaseOwner: WORKER_ID },
      { $set: { leaseExpiresAt } },
    ),
  ]);
  if (!jobResult.matchedCount || !lockResult.matchedCount) {
    throw new Error("WhatsApp webhook worker lost its processing lease");
  }
}

async function releaseLease(partitionKey) {
  await WhatsAppWebhookLock.updateOne(
    { partitionKey, leaseOwner: WORKER_ID },
    { $set: { leaseExpiresAt: new Date() } },
  );
}

async function processJob(job) {
  const startedAt = Date.now();
  const heartbeat = setInterval(() => {
    renewLease(job._id, job.partitionKey).catch((error) =>
      console.error("WhatsApp webhook lease renewal failed:", error.message),
    );
  }, Math.max(1000, Math.floor(LEASE_MS / 3)));
  if (heartbeat.unref) heartbeat.unref();

  try {
    await whatsappService.handleWebhook(job.payload);
    const completion = await WhatsAppWebhookJob.updateOne(
      { _id: job._id, status: "processing", leaseOwner: WORKER_ID },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          deleteAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        $unset: { leaseOwner: 1, leaseExpiresAt: 1, lastError: 1 },
      },
    );
    if (!completion.matchedCount) {
      console.warn("WhatsApp webhook worker lost its lease before completing a job");
      return;
    }
    console.info(
      `WhatsApp webhook job completed in ${Date.now() - startedAt}ms; queue wait ${Date.now() - new Date(job.createdAt).getTime()}ms (attempt ${job.attempts})`,
    );
  } catch (error) {
    const retry = job.attempts < MAX_ATTEMPTS;
    const delay = Math.min(
      RETRY_BASE_MS * 2 ** Math.max(0, job.attempts - 1),
      RETRY_MAX_MS,
    );
    await WhatsAppWebhookJob.updateOne(
      { _id: job._id, status: "processing", leaseOwner: WORKER_ID },
      {
        $set: {
          status: retry ? "queued" : "failed",
          availableAt: new Date(Date.now() + delay),
          lastError: String(error.message || "Webhook processing failed").slice(0, 500),
          ...(retry ? {} : { deleteAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }),
        },
        $unset: { leaseOwner: 1, leaseExpiresAt: 1 },
      },
    );
    console.error(
      `WhatsApp webhook job ${retry ? "will retry" : "failed permanently"} after attempt ${job.attempts}:`,
      error.message,
    );
  } finally {
    clearInterval(heartbeat);
    await releaseLease(job.partitionKey);
  }
}

async function processBullJob(queueJob) {
  const current = await WhatsAppWebhookJob.findById(queueJob.data.mongoJobId).lean();
  if (!current || ["completed", "failed"].includes(current.status)) return;

  const now = new Date();
  if (current.status === "queued" && current.availableAt > now) {
    return deferBullJob(queueJob, current.availableAt.getTime() - now.getTime());
  }
  if (current.status === "processing" && current.leaseExpiresAt > now) {
    return deferBullJob(queueJob, current.leaseExpiresAt.getTime() - now.getTime());
  }

  const earlier = await WhatsAppWebhookJob.exists({
    _id: { $ne: current._id },
    partitionKey: current.partitionKey,
    status: { $in: ["queued", "processing"] },
    $or: [
      { createdAt: { $lt: current.createdAt } },
      { createdAt: current.createdAt, _id: { $lt: current._id } },
    ],
  });
  if (earlier) return deferBullJob(queueJob);

  if (!(await acquirePartitionLock(current.partitionKey, now))) {
    return deferBullJob(queueJob);
  }
  const claimed = await WhatsAppWebhookJob.findOneAndUpdate(
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
  if (!claimed) {
    await releaseLease(current.partitionKey);
    return deferBullJob(queueJob);
  }

  activeJobs += 1;
  try {
    await processJob(claimed);
  } finally {
    activeJobs -= 1;
  }
  const updated = await WhatsAppWebhookJob.findById(current._id)
    .select("_id attempts availableAt status")
    .lean();
  if (updated?.status === "queued") await dispatchBullJob(updated);
}

async function reconcileBullJobs() {
  const now = new Date();
  const pending = await WhatsAppWebhookJob.find({
    $or: [
      { status: "queued", availableAt: { $lte: now } },
      { status: "processing", leaseExpiresAt: { $lte: now } },
    ],
  })
    .sort({ createdAt: 1, _id: 1 })
    .limit(WORKER_CONCURRENCY * 20)
    .select("_id attempts availableAt")
    .lean();
  await Promise.all(pending.map(dispatchBullJob));
}

async function startBullWorker() {
  if (bullWorker) return;
  bullWorkerConnection = createRedisConnection();
  bullWorker = new Worker(BULL_QUEUE_NAME, processBullJob, {
    connection: bullWorkerConnection,
    concurrency: WORKER_CONCURRENCY,
  });
  bullWorker.on("error", (error) =>
    console.error("WhatsApp BullMQ worker error:", error.message),
  );
  bullWorker.on("failed", (job, error) =>
    console.error(`WhatsApp BullMQ job ${job?.id || "unknown"} failed:`, error.message),
  );
  try {
    await bullWorker.waitUntilReady();
    await reconcileBullJobs();
    reconcileTimer = setInterval(() => {
      reconcileBullJobs().catch((error) =>
        console.error("WhatsApp BullMQ reconciliation failed:", error.message),
      );
    }, 5000);
    if (reconcileTimer.unref) reconcileTimer.unref();
  } catch (error) {
    const failedWorker = bullWorker;
    bullWorker = null;
    if (failedWorker) {
      await failedWorker.close().catch((closeError) =>
        console.error("Failed to close WhatsApp BullMQ worker after startup error:", closeError.message),
      );
    }
    if (bullWorkerConnection) bullWorkerConnection.disconnect();
    bullWorkerConnection = null;
    throw error;
  }
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (!stopping && activeJobs < WORKER_CONCURRENCY) {
      const job = await claimNextJob();
      if (!job) break;
      activeJobs += 1;
      processJob(job)
        .catch((error) => console.error("WhatsApp webhook worker error:", error))
        .finally(() => {
          activeJobs -= 1;
          pump().catch((error) =>
            console.error("WhatsApp webhook queue poll failed:", error),
          );
        });
    }
  } finally {
    pumping = false;
  }
}

async function start() {
  if (timer || bullWorker || process.env.NODE_ENV === "test") return;
  stopping = false;
  if (bullMode()) {
    await startBullWorker();
    return;
  }
  timer = setInterval(() => {
    pump().catch((error) =>
      console.error("WhatsApp webhook queue poll failed:", error),
    );
  }, 250);
  if (timer.unref) timer.unref();
  pump().catch((error) =>
    console.error("WhatsApp webhook queue startup failed:", error),
  );
}

async function stop() {
  stopping = true;
  if (timer) clearInterval(timer);
  if (reconcileTimer) clearInterval(reconcileTimer);
  timer = null;
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
  while (activeJobs || pumping) await new Promise((resolve) => setTimeout(resolve, 25));
}

async function status() {
  const [queued, processing, failed, oldest] = await Promise.all([
    WhatsAppWebhookJob.countDocuments({ status: "queued" }),
    WhatsAppWebhookJob.countDocuments({ status: "processing" }),
    WhatsAppWebhookJob.countDocuments({ status: "failed" }),
    WhatsAppWebhookJob.findOne({ status: "queued" }).sort({ createdAt: 1 }).select("createdAt").lean(),
  ]);
  return { backend: bullMode() ? "bullmq" : "mongodb", queued, processing, failed, activeHere: activeJobs, maxBacklog: MAX_BACKLOG, concurrency: WORKER_CONCURRENCY, oldestWaitMs: oldest ? Math.max(0, Date.now() - oldest.createdAt.getTime()) : 0 };
}

async function drain() {
  while (activeJobs) await new Promise((resolve) => setTimeout(resolve, 5));
  const job = await claimNextJob();
  if (!job) return;
  activeJobs += 1;
  try {
    await processJob(job);
  } finally {
    activeJobs -= 1;
  }
  return drain();
}

module.exports = { enqueueWebhook, start, stop, drain, status, _splitWebhookEvents: splitWebhookEvents };
