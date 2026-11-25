const mongoose = require("mongoose");

// How the website assistant is doing: counts per day and the last success
// and failure. No visitor messages are stored, only numbers.

const daySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD, India time
    total: { type: Number, default: 0 },
    ai: { type: Number, default: 0 }, // answered by the AI
    rules: { type: Number, default: 0 }, // answered by the built-in answers
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    estimatedCostMicros: { type: Number, default: 0 },
    failures: { type: Number, default: 0 }, // AI tried and failed (rules answered instead)
    declined: { type: Number, default: 0 }, // AI's safety filter declined (rules answered instead)
    aiMs: { type: Number, default: 0 }, // total AI reply time, for the average
    totalMs: { type: Number, default: 0 },
    latencyBuckets: {
      under1s: { type: Number, default: 0 },
      from1to3s: { type: Number, default: 0 },
      from3to5s: { type: Number, default: 0 },
      from5to10s: { type: Number, default: 0 },
      from10to20s: { type: Number, default: 0 },
      from20to60s: { type: Number, default: 0 },
      over60s: { type: Number, default: 0 },
    },
    byProvider: { claude: { type: Number, default: 0 }, gemini: { type: Number, default: 0 } },
  },
  { timestamps: false }
);

const statusSchema = new mongoose.Schema({
  key: { type: String, default: "assistant", unique: true },
  lastSuccess: { at: Date, provider: String, model: String, ms: Number },
  lastError: { at: Date, provider: String, code: String, status: Number, message: String },
});

const AssistantDay = mongoose.models.AssistantDay || mongoose.model("AssistantDay", daySchema);
const AssistantStatus = mongoose.models.AssistantStatus || mongoose.model("AssistantStatus", statusSchema);

