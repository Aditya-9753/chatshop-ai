const mongoose = require("mongoose");

const webhookJobSchema = new mongoose.Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true },
    partitionKey: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    availableAt: { type: Date, default: Date.now },
    leaseOwner: String,
    leaseExpiresAt: Date,
    deleteAfter: Date,
    lastError: String,
    completedAt: Date,
  },
  { timestamps: true },
);

webhookJobSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
webhookJobSchema.index({ partitionKey: 1, status: 1, createdAt: 1 });
webhookJobSchema.index({ deleteAfter: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models["WhatsAppWebhookJob"] || mongoose.model("WhatsAppWebhookJob", webhookJobSchema);
