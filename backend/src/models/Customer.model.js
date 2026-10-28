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
      required: false, // Optional for Facebook/Instagram users
    },
    email: String,
    platform: {
      type: String,
      enum: ["whatsapp", "instagram", "facebook"],
      required: true,
    },
    platformId: String, // WhatsApp/Instagram/Facebook User ID
    tags: [String],
    notes: String,
    lastMessageDate: Date,
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    // KYC and billing details used by EMI & billing
    pan: { type: String, uppercase: true, trim: true },
    address: String,
    stateCode: String, // GST state code, decides CGST+SGST or IGST
    gstin: { type: String, uppercase: true, trim: true },
    kycStatus: { type: String, enum: ["NONE", "PENDING", "VERIFIED", "REJECTED"], default: "NONE" },
    kycDocs: [
      {
        _id: false,
        type: { type: String, enum: ["PAN", "AADHAAR", "VOTER_ID", "PASSPORT", "DRIVING_LICENCE", "OTHER"] },
        number: String,
        url: String,
        addedAt: { type: Date, default: Date.now },
      },
    ],
    kycVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    kycVerifiedAt: Date,
    riskGrade: { type: String, enum: ["A", "B", "C", "D"], default: "B" },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ userId: 1, phone: 1 });
customerSchema.index({ userId: 1, platform: 1 });

module.exports = mongoose.model("Customer", customerSchema);
