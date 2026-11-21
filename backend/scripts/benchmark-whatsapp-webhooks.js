const crypto = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");

const benchmarkUri = process.env.WHATSAPP_BENCHMARK_MONGODB_URI;
if (
  !benchmarkUri ||
  !/\/[^/?]*benchmark[^/?]*(?:\?|$)/i.test(benchmarkUri)
) {
  throw new Error(
    "Set WHATSAPP_BENCHMARK_MONGODB_URI to an isolated MongoDB database whose name contains 'benchmark'.",
  );
}

process.env.NODE_ENV = "benchmark";
process.env.MONGODB_URI = benchmarkUri;
process.env.META_APP_SECRET = "local-whatsapp-benchmark-secret";
process.env.META_WEBHOOK_SKIP_SIGNATURE = "false";
process.env.WHATSAPP_AI_GEMINI_DATA_SHARING_ENABLED = "false";

const MESSAGE_COUNT = Math.min(
  Math.max(Number(process.env.WHATSAPP_BENCHMARK_MESSAGES) || 100, 1),
  1000,
);
const PHONE_NUMBER_ID = "benchmark-phone-number";
const APP_SECRET = process.env.META_APP_SECRET;

const percentile = (values, pct) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1)];
};

function webhook(messageId, sender) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "benchmark-waba",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ wa_id: sender, profile: { name: "Benchmark" } }],
              messages: [
                {
                  from: sender,
                  id: messageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "hello" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function main() {
  const app = require("../src/app");
  await app.locals.databaseReady;
  await mongoose.connection.dropDatabase();

  const User = require("../src/models/User.model");
  const WhatsAppWebhookJob = require("../src/models/WhatsAppWebhookJob.model");
  await User.create({
    name: "WhatsApp benchmark",
    email: `benchmark-${crypto.randomUUID()}@local.invalid`,
    password: "benchmark-password",
    phone: "+919000000000",
    isVerified: true,
    role: "user",
    whatsappConfig: {
      isConnected: true,
      phoneNumberId: PHONE_NUMBER_ID,
      accessToken: "benchmark-access-token",
    },
  });

  const ackLatencies = [];
  const startedAt = Date.now();
  const results = await Promise.all(
    Array.from({ length: MESSAGE_COUNT }, async (_, index) => {
      const payload = webhook(
        `wamid.BENCH_${index}`,
        String(919000000000 + index),
      );
      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${crypto
        .createHmac("sha256", APP_SECRET)
        .update(rawBody)
        .digest("hex")}`;
      const requestStartedAt = Date.now();
      const response = await request(app)
        .post("/api/whatsapp/webhook")
        .set("Content-Type", "application/json")
        .set("X-Hub-Signature-256", signature)
        .send(rawBody);
      ackLatencies[index] = Date.now() - requestStartedAt;
      return response.status;
    }),
  );
  const ackedAt = Date.now();
  if (results.some((status) => status !== 200)) {
    throw new Error(`Webhook benchmark returned non-200 statuses: ${results.join(",")}`);
  }

  const deadline = Date.now() + 30000;
  while (
    (await WhatsAppWebhookJob.countDocuments({ status: "completed" })) <
      MESSAGE_COUNT &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const jobs = await WhatsAppWebhookJob.find({ status: "completed" })
    .select("createdAt completedAt")
    .lean();
  const finishedAt = Date.now();
  if (jobs.length !== MESSAGE_COUNT) {
    throw new Error(`Only ${jobs.length}/${MESSAGE_COUNT} webhook jobs completed`);
  }

  const queueLatencies = jobs.map(
    (job) => job.completedAt.getTime() - job.createdAt.getTime(),
  );
  const ackSeconds = Math.max((ackedAt - startedAt) / 1000, 0.001);
  const totalSeconds = Math.max((finishedAt - startedAt) / 1000, 0.001);
  console.log(
    JSON.stringify(
      {
        messages: MESSAGE_COUNT,
        webhookAckThroughputPerSecond: Number((MESSAGE_COUNT / ackSeconds).toFixed(2)),
        endToEndThroughputPerSecond: Number((MESSAGE_COUNT / totalSeconds).toFixed(2)),
        ackMs: {
          p50: percentile(ackLatencies, 0.5),
          p95: percentile(ackLatencies, 0.95),
          max: Math.max(...ackLatencies),
        },
        queueAndProcessingMs: {
          p50: percentile(queueLatencies, 0.5),
          p95: percentile(queueLatencies, 0.95),
          max: Math.max(...queueLatencies),
        },
        note: "Local isolated MongoDB, no Gemini or Meta network calls; this burst test is not a production capacity guarantee.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("WhatsApp benchmark failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      try {
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
  });