const istDate = (at = Date.now()) => new Date(at + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const LATENCY_BUCKETS = [
  ["under1s", 1000], ["from1to3s", 3000], ["from3to5s", 5000],
  ["from5to10s", 10000], ["from10to20s", 20000], ["from20to60s", 60000], ["over60s", 120000],
];

function pricePerMillion(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return null;
  const price = Number(raw);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return price;
}

function estimatedCostMicros(provider, usage = {}) {
  if (provider !== "gemini" && provider !== "claude") return null;
  const prefix = provider === "claude" ? "ASSISTANT_CLAUDE" : "ASSISTANT_GEMINI";
  const inputPrice = pricePerMillion(`${prefix}_INPUT_USD_PER_1M`);
  const outputPrice = pricePerMillion(`${prefix}_OUTPUT_USD_PER_1M`);
  if (inputPrice === null || outputPrice === null) return null;
  return Math.round(
    (Number(usage.inputTokens) || 0) * inputPrice +
      (Number(usage.outputTokens) || 0) * outputPrice,
  );
}

// What went wrong, in words the Super Admin can act on
function describeError(error) {
  const status = Number(error?.status) || undefined;
  const text = String(error?.message || error || "");
  let code = "OTHER";
  if (status === 429 || /quota|rate limit|resource.?exhausted/i.test(text)) code = "QUOTA";
  else if (status === 401 || status === 403 || /api key|permission|unauthori[sz]ed|authentication/i.test(text)) code = "KEY";
  else if (status === 404) code = "MODEL";
  else if (status === 503 || status === 500 || status === 529 || /overloaded|high demand|unavailable/i.test(text)) code = "BUSY";
  else if (/fetch failed|network|ENOTFOUND|ECONNRESET|ETIMEDOUT|timeout/i.test(text)) code = "NETWORK";
  return { code, status, message: text.slice(0, 300) };
}

/**
 * Count one reply. Never throws: stats must not break the chat.
 * outcome: { source: "ai"|"rules", provider?, model?, ms?, error?, declined? }
 */
async function record(outcome) {
  try {
    const ms = Math.max(0, Number(outcome.ms) || 0);
    const usage = outcome.usage || {};
    const bucket = ms < 1000 ? "under1s" : ms < 3000 ? "from1to3s" : ms < 5000 ? "from3to5s" : ms < 10000 ? "from5to10s" : ms < 20000 ? "from10to20s" : ms < 60000 ? "from20to60s" : "over60s";
    const inc = { total: 1, totalMs: ms, [`latencyBuckets.${bucket}`]: 1, [outcome.source === "ai" ? "ai" : "rules"]: 1 };
    inc.inputTokens = Math.max(0, Number(usage.inputTokens) || 0);
    inc.outputTokens = Math.max(0, Number(usage.outputTokens) || 0);
    const costMicros = estimatedCostMicros(outcome.provider, usage);
    if (costMicros !== null) inc.estimatedCostMicros = costMicros;
    if (outcome.source === "ai") {
      inc.aiMs = outcome.ms || 0;
      if (outcome.provider) inc[`byProvider.${outcome.provider}`] = 1;
    }
    if (outcome.error) inc.failures = 1;
    if (outcome.declined) inc.declined = 1;
    await AssistantDay.updateOne({ date: istDate() }, { $inc: inc }, { upsert: true });

    if (outcome.source === "ai") {
      await AssistantStatus.updateOne({ key: "assistant" }, { lastSuccess: { at: new Date(), provider: outcome.provider, model: outcome.model, ms: outcome.ms } }, { upsert: true });
    } else if (outcome.error) {
      await AssistantStatus.updateOne({ key: "assistant" }, { lastError: { at: new Date(), provider: outcome.provider, ...outcome.error } }, { upsert: true });
    }
  } catch (error) {
    console.warn("Assistant stats not saved:", error.message);
  }
}

// The last `days` days (oldest first), zeros where nothing happened
async function summary(days = 14) {
  const dates = Array.from({ length: days }, (_, i) => istDate(Date.now() - (days - 1 - i) * 86400000));
  const [rows, status] = await Promise.all([AssistantDay.find({ date: { $gte: dates[0] } }).lean(), AssistantStatus.findOne({ key: "assistant" }).lean()]);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const percentile = (sourceRows, ratio) => {
    const total = sourceRows.reduce((sum, row) => sum + (row.total || 0), 0);
    if (!total) return null;
    const sampled = sourceRows.reduce((sum, row) => sum + LATENCY_BUCKETS.reduce((bucketSum, [key]) => bucketSum + (row.latencyBuckets?.[key] || 0), 0), 0);
    if (sampled < total) return null;
    const target = Math.ceil(total * ratio);
    let cumulative = 0;
    for (const [key, upperBound] of LATENCY_BUCKETS) {
      cumulative += sourceRows.reduce((sum, row) => sum + (row.latencyBuckets?.[key] || 0), 0);
      if (cumulative >= target) return upperBound;
    }
    return 120000;
  };
  const series = dates.map((date) => {
    const r = byDate.get(date) || {};
    return { date, total: r.total || 0, ai: r.ai || 0, rules: r.rules || 0, failures: r.failures || 0, declined: r.declined || 0, inputTokens: r.inputTokens || 0, outputTokens: r.outputTokens || 0, estimatedCostMicros: r.estimatedCostMicros || 0, avgMs: r.ai ? Math.round(r.aiMs / r.ai) : null, p95Ms: r.total ? percentile([r], 0.95) : null, p99Ms: r.total ? percentile([r], 0.99) : null };
  });
  const sum = (key) => series.reduce((s, d) => s + d[key], 0);
  const aiMsTotal = rows.reduce((s, r) => s + (r.aiMs || 0), 0);
  return {
    today: series[series.length - 1],
    period: {
      days,
      total: sum("total"),
      ai: sum("ai"),
      rules: sum("rules"),
      failures: sum("failures"),
      declined: sum("declined"),
      avgMs: sum("ai") ? Math.round(aiMsTotal / sum("ai")) : null,
      p95Ms: percentile(rows, 0.95),
      p99Ms: percentile(rows, 0.99),
      inputTokens: sum("inputTokens"),
      outputTokens: sum("outputTokens"),
      estimatedCostUsd: rows.length && rows.every((row) => row.estimatedCostMicros !== undefined)
        ? rows.reduce((total, row) => total + (row.estimatedCostMicros || 0), 0) / 1_000_000
        : null,
    },
    series,
    lastSuccess: status?.lastSuccess?.at ? status.lastSuccess : null,
    lastError: status?.lastError?.at ? status.lastError : null,
  };
}

module.exports = {
  record,
  summary,
  describeError,
  estimatedCostMicros,
  AssistantDay,
  AssistantStatus,
};
