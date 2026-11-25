const express = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { protect } = require("../middleware/auth.middleware");
const { isAdmin, superAdminOnly } = require("../middleware/admin.middleware");
const assistant = require("./service");
const { planQuestions, MAX_QUESTIONS } = require("./planner");
const requestStore = require("./requestStore");
const AssistantRateLimitStore = require("./rateLimitStore");
const activeRequests = new Map();
const webhookQueue = require("../services/whatsappWebhookQueue.service");
const billQueue = require("../services/whatsappBillQueue.service");

// Website help chat (public: visitors aren't signed in)
const router = express.Router();

// Each AI reply costs money: a visitor gets a few messages a minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.ASSISTANT_RATE_LIMIT) || 15,
  store: new AssistantRateLimitStore(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Thoda ruk kar dobara poochiye. / Please wait a moment and try again." },
});

const ChatIn = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(30)
    .refine((m) => m[m.length - 1]?.role === "user", "The last message must be the visitor's"),
});

router.post("/chat", limiter, async (req, res) => {
  try {
    const parsed = ChatIn.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    const idempotencyKey = req.get("Idempotency-Key") || req.requestId;
    if (idempotencyKey.length > 128 || idempotencyKey.length < 8) return res.status(400).json({ success: false, message: "Invalid Idempotency-Key" });
    const latest = parsed.data.messages[parsed.data.messages.length - 1].content;
    const plan = planQuestions(latest);
    const claim = await requestStore.create(req.requestId, plan.tasks.length, idempotencyKey);
    if (!claim.created) {
      if (claim.request.status === "completed") return res.json({ success: true, data: { requestId: claim.request.requestId, reply: claim.request.reply, source: claim.request.source, provider: claim.request.provider || undefined } });
      return res.status(409).json({ success: false, message: "This request is already being processed.", requestId: claim.request.requestId });
    }
    const requestId = claim.request?.requestId || req.requestId;
    const result = await assistant.chat(parsed.data.messages, { traceId: requestId });
    await requestStore.complete(requestId, result);
    // Visitors see the answer only, never why the AI failed
    res.json({ success: true, data: { requestId, reply: result.reply, source: result.source, provider: result.source === "ai" ? result.provider : undefined } });
  } catch (error) {
    await requestStore.setStatus(req.requestId, "failed", "ASSISTANT_ERROR");
    console.error("Assistant error:", error);
    res.status(500).json({ success: false, message: "Abhi jawab nahi de pa raha. / I can't answer right now." });
  }
});

router.post("/chat/stream", limiter, async (req, res) => {
  const abortController = new AbortController();
  let closed = false;
  let heartbeat;
  let cancellationPoll;
  const send = (event, data) => {
    if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    const parsed = ChatIn.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });

    const requestIdFromMiddleware = req.requestId;
    const latest = parsed.data.messages[parsed.data.messages.length - 1].content;
    const plan = planQuestions(latest);
    if (plan.overflow) return res.status(400).json({ success: false, message: `Send up to ${MAX_QUESTIONS} questions at a time.` });
    const idempotencyKey = req.get("Idempotency-Key") || requestIdFromMiddleware;
    if (idempotencyKey.length > 128 || idempotencyKey.length < 8) return res.status(400).json({ success: false, message: "Invalid Idempotency-Key" });
    const claim = await requestStore.create(requestIdFromMiddleware, plan.tasks.length, idempotencyKey);
    const requestId = claim.request?.requestId || requestIdFromMiddleware;
    if (!claim.created && claim.request?.status !== "completed") {
      const message = claim.request?.status === "processing" ? "This request is already being processed." : "This request has already finished.";
      return res.status(409).json({ success: false, message, requestId });
    }

    res.status(200);
    res.set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    send("request.accepted", { requestId });
    send("plan.created", { requestId, tasks: plan.tasks.map(({ id, index, intent, dependsOn }) => ({ id, questionIndex: index, label: intent, dependsOn })) });
    if (!claim.created && claim.request?.status === "completed") {
      plan.tasks.forEach((task) => send("task.started", { requestId, taskId: task.id, questionIndex: task.index, label: task.intent }));
      send("answer.delta", { text: claim.request.reply || "" });
      plan.tasks.forEach((task) => send("answer.question.completed", { requestId, taskId: task.id, questionIndex: task.index }));
      send("request.completed", { requestId, status: "completed", reply: claim.request.reply, source: claim.request.source, provider: claim.request.provider || undefined, questionCount: claim.request.questionCount });
      return res.end();
    }
    heartbeat = setInterval(() => { if (!res.writableEnded) res.write(": keep-alive\n\n"); }, 15000);
    if (heartbeat.unref) heartbeat.unref();
    let checkingCancellation = false;
    cancellationPoll = setInterval(async () => {
      if (checkingCancellation || abortController.signal.aborted) return;
      checkingCancellation = true;
      try {
        const status = await requestStore.get(requestId);
        if (status?.status === "cancelled") abortController.abort();
      } catch { /* A temporary status read failure does not interrupt generation. */ }
      finally { checkingCancellation = false; }
    }, 1000);
    if (cancellationPoll.unref) cancellationPoll.unref();
    res.on("close", () => {
      closed = true;
      clearInterval(heartbeat);
      clearInterval(cancellationPoll);
      // A dropped connection must stop the provider call too; otherwise it
      // keeps using quota and a concurrency slot until the provider timeout.
      if (!res.writableEnded && !abortController.signal.aborted) {
        abortController.abort();
        requestStore.setStatus(requestId, "cancelled", "CLIENT_DISCONNECTED");
      }
    });

    activeRequests.set(requestId, abortController);
    const result = await assistant.streamChat(parsed.data.messages, {
      signal: abortController.signal,
      traceId: requestId,
      onDelta: async (text) => send("answer.delta", { text }),
      onReplace: async (text) => send("answer.replace", { text }),
      onTaskStarted: async (task) => send("task.started", { requestId, taskId: task.id, questionIndex: task.index, label: task.intent }),
      onTaskCompleted: async (task, outcome) => {
        await requestStore.recordTaskResult(requestId, outcome);
        send("answer.question.completed", {
          requestId,
          taskId: task.id,
          questionIndex: task.index,
          status: outcome.status,
          source: outcome.result?.source || null,
          errorCode: outcome.result?.error?.code || (outcome.error ? "TASK_FAILED" : null),
        });
      },
    });
    const currentRequest = await requestStore.get(requestId);
    if (closed || abortController.signal.aborted || currentRequest?.status === "cancelled") {
      activeRequests.delete(requestId);
      clearInterval(cancellationPoll);
      await requestStore.setStatus(requestId, "cancelled", "CLIENT_DISCONNECTED");
      if (!closed) {
        send("request.failed", { requestId, code: "CANCELLED", retryable: false });
        res.end();
      }
      return;
    }
    await requestStore.complete(requestId, result);
    activeRequests.delete(requestId);
    clearInterval(cancellationPoll);
    if (!closed && !abortController.signal.aborted) {
      send("request.completed", { requestId, status: "completed", reply: result.reply, source: result.source, provider: result.source === "ai" ? result.provider : undefined, model: result.model || undefined, questionCount: result.questionCount, taskResults: result.taskResults, timings: { factsMs: result.factsMs, modelMs: result.modelMs || 0, totalMs: result.ms } });
      res.end();
    }
    clearInterval(heartbeat);
  } catch (error) {
    clearInterval(heartbeat);
    clearInterval(cancellationPoll);
    activeRequests.delete(req.requestId);
    if (error.name === "AbortError" || abortController.signal.aborted) {
      await requestStore.setStatus(req.requestId, "cancelled", "CANCELLED");
      if (!closed) {
        send("request.failed", { requestId: req.requestId, code: "CANCELLED", retryable: false });
        res.end();
      }
      return;
    }
    await requestStore.setStatus(req.requestId, "failed", "ASSISTANT_ERROR");
    if (!res.headersSent) return res.status(500).json({ success: false, message: "The assistant could not answer right now." });
    send("request.failed", { requestId: req.requestId, code: "ASSISTANT_ERROR", retryable: true });
    res.end();
  }
});

