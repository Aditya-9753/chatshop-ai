const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      // "store": a counter sale billed in EMI & billing
      enum: ["whatsapp", "instagram", "facebook", "store"],
      required: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        quantity: Number,
        price: Number,
        total: Number,
      },
    ],
    subtotal: Number,
    tax: { type: Number, default: 0 },
    // gst | cgst_sgst | custom | none; taxRate is the percentage applied
    taxType: { type: String, enum: ["gst", "cgst_sgst", "custom", "none"], default: "gst" },
    taxRate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "upi", "razorpay", "other"],
      default: "cod",
    },
    shippingAddress: {
      name: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
    },
    notes: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }, // store sale's GST invoice
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ userId: 1, status: 1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });

module.exports = mongoose.model("Order", orderSchema);
