const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
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
    phone: {
      type: String,
      required: true,
    },
    email: String,
    platform: {
      type: String,
      enum: ["whatsapp", "instagram"],
      required: true,
    },
    platformId: String, // WhatsApp/Instagram User ID
    tags: [String],
    notes: String,
    lastMessageDate: Date,
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ userId: 1, phone: 1 });
customerSchema.index({ userId: 1, platform: 1 });

module.exports = mongoose.model("Customer", customerSchema);
