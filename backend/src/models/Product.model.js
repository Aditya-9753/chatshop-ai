const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
    },
    comparePrice: Number, // Original price for discounts
    images: [String],
    category: String,
    sku: String,
    stock: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [String],
    vectorEmbedding: {
      type: [Number],
      default: undefined,
      select: false,
    },
    embeddingModel: { type: String, select: false },
    embeddingContentHash: { type: String, select: false },
    embeddingStatus: {
      type: String,
      enum: ["pending", "ready", "failed", "disabled"],
      default: "disabled",
      select: false,
    },
    // GST invoice details; serialized products (phones) are sold by IMEI
    hsn: { type: String, trim: true },
    gstRatePct: { type: Number, enum: [0, 5, 12, 18, 28], default: 18 },
    serialized: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ userId: 1, isActive: 1 });
productSchema.index(
  { userId: 1, isActive: 1, name: "text", description: "text", category: "text", tags: "text" },
  { name: "shop_active_product_text" },
);

module.exports = mongoose.models["Product"] || mongoose.model("Product", productSchema);
