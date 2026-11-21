const crypto = require("crypto");
const os = require("os");
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
const WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 5 * 60 * 1000;

let activeJobs = 0;
let pumping = false;
let timer;

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
  const events = splitWebhookEvents(webhookData);
  if (!events.length) return { accepted: 0 };

  const startedAt = Date.now();
  for (const event of events) {
    try {
      await WhatsAppWebhookJob.updateOne(
        { idempotencyKey: event.idempotencyKey },
        {
          $setOnInsert: {
            ...event,
            status: "queued",
            availableAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
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

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (activeJobs < WORKER_CONCURRENCY) {
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

function start() {
  if (timer || process.env.NODE_ENV === "test") return;
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

module.exports = { enqueueWebhook, start, drain, _splitWebhookEvents: splitWebhookEvents };
