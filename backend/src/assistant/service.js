const Anthropic = require("@anthropic-ai/sdk");
const os = require("os");
const { GoogleGenAI } = require("@google/genai");
const { liveFacts, systemPrompt } = require("./knowledge");
const rules = require("./rules");
const stats = require("./stats");
const { planQuestions, MAX_QUESTIONS } = require("./planner");
const { executeTaskGraph } = require("./taskExecutor");
const sharedCache = require("../utils/sharedCache");

const MODEL = "claude-opus-5-5";
// Free-tier Gemini models get busy: the next one is tried when one is busy
const GEMINI_MODELS = () => (process.env.GEMINI_MODEL || "gemini-flash-lite-latest,gemini-3-flash-preview,gemini-flash-latest").split(",").map((m) => m.trim()).filter(Boolean);
const HISTORY_TURNS = 12; // the last few messages are enough for a sales chat
const MAX_CONCURRENT_CALLS = (() => {
  const value = Number(process.env.ASSISTANT_MAX_CONCURRENCY || 20);
  if (!Number.isInteger(value) || value < 1 || value > 1000) {
    throw new Error("ASSISTANT_MAX_CONCURRENCY must be an integer between 1 and 1000");
  }
  return value;
})();
const REQUEST_TIMEOUT_MS = (() => {
  const value = Number(process.env.ASSISTANT_REQUEST_TIMEOUT_MS || 20000);
  if (!Number.isInteger(value) || value < 1000 || value > 120000) {
    throw new Error("ASSISTANT_REQUEST_TIMEOUT_MS must be an integer between 1000 and 120000");
  }
  return value;
})();
const MAX_GLOBAL_CONCURRENT_CALLS = (() => {
  const value = Number(process.env.ASSISTANT_GLOBAL_MAX_CONCURRENCY || 50);
  if (!Number.isInteger(value) || value < 1 || value > 10000) {
    throw new Error("ASSISTANT_GLOBAL_MAX_CONCURRENCY must be an integer between 1 and 10000");
  }
  return value;
})();
const MAX_PARALLEL_QUESTIONS = (() => {
  const value = Number(process.env.ASSISTANT_TASK_CONCURRENCY || 3);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error("ASSISTANT_TASK_CONCURRENCY must be an integer between 1 and 10");
  }
  return value;
})();
let activeCalls = 0;

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

function plannedHistory(history, tasks) {
  if (tasks.length < 2) return history;
  return history.map((message, index) => index === history.length - 1 && message.role === "user"
    ? { ...message, content: `${message.content}\n\nAnswer these ${tasks.length} questions in order, using numbered lines:\n${tasks.map((task) => `${task.index + 1}. ${task.question}`).join("\n")}` }
    : message);
}

function normalizeUsage(name, usage = {}) {
  if (name === "claude") {
    return {
      inputTokens: Number(usage.input_tokens) || 0,
      outputTokens: Number(usage.output_tokens) || 0,
    };
  }
  return {
    inputTokens: Number(usage.promptTokenCount) || 0,
    outputTokens: Number(usage.candidatesTokenCount) || 0,
  };
}

function rulesReply(history, facts, tasks) {
  if (tasks.length < 2) return rules.reply(history, facts);
  const lastUserIndex = history.map((message) => message.role).lastIndexOf("user");
  return tasks.map((task) => {
    const questionHistory = history.map((message, index) => index === lastUserIndex ? { ...message, content: task.question } : message);
    return `${task.index + 1}. ${rules.reply(questionHistory, facts)}`;
  }).join("\n");
}

function historyForQuestion(history, question) {
  const lastUserIndex = history.map((message) => message.role).lastIndexOf("user");
  return history.map((message, index) =>
    index === lastUserIndex ? { ...message, content: question } : message,
  );
}

async function askClaude(history, f, signal) {
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
  }, { timeout: REQUEST_TIMEOUT_MS, signal });
  if (response.stop_reason === "refusal") {
    return { text: null, declined: true, usage: normalizeUsage("claude", response.usage) };
  }
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return {
    text: text || null,
    model: response.model || MODEL,
    usage: normalizeUsage("claude", response.usage),
  };
}

