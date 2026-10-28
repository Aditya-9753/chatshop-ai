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
      enum: ["user", "admin", "staff"],
      default: "user",
    },
    // Staff of a shop (cashier, accountant, agent…): they sign in like
    // everyone else but only reach that shop's EMI & billing panel
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    emiRoles: [
      {
        _id: false,
        role: { type: String, enum: ["STORE_ADMIN", "CASHIER", "ACCOUNTANT", "AGENT"], required: true },
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null }, // null = every store
      },
    ],
    staffActive: { type: Boolean, default: true },
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
      businessEmail: String,
      businessPhone: String,
      description: String,
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
    // Two-factor login with an authenticator app (TOTP)
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      pendingSecret: { type: String, select: false },
    },
    // Admins only: a second password for the same account that opens the
    // limited "Admin" panel (no platform settings, security, backup or deletes)
    adminPanel: {
      password: { type: String, select: false },
      // Admin-panel sessions issued before this moment are rejected
      changedAt: Date,
    },
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
        if (ret.twoFactor) {
          delete ret.twoFactor.secret;
          delete ret.twoFactor.pendingSecret;
        }
        if (ret.adminPanel) delete ret.adminPanel.password;
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

// Same check for sessions opened with the admin-panel password
userSchema.methods.changedAdminPanelPasswordAfter = function (iat) {
  if (!this.adminPanel?.changedAt) return false;
  return iat * 1000 < this.adminPanel.changedAt.getTime();
};

// Indexes for faster queries
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ "subscription.status": 1 });

module.exports = mongoose.model("User", userSchema);
