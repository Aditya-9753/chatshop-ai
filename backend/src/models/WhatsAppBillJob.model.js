const mongoose = require("mongoose");

const billJobSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    idempotencyKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },
    attempts: { type: Number, default: 0 },
    availableAt: { type: Date, default: Date.now },
    leaseExpiresAt: Date,
    pdfFileId: { type: mongoose.Schema.Types.ObjectId },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    lastError: String,
    deleteAfter: Date,
  },
  { timestamps: true },
);

billJobSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
billJobSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
billJobSchema.index({ deleteAfter: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("WhatsAppBillJob", billJobSchema);