async function askGemini(history, f, signal) {
  const contents = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  let lastError = null;
  for (const model of GEMINI_MODELS()) {
    try {
      const response = await getGemini().models.generateContent({
        model,
        contents,
        config: { systemInstruction: systemPrompt(f), maxOutputTokens: 1024, temperature: 0.4, abortSignal: signal, httpOptions: { timeout: REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } } },
      });
      const text = (response.text || "").trim();
      // Blocked by Google's safety filter, or cut off: let the rules answer
      if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"].includes(response.candidates?.[0]?.finishReason)) {
        return { text: null, declined: true, model, usage: normalizeUsage("gemini", response.usageMetadata) };
      }
      return { text: text || null, model, usage: normalizeUsage("gemini", response.usageMetadata) };
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError") throw error;
      lastError = error;
      // Busy, out of free quota, or retired for new keys: try the next model
      if ([404, 429, 500, 503].includes(error.status)) continue;
      throw error;
    }
  }
  throw lastError || new Error("No Gemini model answered");
}

async function answerQuestion(task, history, f, signal) {
  const selectedProvider = provider();
  const taskHistory = historyForQuestion(history, task.question);
  let answer;
  let error;
  let declined = false;
  const modelStarted = Date.now();

  if (selectedProvider) {
    if (activeCalls >= MAX_CONCURRENT_CALLS) {
      error = { code: "CAPACITY", message: "Assistant concurrency limit reached" };
    } else {
      activeCalls += 1;
      let globalLease;
      try {
        globalLease = await sharedCache.acquireSemaphore(
          "assistant-provider",
          MAX_GLOBAL_CONCURRENT_CALLS,
          REQUEST_TIMEOUT_MS + 5000,
        );
        if (globalLease === false) {
          error = { code: "CAPACITY", message: "Global assistant concurrency limit reached" };
        } else {
          answer = selectedProvider === "claude"
            ? await askClaude(taskHistory, f, signal)
            : await askGemini(taskHistory, f, signal);
          answer.modelMs = Date.now() - modelStarted;
          declined = Boolean(answer.declined);
        }
      } catch (providerError) {
        if (signal?.aborted || providerError.name === "AbortError") throw providerError;
        logFailure(selectedProvider, providerError);
        error = stats.describeError(providerError);
      } finally {
        if (typeof globalLease === "function") await globalLease();
        activeCalls -= 1;
      }
    }
  }

  if (answer?.text && !answer.declined) {
    return {
      reply: answer.text,
      source: "ai",
      provider: selectedProvider,
      model: answer.model,
      modelMs: answer.modelMs || 0,
      usage: answer.usage,
    };
  }
  if (declined) error = { code: "DECLINED", message: "The provider safety filter declined this question" };
  return {
    reply: rules.reply(taskHistory, f),
    source: "rules",
    provider: selectedProvider || undefined,
    model: answer?.model,
    modelMs: answer?.modelMs || 0,
    usage: answer?.usage,
    error,
    declined,
  };
}

async function answerQuestionTasks(
  history,
  f,
  tasks,
  { signal, onTaskStarted, onTaskCompleted, onReplace } = {},
) {
  const replies = new Map();
  const outcomes = await executeTaskGraph(
    tasks,
    (task, options) => answerQuestion(task, history, f, options.signal),
    {
      concurrency: Math.min(MAX_PARALLEL_QUESTIONS, MAX_CONCURRENT_CALLS),
      signal,
      onTaskStarted,
      onTaskCompleted: async (task, outcome) => {
        if (outcome.result?.reply) replies.set(task.id, outcome.result.reply);
        const partial = tasks
          .filter((entry) => replies.has(entry.id))
          .map((entry) => `${entry.index + 1}. ${replies.get(entry.id)}`)
          .join("\n");
        if (partial) await onReplace?.(partial);
        await onTaskCompleted?.(task, outcome);
      },
    },
  );
  const byId = new Map(outcomes.map((outcome) => [outcome.taskId, outcome]));
  const taskResults = tasks.map((task) => {
    const outcome = byId.get(task.id);
    return {
      taskId: task.id,
      status: outcome?.status || "failed",
      source: outcome?.result?.source || null,
      errorCode: outcome?.result?.error?.code || (outcome?.error ? "TASK_FAILED" : null),
    };
  });
  const results = tasks.map((task) => byId.get(task.id)?.result);
  const errors = results.map((result) => result?.error).filter(Boolean);
  const aiResults = results.filter((result) => result?.source === "ai");
  const totalModelMs = results.reduce((sum, result) => sum + (result?.modelMs || 0), 0);
  const usage = results.reduce(
    (total, result) => ({
      inputTokens: total.inputTokens + (result?.usage?.inputTokens || 0),
      outputTokens: total.outputTokens + (result?.usage?.outputTokens || 0),
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
  const reply = tasks
    .map((task) => {
      const result = byId.get(task.id)?.result;
      return `${task.index + 1}. ${result?.reply || "I couldn't answer this question right now."}`;
    })
    .join("\n");
  return {
    reply,
    source: aiResults.length ? "ai" : "rules",
    provider: aiResults[0]?.provider || results.find((result) => result?.provider)?.provider,
    model: aiResults[0]?.model,
    error: errors[0],
    declined: results.some((result) => result?.declined),
    questionCount: tasks.length,
    taskResults,
    modelMs: totalModelMs,
    usage,
  };
}

async function streamClaude(history, f, onDelta, signal) {
  const stream = await getClaude().beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    cache_control: { type: "ephemeral" },
    system: systemPrompt(f),
    messages: history,
    stream: true,
  }, { signal });
  let text = "";
  let model = MODEL;
  let declined = false;
  let rawUsage = {};
  for await (const event of stream) {
    if (signal?.aborted) throw Object.assign(new Error("Request cancelled"), { name: "AbortError" });
    if (event.type === "message_start") {
      model = event.message?.model || model;
      rawUsage = { ...rawUsage, ...(event.message?.usage || {}) };
    }
    if (event.type === "message_delta") {
      rawUsage = { ...rawUsage, ...(event.usage || {}) };
      if (event.delta?.stop_reason === "refusal") declined = true;
    }
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
      text += event.delta.text;
      await onDelta(event.delta.text);
    }
  }
  return { text: text.trim(), model, declined, usage: normalizeUsage("claude", rawUsage) };
}

