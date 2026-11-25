const mongoose = require("mongoose");

const webhookLockSchema = new mongoose.Schema(
  {
    partitionKey: { type: String, required: true, unique: true },
    leaseOwner: { type: String, required: true },
    leaseExpiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

webhookLockSchema.index({ leaseExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models["WhatsAppWebhookLock"] || mongoose.model("WhatsAppWebhookLock", webhookLockSchema);
