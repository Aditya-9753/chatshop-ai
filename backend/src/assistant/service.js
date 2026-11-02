const Anthropic = require("@anthropic-ai/sdk");
const { GoogleGenAI } = require("@google/genai");
const { liveFacts, systemPrompt } = require("./knowledge");
const rules = require("./rules");
const stats = require("./stats");

const MODEL = "claude-opus-5-5";
// Free-tier Gemini models get busy: the next one is tried when one is busy
const GEMINI_MODELS = () => (process.env.GEMINI_MODEL || "gemini-flash-lite-latest,gemini-3-flash-preview,gemini-flash-latest").split(",").map((m) => m.trim()).filter(Boolean);
const HISTORY_TURNS = 12; // the last few messages are enough for a sales chat

/**
 * Which AI answers: ASSISTANT_PROVIDER = claude | gemini | off. Unset, the
 * first one with a key wins. With none (or "off"), and whenever a call fails,
 * the built-in rules answer.
 */
function provider() {
  const chosen = String(process.env.ASSISTANT_PROVIDER || "").toLowerCase();
  if (chosen === "off" || process.env.ASSISTANT_AI === "off") return null;
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  if (chosen === "claude") return hasClaude ? "claude" : null;
  if (chosen === "gemini") return hasGemini ? "gemini" : null;
  return hasClaude ? "claude" : hasGemini ? "gemini" : null;
}
const aiEnabled = () => provider() !== null;

let claude = null;
let gemini = null;
const getClaude = () => (claude ||= new Anthropic());
const getGemini = () => (gemini ||= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

// Facts (plan prices, contact) change rarely: reuse them for a minute
let cached = { at: 0, facts: null };
async function facts() {
  if (!cached.facts || Date.now() - cached.at > 60 * 1000) cached = { at: Date.now(), facts: await liveFacts() };
  return cached.facts;
}

async function askClaude(history, f) {
  const response = await getClaude().beta.messages.create({
    model: MODEL,
    max_tokens: 1024, // replies are a few sentences by design
    // Chat replies: low effort keeps them quick and short
    output_config: { effort: "low" },
    // On a safety decline, the API retries on a suitable model by itself
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    cache_control: { type: "ephemeral" },
    system: systemPrompt(f),
    messages: history,
  });
  if (response.stop_reason === "refusal") return { text: null, declined: true };
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text: text || null, model: response.model || MODEL };
}

async function askGemini(history, f) {
  const contents = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  let lastError = null;
  for (const model of GEMINI_MODELS()) {
    try {
      const response = await getGemini().models.generateContent({
        model,
        contents,
        config: { systemInstruction: systemPrompt(f), maxOutputTokens: 1024, temperature: 0.4 },
      });
      const text = (response.text || "").trim();
      // Blocked by Google's safety filter, or cut off: let the rules answer
      if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"].includes(response.candidates?.[0]?.finishReason)) return { text: null, declined: true, model };
      return { text: text || null, model };
    } catch (error) {
      lastError = error;
      // Busy, out of free quota, or retired for new keys: try the next model
      if ([404, 429, 500, 503].includes(error.status)) continue;
      throw error;
    }
  }
  throw lastError || new Error("No Gemini model answered");
}

const logFailure = (name, error) => {
  if (error instanceof Anthropic.AuthenticationError) console.error("Assistant: Anthropic API key was rejected; using built-in answers");
  else if (error instanceof Anthropic.RateLimitError) console.warn("Assistant: Claude rate limited; using built-in answers");
  else if (error instanceof Anthropic.APIError) console.error(`Assistant: Claude API error ${error.status}: ${error.message}`);
  else console.error(`Assistant: ${name} call failed${error.status ? ` (${error.status})` : ""}: ${String(error.message).slice(0, 200)}`);
};

/**
 * Reply to a website visitor. `history` is [{ role: "user"|"assistant",
 * content }] oldest first, ending with the visitor's message.
 * Returns { reply, source: "ai" | "rules", provider?, model?, ms, error?, declined? }
 * and counts it in the stats (track: false for the Super Admin's test chat).
 */
async function chat(history, { track = true } = {}) {
  const recent = history.slice(-HISTORY_TURNS);
  // Both APIs want the conversation to start with the visitor
  while (recent.length && recent[0].role !== "user") recent.shift();
  const f = await facts();

  const started = Date.now();
  const name = provider();
  let outcome = { source: "rules", provider: name || undefined };
  if (name) {
    try {
      const answer = name === "claude" ? await askClaude(recent, f) : await askGemini(recent, f);
      if (answer.text) outcome = { source: "ai", provider: name, model: answer.model, reply: answer.text };
      else outcome.declined = Boolean(answer.declined);
    } catch (error) {
      logFailure(name, error);
      outcome.error = stats.describeError(error);
    }
  }
  outcome.ms = Date.now() - started;
  if (!outcome.reply) outcome.reply = rules.reply(recent, f);
  if (track) await stats.record(outcome);
  return outcome;
}

// What the Super Admin's status screen shows
async function status() {
  return {
    active: provider(),
    setting: process.env.ASSISTANT_PROVIDER || "",
    switchedOff: process.env.ASSISTANT_AI === "off" || String(process.env.ASSISTANT_PROVIDER).toLowerCase() === "off",
    keys: { claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN), gemini: Boolean(process.env.GEMINI_API_KEY) },
    models: { claude: MODEL, gemini: GEMINI_MODELS() },
    rateLimitPerMinute: Number(process.env.ASSISTANT_RATE_LIMIT) || 15,
    ...(await stats.summary(14)),
  };
}

module.exports = {
  chat,
  status,
  aiEnabled,
  provider,
  MODEL,
  _setClient: (c) => (claude = c),
  _setGemini: (g) => (gemini = g),
};