async function streamGemini(history, f, onDelta, signal) {
  const contents = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  let lastError = null;
  for (const model of GEMINI_MODELS()) {
    let text = "";
    try {
      const stream = await getGemini().models.generateContentStream({
        model,
        contents,
        config: { systemInstruction: systemPrompt(f), maxOutputTokens: 1024, temperature: 0.4, abortSignal: signal, httpOptions: { timeout: REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } } },
      });
      let declined = false;
      let usageMetadata = {};
      for await (const chunk of stream) {
        if (signal?.aborted) throw Object.assign(new Error("Request cancelled"), { name: "AbortError" });
        const reason = chunk.candidates?.[0]?.finishReason;
        usageMetadata = { ...usageMetadata, ...(chunk.usageMetadata || {}) };
        if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"].includes(reason)) declined = true;
        const delta = chunk.text || "";
        if (delta) {
          text += delta;
          await onDelta(delta);
        }
      }
      return { text: text.trim(), model, declined, usage: normalizeUsage("gemini", usageMetadata) };
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError") throw error;
      lastError = error;
      if (text || ![404, 429, 500, 503].includes(error.status)) throw error;
    }
  }
  throw lastError || new Error("No Gemini model answered");
}

async function streamChat(
  history,
  {
    onDelta = async () => {},
    onReplace = async () => {},
    onTaskStarted,
    onTaskCompleted,
    signal,
    track = true,
    traceId,
  } = {},
) {
  const recent = history.slice(-HISTORY_TURNS);
  while (recent.length && recent[0].role !== "user") recent.shift();
  const started = Date.now();
  const factsStarted = Date.now();
  const f = await facts();
  const factsMs = Date.now() - factsStarted;
  const latest = [...recent].reverse().find((m) => m.role === "user")?.content || "";
  const plan = planQuestions(latest);
  if (plan.overflow) {
    const reply = rules.languageOf(latest) === "hi"
      ? `Ek baar mein ${MAX_QUESTIONS} tak sawaal bhejiye, main har ek ka saaf jawab de paunga.`
      : `Please send up to ${MAX_QUESTIONS} questions at a time so I can answer each one clearly.`;
    await onDelta(reply);
    const result = { reply, source: "rules", ms: Date.now() - started, factsMs, questionCount: plan.tasks.length, error: { code: "QUESTION_LIMIT" } };
    if (track) await stats.record(result);
    console.info(JSON.stringify({ event: "assistant.request.completed", requestId: traceId || null, source: "rules", questionCount: result.questionCount, timings: { factsMs, modelMs: 0, totalMs: result.ms }, errorCode: "QUESTION_LIMIT" }));
    return result;
  }

  if (plan.tasks.length === 1) await onTaskStarted?.(plan.tasks[0]);
  if (plan.tasks.length > 1) {
    const result = await answerQuestionTasks(recent, f, plan.tasks, {
      signal,
      onTaskStarted,
      onTaskCompleted,
      onReplace,
    });
    result.ms = Date.now() - started;
    result.factsMs = factsMs;
    if (track) await stats.record(result);
    console.info(JSON.stringify({
      event: "assistant.request.completed",
      requestId: traceId || null,
      source: result.source,
      provider: result.provider || null,
      questionCount: result.questionCount,
      taskResults: result.taskResults,
      timings: { factsMs, modelMs: result.modelMs, totalMs: result.ms },
      errorCode: result.error?.code || null,
    }));
    return result;
  }

  const name = provider();
  let outcome = { source: "rules", provider: name || undefined };
  const release = !name || activeCalls >= MAX_CONCURRENT_CALLS ? null : (activeCalls += 1, true);
  if (name && !release) outcome.error = { code: "CAPACITY", message: "Assistant concurrency limit reached" };
  if (release) {
    let streamed = "";
    const modelStarted = Date.now();
    const requestAbort = new AbortController();
    const abortFromClient = () => requestAbort.abort(signal?.reason);
    signal?.addEventListener("abort", abortFromClient, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; requestAbort.abort(); }, REQUEST_TIMEOUT_MS);
    if (timeout.unref) timeout.unref();
    const delta = async (part) => { streamed += part; await onDelta(part); };
    let globalLease;
    try {
      globalLease = await sharedCache.acquireSemaphore("assistant-provider", MAX_GLOBAL_CONCURRENT_CALLS, REQUEST_TIMEOUT_MS + 5000);
      if (globalLease === false) {
        outcome.error = { code: "CAPACITY", message: "Global assistant concurrency limit reached" };
      } else {
        const promptHistory = plannedHistory(recent, plan.tasks);
        const answer = name === "claude"
          ? await streamClaude(promptHistory, f, delta, requestAbort.signal)
          : await streamGemini(promptHistory, f, delta, requestAbort.signal);
        if (answer.text && !answer.declined) outcome = { source: "ai", provider: name, model: answer.model, reply: answer.text, usage: answer.usage };
        else {
          outcome.declined = Boolean(answer.declined);
          outcome.usage = answer.usage;
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      if (timedOut) outcome.error = { code: "TIMEOUT", message: "Assistant provider timed out" };
      else {
        logFailure(name, error);
        outcome.error = stats.describeError(error);
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromClient);
      if (typeof globalLease === "function") await globalLease();
      activeCalls -= 1;
    }
    outcome.modelMs = Date.now() - modelStarted;
    if (!outcome.reply && streamed) {
      // If a provider failed after sending partial text, replace it atomically
      // with the deterministic fallback instead of mixing two answers.
      outcome.reply = rulesReply(recent, f, plan.tasks);
      await onReplace(outcome.reply);
    }
  }
  if (!outcome.reply) {
    outcome.reply = plan.overflow
      ? (rules.languageOf(latest) === "hi" ? `Ek baar mein ${MAX_QUESTIONS} tak sawaal bhejiye, main har ek ka saaf jawab de paunga.` : `Please send up to ${MAX_QUESTIONS} questions at a time so I can answer each one clearly.`)
      : rulesReply(recent, f, plan.tasks);
    await onDelta(outcome.reply);
  }
  outcome.ms = Date.now() - started;
  outcome.factsMs = factsMs;
  outcome.questionCount = plan.tasks.length;
  outcome.taskResults = [{ taskId: plan.tasks[0].id, status: "completed", source: outcome.source, errorCode: outcome.error?.code || null }];
  if (plan.tasks.length === 1) {
    await onTaskCompleted?.(plan.tasks[0], {
      taskId: plan.tasks[0].id,
      status: "completed",
      result: { source: outcome.source, error: outcome.error },
    });
  }
  if (track) await stats.record(outcome);
  console.info(JSON.stringify({ event: "assistant.request.completed", requestId: traceId || null, source: outcome.source, provider: outcome.provider || null, questionCount: outcome.questionCount, timings: { factsMs, modelMs: outcome.modelMs || 0, totalMs: outcome.ms }, errorCode: outcome.error?.code || null }));
  return outcome;
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
async function chat(history, { track = true, traceId } = {}) {
  const recent = history.slice(-HISTORY_TURNS);
  // Both APIs want the conversation to start with the visitor
  while (recent.length && recent[0].role !== "user") recent.shift();
  const started = Date.now();
  const factsStarted = Date.now();
  const f = await facts();
  const factsMs = Date.now() - factsStarted;
  const latest = [...recent].reverse().find((m) => m.role === "user")?.content || "";
  const plan = planQuestions(latest);
  if (plan.tasks.length > 1 && !plan.overflow) {
    const result = await answerQuestionTasks(recent, f, plan.tasks);
    result.ms = Date.now() - started;
    result.factsMs = factsMs;
    if (track) await stats.record(result);
    console.info(JSON.stringify({
      event: "assistant.request.completed",
      requestId: traceId || null,
      source: result.source,
      provider: result.provider || null,
      questionCount: result.questionCount,
      taskResults: result.taskResults,
      timings: { factsMs, modelMs: result.modelMs, totalMs: result.ms },
      errorCode: result.error?.code || null,
    }));
    return result;
  }
  const name = provider();
  let outcome = { source: "rules", provider: name || undefined };
  if (plan.overflow) {
    outcome.error = { code: "QUESTION_LIMIT", message: `Maximum ${MAX_QUESTIONS} questions per request` };
  } else if (name) {
    if (activeCalls >= MAX_CONCURRENT_CALLS) {
      outcome.error = { code: "CAPACITY", message: "Assistant concurrency limit reached" };
    } else {
      activeCalls += 1;
      let globalLease;
      try {
        globalLease = await sharedCache.acquireSemaphore("assistant-provider", MAX_GLOBAL_CONCURRENT_CALLS, REQUEST_TIMEOUT_MS + 5000);
        if (globalLease !== false) {
          const answer = name === "claude" ? await askClaude(plannedHistory(recent, plan.tasks), f) : await askGemini(plannedHistory(recent, plan.tasks), f);
          if (answer.text) outcome = { source: "ai", provider: name, model: answer.model, reply: answer.text, usage: answer.usage };
          else {
            outcome.declined = Boolean(answer.declined);
            outcome.usage = answer.usage;
          }
        } else outcome.error = { code: "CAPACITY", message: "Global assistant concurrency limit reached" };
      } catch (error) {
        logFailure(name, error);
        outcome.error = stats.describeError(error);
      } finally {
        if (typeof globalLease === "function") await globalLease();
        activeCalls -= 1;
      }
    }
  }
  outcome.ms = Date.now() - started;
  outcome.factsMs = factsMs;
  if (!outcome.reply) outcome.reply = plan.overflow
    ? `Please send up to ${MAX_QUESTIONS} questions at a time so I can answer each one clearly.`
    : rulesReply(recent, f, plan.tasks);
  outcome.questionCount = plan.tasks.length;
  if (track) await stats.record(outcome);
  console.info(JSON.stringify({ event: "assistant.request.completed", requestId: traceId || null, source: outcome.source, provider: outcome.provider || null, questionCount: outcome.questionCount, timings: { totalMs: outcome.ms }, errorCode: outcome.error?.code || null }));
  return outcome;
}

// What the Super Admin's status screen shows
async function status() {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    active: provider(),
    setting: process.env.ASSISTANT_PROVIDER || "",
    switchedOff: process.env.ASSISTANT_AI === "off" || String(process.env.ASSISTANT_PROVIDER).toLowerCase() === "off",
    keys: { claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN), gemini: Boolean(process.env.GEMINI_API_KEY) },
    models: { claude: MODEL, gemini: GEMINI_MODELS() },
    rateLimitPerMinute: Number(process.env.ASSISTANT_RATE_LIMIT) || 15,
    maxConcurrentCalls: MAX_CONCURRENT_CALLS,
    globalMaxConcurrentCalls: MAX_GLOBAL_CONCURRENT_CALLS,
    sharedConcurrencyEnabled: Boolean(process.env.REDIS_URL),
    sharedRateLimitEnabled: Boolean(process.env.REDIS_URL),
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    maxQuestionsPerRequest: MAX_QUESTIONS,
    parallelQuestionConcurrency: MAX_PARALLEL_QUESTIONS,
    activeCalls,
    cache: sharedCache.metrics(),
    runtime: {
      memoryRssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      uptimeSeconds: Math.floor(process.uptime()),
      logicalCpus: os.cpus().length,
    },
    ...(await stats.summary(14)),
  };
}

module.exports = {
  chat,
  streamChat,
  status,
  aiEnabled,
  provider,
  MODEL,
  _setClient: (c) => (claude = c),
  _setGemini: (g) => (gemini = g),
};
