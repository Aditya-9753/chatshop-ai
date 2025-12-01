const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
    },
    profilePhoto: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    subscription: {
      plan: {
        type: String,
        enum: ["starter", "business", "premium", "one-time", null],
        default: null,
      },
      status: {
        type: String,
        enum: ["active", "inactive", "cancelled", "expired"],
        default: "inactive",
      },
      startDate: Date,
      endDate: Date,
      razorpaySubscriptionId: String,
      razorpayCustomerId: String,
    },
    whatsappConfig: {
      isConnected: { type: Boolean, default: false },
      phoneNumber: String,
      businessAccountId: String,
      accessToken: String,
      webhookVerifyToken: String,
    },
    instagramConfig: {
      isConnected: { type: Boolean, default: false },
      username: String,
      businessAccountId: String,
      accessToken: String,
    },
    aiConfig: {
      isEnabled: { type: Boolean, default: true },
      language: {
        type: String,
        enum: ["english", "hindi", "hinglish"],
        default: "hinglish",
      },
      responseSpeed: {
        type: String,
        enum: ["instant", "natural"],
        default: "natural",
      },
    },
    businessInfo: {
      businessName: String,
      businessType: String,
      website: String,
      address: String,
      gstNumber: String,
    },
    stats: {
      totalMessages: { type: Number, default: 0 },
      totalCustomers: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ "subscription.status": 1 });

module.exports = mongoose.model("User", userSchema);
