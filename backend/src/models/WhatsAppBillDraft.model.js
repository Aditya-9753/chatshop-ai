const mongoose = require("mongoose");

const billDraftSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    items: [
      {
        _id: false,
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        qty: { type: Number, required: true, min: 1, max: 10 },
        quotedName: { type: String, required: true },
        quotedPrice: { type: Number, required: true },
      },
    ],
    dueDate: { type: String, required: true },
    grossTotal: { type: Number, required: true },
    customerStateCode: { type: String, required: true },
    interState: { type: Boolean, required: true },
    confirmationHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "issuing", "issued", "cancelled", "expired"],
      default: "pending",
    },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

billDraftSchema.index({ tenantId: 1, customerId: 1, status: 1, expiresAt: -1 });
billDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("WhatsAppBillDraft", billDraftSchema);