router.get("/requests/:requestId", limiter, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid request ID" });
  try {
    const request = await requestStore.get(req.params.requestId);
    if (!request) return res.status(404).json({ success: false, message: "Request not found or expired" });
    res.set("Cache-Control", "private, no-store");
    res.json({ success: true, data: request });
  } catch (error) {
    console.error("Assistant request lookup failed:", error.message);
    res.status(503).json({ success: false, message: "Request status is temporarily unavailable" });
  }
});

router.delete("/requests/:requestId", limiter, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid request ID" });
  let request;
  try { request = await requestStore.get(req.params.requestId); }
  catch (error) { return res.status(503).json({ success: false, message: "Request status is temporarily unavailable" }); }
  if (!request || request.status !== "processing") return res.status(404).json({ success: false, message: "No active request found" });
  const controller = activeRequests.get(req.params.requestId);
  if (controller) {
    activeRequests.delete(req.params.requestId);
    controller.abort();
  }
  const cancelled = await requestStore.setStatus(req.params.requestId, "cancelled", "CANCELLED");
  if (!cancelled) return res.status(409).json({ success: false, message: "The request already finished" });
  res.status(202).json({ success: true, data: { requestId: req.params.requestId, status: "cancelled" } });
});

// Super Admin: is the AI working, and a test chat that doesn't count in the stats
const admin = express.Router();
admin.use(protect, isAdmin, superAdminOnly);

admin.get("/status", async (req, res) => {
  try {
    const [data, webhookQueueStatus, billQueueStatus, productEmbeddingQueueStatus] = await Promise.all([
      assistant.status(),
      webhookQueue.status(),
      billQueue.status(),
      require("../services/productEmbeddingQueue.service").status(),
    ]);
    res.json({
      success: true,
      data: {
        ...data,
        whatsappWebhookQueue: webhookQueueStatus,
        whatsappBillQueue: billQueueStatus,
        productEmbeddingQueue: productEmbeddingQueueStatus,
      },
    });
  } catch (error) {
    console.error("Assistant status error:", error);
    res.status(500).json({ success: false, message: "Couldn't load the assistant status" });
  }
});

admin.post("/test", async (req, res) => {
  try {
    const parsed = ChatIn.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    res.json({ success: true, data: await assistant.chat(parsed.data.messages, { track: false, traceId: req.requestId }) });
  } catch (error) {
    console.error("Assistant test error:", error);
    res.status(500).json({ success: false, message: "The test chat failed" });
  }
});

module.exports = { router, admin };
