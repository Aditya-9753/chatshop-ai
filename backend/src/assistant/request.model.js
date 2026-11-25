const mongoose = require("mongoose");
const crypto = require("crypto");

const assistantRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  idempotencyKeyHash: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ["accepted", "processing", "completed", "failed", "cancelled"], default: "accepted", index: true },
  questionCount: { type: Number, default: 0 },
  provider: { type: String, default: null },
  model: { type: String, default: null },
  source: { type: String, enum: ["ai", "rules"], default: null },
  taskResults: [{
    _id: false,
    taskId: String,
    status: { type: String, enum: ["completed", "failed", "blocked"] },
    source: { type: String, enum: ["ai", "rules", null], default: null },
    errorCode: { type: String, default: null },
  }],
  reply: { type: String, default: null },
  errorCode: { type: String, default: null },
  timings: { factsMs: Number, modelMs: Number, totalMs: Number },
  completedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

assistantRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
assistantRequestSchema.statics.hashIdempotencyKey = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

module.exports = mongoose.models.AssistantRequest || mongoose.model("AssistantRequest", assistantRequestSchema);
