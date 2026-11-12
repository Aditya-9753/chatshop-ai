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
        role: { type: String, enum: ["STORE_ADMIN", "CASHIER", "ACCOUNTANT", "AGENT", "CUSTOM"], required: true },
        customRoleId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomRole" }, // for a role the owner made
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null }, // null = every store
      },
    ],
    staffActive: { type: Boolean, default: true },
    staffAuthVersion: { type: Number, default: 0 },
    // New staff wait for the Super Admin before they can sign in
    approvalStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "APPROVED" },
    approvalNote: String,
    // Admin accounts: "super" (Super Admin, the default) or "admin" (an
    // Admin with their own login, name and the limited Admin panel)
    adminLevel: { type: String, enum: ["super", "admin"] },
    // An Admin account looks after one shop and sees only that shop's data
    adminShopId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: Date,
    phoneVerified: { type: Boolean, default: false },
    // The shop's ChatShop plan. Plan codes live in the plans collection
    // (src/billing), so the Super Admin can add plans.
    subscription: {
      plan: { type: String, default: null, lowercase: true, trim: true },
      status: {
        type: String,
        enum: ["active", "inactive", "cancelled", "expired"],
        default: "inactive",
      },
      trial: { type: Boolean, default: false }, // free trial: no payment, no revenue
      interval: { type: String, enum: ["MONTHLY", "YEARLY", "ONE_TIME", null], default: null },
      planVersion: Number,
      pricePaise: { type: Number, default: 0 }, // recurring price before GST, from the last paid invoice
      startDate: Date,
      endDate: Date,
      cancelAtPeriodEnd: { type: Boolean, default: false },
      cancelledAt: Date,
      lastInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformInvoice" },
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
    emailVerificationSentAt: Date,
    emailVerificationCodeHash: { type: String, select: false },
    emailVerificationCodeExpires: { type: Date, select: false },
    emailVerificationCodeAttempts: { type: Number, default: 0, select: false },
    phoneVerificationOtpHash: { type: String, select: false },
    phoneVerificationExpires: { type: Date, select: false },
    phoneVerificationSentAt: Date,
    phoneVerificationAttempts: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      // Never send platform access tokens or secrets to the browser
      transform(doc, ret) {
        delete ret.password;
        delete ret.staffAuthVersion;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.emailVerificationSentAt;
        delete ret.emailVerificationCodeHash;
        delete ret.emailVerificationCodeExpires;
        delete ret.emailVerificationCodeAttempts;
        ret.isVerified = Boolean(ret.isVerified && ret.emailVerifiedAt);
        delete ret.emailVerifiedAt;
        delete ret.phoneVerificationOtpHash;
        delete ret.phoneVerificationExpires;
        delete ret.phoneVerificationSentAt;
        delete ret.phoneVerificationAttempts;
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
