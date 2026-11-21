const WhatsAppBillJob = require("../models/WhatsAppBillJob.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const messageService = require("./message.service");
const invoicePdf = require("../emi/services/invoicePdf.service");

const MAX_ATTEMPTS = 4;
const LEASE_MS = 60 * 1000;
const CONCURRENCY = 2;
let active = 0;
let polling = false;
let timer;

async function enqueue({ tenantId, invoiceId, customerId, idempotencyKey }) {
  try {
    return await WhatsAppBillJob.findOneAndUpdate(
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
    return WhatsAppBillJob.findOne({ tenantId, idempotencyKey });
  }
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
      $set: { status: "processing", leaseExpiresAt: new Date(now.getTime() + LEASE_MS) },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { createdAt: 1, _id: 1 } },
  );
}

async function processJob(job) {
  const startedAt = Date.now();
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
      await WhatsAppBillJob.updateOne(
        { _id: job._id, status: "processing" },
        { $set: { pdfFileId } },
      );
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
    await WhatsAppBillJob.updateOne(
      { _id: job._id, status: "processing" },
      {
        $set: {
          status: "completed",
          messageId: message._id,
          deleteAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        $unset: { leaseExpiresAt: 1, lastError: 1 },
      },
    );
    console.info(`WhatsApp bill job ${job._id} completed in ${Date.now() - startedAt}ms`);
  } catch (error) {
    const retry = job.attempts < MAX_ATTEMPTS;
    const delay = Math.min(1000 * 2 ** (job.attempts - 1), 30000);
    await WhatsAppBillJob.updateOne(
      { _id: job._id, status: "processing" },
      {
        $set: {
          status: retry ? "queued" : "failed",
          availableAt: new Date(Date.now() + delay),
          lastError: String(error.message || "Bill delivery failed").slice(0, 500),
          ...(!retry && { deleteAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }),
        },
        $unset: { leaseExpiresAt: 1 },
      },
    );
    console.error(`WhatsApp bill job ${job._id} ${retry ? "will retry" : "failed"}:`, error.message);
  }
}

async function pump() {
  if (polling) return;
  polling = true;
  try {
    while (active < CONCURRENCY) {
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

function start() {
  if (timer || process.env.NODE_ENV === "test") return;
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
  const cleanupTimer = setInterval(cleanup, 60 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
  timer = setInterval(() => {
    pump().catch((error) => console.error("WhatsApp bill queue polling failed:", error.message));
  }, 500);
  if (timer.unref) timer.unref();
  pump().catch((error) => console.error("WhatsApp bill queue startup failed:", error.message));
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

module.exports = { enqueue, start, drain };
