const mongoose = require("mongoose");

const usageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, default: 0 },
    deleteAfter: { type: Date, required: true },
  },
  { timestamps: true },
);

usageSchema.index({ userId: 1, windowStart: 1 }, { unique: true });
usageSchema.index({ deleteAfter: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("WhatsAppAIUsage", usageSchema);
