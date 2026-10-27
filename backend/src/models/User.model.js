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
      // Meta's phone number ID: used to match webhooks and in the send URL
      phoneNumberId: { type: String, index: true },
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
    facebookConfig: {
      isConnected: { type: Boolean, default: false },
      pageName: String,
      pageId: String,
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
      messagesSent: { type: Number, default: 0 },
      messagesReceived: { type: Number, default: 0 },
      platforms: {
        whatsapp: { type: Number, default: 0 },
        instagram: { type: Number, default: 0 },
        facebook: { type: Number, default: 0 },
      },
    },
    // Password reset: only the sha256 hash of the emailed token is stored
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // JWTs issued before this moment are rejected (logs out old sessions)
    passwordChangedAt: Date,
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      // Never send platform access tokens or secrets to the browser
      transform(doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        for (const key of ["whatsappConfig", "instagramConfig", "facebookConfig"]) {
          if (ret[key]) {
            ret[key].hasAccessToken = Boolean(ret[key].accessToken);
            delete ret[key].accessToken;
            delete ret[key].webhookVerifyToken;
          }
        }
        return ret;
      },
    },
  }
);

// True when the JWT (issued at `iat`, in seconds) predates a password change
userSchema.methods.changedPasswordAfter = function (iat) {
  if (!this.passwordChangedAt) return false;
  return iat * 1000 < this.passwordChangedAt.getTime();
};

// Indexes for faster queries
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ "subscription.status": 1 });

module.exports = mongoose.model("User", userSchema);
