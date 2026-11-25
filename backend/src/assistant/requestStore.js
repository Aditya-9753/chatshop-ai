const AssistantRequest = require("./request.model");

const RETENTION_MS = 24 * 60 * 60 * 1000;

async function create(requestId, questionCount, idempotencyKey = requestId) {
  try {
    const idempotencyKeyHash = AssistantRequest.hashIdempotencyKey(idempotencyKey);
    await AssistantRequest.deleteOne({ idempotencyKeyHash, expiresAt: { $lte: new Date() } });
    const request = await AssistantRequest.findOneAndUpdate(
      { idempotencyKeyHash },
      { $setOnInsert: { requestId, idempotencyKeyHash, questionCount, status: "processing", expiresAt: new Date(Date.now() + RETENTION_MS) } },
      { upsert: true, new: true },
    ).lean();
    return { created: request.requestId === requestId, request };
  } catch (error) {
    if (error.code === 11000) {
      const existing = await AssistantRequest.findOne({ idempotencyKeyHash: AssistantRequest.hashIdempotencyKey(idempotencyKey) }).lean();
      if (existing) return { created: false, request: existing };
    }
    console.warn("Assistant request record could not be created:", error.message);
    return { created: true, request: null };
  }
}

async function complete(requestId, result) {
  try {
    await AssistantRequest.updateOne({ requestId, status: "processing" }, { $set: {
      status: "completed",
      questionCount: result.questionCount || 0,
      provider: result.provider || null,
      model: result.model || null,
      source: result.source,
      taskResults: (result.taskResults || []).map(({ taskId, status, source, errorCode }) => ({
        taskId,
        status,
        source: source || null,
        errorCode: errorCode || null,
      })),
      reply: String(result.reply || "").slice(0, 12000),
      errorCode: result.error?.code || null,
      timings: { factsMs: result.factsMs || 0, totalMs: result.ms || 0, modelMs: result.modelMs || 0 },
      completedAt: new Date(),
    } });
  } catch (error) {
    console.warn("Assistant request result could not be persisted:", error.message);
  }
}

async function recordTaskResult(requestId, outcome) {
  try {
    await AssistantRequest.updateOne(
      { requestId, status: "processing" },
      {
        $push: {
          taskResults: {
            taskId: outcome.taskId,
            status: outcome.status,
            source: outcome.result?.source || null,
            errorCode: outcome.result?.error?.code || (outcome.error ? "TASK_FAILED" : null),
          },
        },
      },
    );
  } catch (error) {
    console.warn("Assistant task status could not be persisted:", error.message);
  }
}

async function setStatus(requestId, status, errorCode) {
  try {
    const result = await AssistantRequest.updateOne({ requestId, status: { $in: ["accepted", "processing"] } }, { $set: { status, errorCode: errorCode || null } });
    return result.modifiedCount > 0;
  } catch (error) {
    console.warn("Assistant request status could not be persisted:", error.message);
    return false;
  }
}

async function get(requestId) {
  return AssistantRequest.findOne({ requestId, expiresAt: { $gt: new Date() } })
    .select("requestId status questionCount taskResults provider model source reply errorCode timings createdAt completedAt")
    .lean();
}

module.exports = { create, complete, recordTaskResult, setStatus, get };
