const User = require("../models/User.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const sendOtp = require("../utils/sendOtp");
const twoFactorService = require("./twoFactor.service");

const RESET_TOKEN_TTL = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TTL = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_CODE_TTL = 5 * 60 * 1000;
const PHONE_OTP_TTL = 5 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN = 60 * 1000;
const EMAIL_VERIFICATION_CODE_MAX_ATTEMPTS = 5;
const PHONE_OTP_MAX_ATTEMPTS = 5;

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const hashPhoneOtp = (userId, otp) =>
  crypto.createHmac("sha256", process.env.VERIFICATION_SECRET || process.env.JWT_SECRET).update(`${userId}:${otp}`).digest("hex");
const hashEmailCode = (userId, code) =>
  crypto.createHmac("sha256", process.env.VERIFICATION_SECRET || process.env.JWT_SECRET).update(`${userId}:${code}`).digest("hex");
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

class AuthService {
  // Generate JWT Token. Sessions opened with the admin-panel password carry
  // adminLevel: "admin"; every other session is full access.
  generateToken(userId, adminLevel, staffAuthVersion) {
    const payload = {
      id: userId,
      ...(adminLevel === "admin" && { adminLevel }),
      ...(staffAuthVersion !== undefined && { staffAuthVersion }),
    };
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    });
  }

  // Generate verification token
  generateVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  // Wrapped so tests can capture outgoing email
  sendEmail(options) {
    return sendEmail(options);
  }

  sendOtp(phone, otp) {
    return sendOtp(phone, otp);
  }

  // The user fields the frontend keeps in localStorage
  toSessionUser(user, adminLevel) {
    // The shared Admin panel password signs in to the Super Admin's account;
    // don't show that session under the Super Admin's own name
    const sharedPanel = user.role === "admin" && adminLevel === "admin" && user.adminLevel !== "admin";
    return {
      id: user._id,
      name: sharedPanel ? "Admin" : user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      // "super" (Super Admin) or "admin" (limited admin panel)
      adminLevel: user.role === "admin" ? (adminLevel === "admin" ? "admin" : "super") : undefined,
      // An Admin account of its own looks after one shop (null until assigned)
      ...(user.role === "admin" && user.adminLevel === "admin" && { shopAdmin: true, adminShopId: user.adminShopId || null }),
      isVerified: Boolean(user.isVerified && user.emailVerifiedAt),
      phoneVerified: user.phoneVerified,
      profilePhoto: user.profilePhoto,
      businessInfo: user.businessInfo,
      subscription: user.subscription,
    };
  }

  // Register new user
  async register(userData) {
    const { name, email, password, phone, businessName } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create an account with both contact channels unverified.
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      businessInfo: businessName ? { businessName } : undefined,
      isVerified: false,
      phoneVerified: false,
      subscription: {
        plan: "premium", // Give premium by default (free trial)
        status: "active",
        trial: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
      },
    });

    const [emailDelivery, phoneDelivery] = await Promise.allSettled([
      this.sendEmailVerification(user._id),
      this.sendPhoneVerification(user._id),
    ]);
    if (emailDelivery.status === "rejected") console.error("Registration email verification failed:", emailDelivery.reason.message);
    if (phoneDelivery.status === "rejected") console.error("Registration mobile verification failed:", phoneDelivery.reason.message);
    const emailSent = emailDelivery.status === "fulfilled" && emailDelivery.value.sent === true;
    const phoneSent = phoneDelivery.status === "fulfilled" && phoneDelivery.value.sent === true;

    return {
      token: this.generateToken(user._id, undefined, user.role === "staff" ? user.staffAuthVersion || 0 : undefined),
      user: this.toSessionUser(user),
      verification: { emailSent, phoneSent },
    };
  }

  // Login user
  async login(email, password) {
    // Find user and explicitly select password field
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password +adminPanel.password");
    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Check password. An admin account also accepts its admin-panel
    // password, which opens the limited Admin panel.
    let adminLevel;
    if (!(await bcrypt.compare(password, user.password))) {
      const panelMatch =
        user.role === "admin" && user.adminPanel?.password && (await bcrypt.compare(password, user.adminPanel.password));
      if (!panelMatch) {
        throw new Error("Invalid email or password");
      }
      adminLevel = "admin";
    }
    // An Admin with an account of their own always opens the limited panel
    if (user.role === "admin" && user.adminLevel === "admin") adminLevel = "admin";

    // Shop staff sign in only once the shop owner has approved them
    if (user.role === "staff" && user.approvalStatus === "PENDING") {
      throw new Error("Your account is waiting for the shop owner's approval.");
    }
    if (user.role === "staff" && user.staffActive === false) {
      throw new Error("Your staff account is switched off. Contact your shop owner.");
    }
    if (user.role === "staff" && user.approvalStatus === "REJECTED") {
      throw new Error(`Your account was not approved${user.approvalNote ? `: ${user.approvalNote}` : ""}. Contact your shop owner.`);
    }

    // With two-factor login on, the password only earns a short challenge
    if (user.twoFactor?.enabled) {
      return { twoFactorRequired: true, challengeToken: twoFactorService.challengeFor(user, adminLevel) };
    }

    return this.session(user, adminLevel);
  }

  session(user, adminLevel) {
    return {
      token: this.generateToken(user._id, adminLevel, user.role === "staff" ? user.staffAuthVersion || 0 : undefined),
      user: this.toSessionUser(user, adminLevel),
    };
  }

  // Second login step for accounts with two-factor login
  async loginWithCode(challengeToken, code) {
    const { user, adminLevel } = await twoFactorService.verifyChallenge(challengeToken, code);
    return this.session(user, adminLevel);
  }

  // Verify email
  async verifyEmail(token) {
    const user = await User.findOneAndUpdate(
      {
        emailVerificationToken: hashToken(token),
        emailVerificationExpires: { $gt: Date.now() },
      },
      {
        $set: { isVerified: true, emailVerifiedAt: new Date() },
        $unset: {
          emailVerificationToken: 1,
          emailVerificationExpires: 1,
          emailVerificationCodeHash: 1,
          emailVerificationCodeExpires: 1,
          emailVerificationCodeAttempts: 1,
        },
      },
      { new: true }
    );

    if (!user) {
      throw new Error("Invalid or expired verification token");
    }

    return user;
  }

  async verifyEmailCode(email, code) {
    const user = await User.findOne({ email: String(email || "").trim().toLowerCase() })
      .select("+emailVerificationCodeHash +emailVerificationCodeExpires +emailVerificationCodeAttempts");
    if (!user || (user.isVerified && user.emailVerifiedAt)) {
      throw new Error("Invalid or expired verification code");
    }

    const now = Date.now();
    if (!user.emailVerificationCodeHash || !user.emailVerificationCodeExpires || user.emailVerificationCodeExpires.getTime() <= now) {
      throw new Error("Invalid or expired verification code");
    }
    if (user.emailVerificationCodeAttempts >= EMAIL_VERIFICATION_CODE_MAX_ATTEMPTS) {
      throw new Error("Too many incorrect codes. Request a new verification email.");
    }

    const expected = Buffer.from(user.emailVerificationCodeHash, "hex");
    const actual = Buffer.from(hashEmailCode(user._id, String(code)), "hex");
    if (!crypto.timingSafeEqual(expected, actual)) {
      const updated = await User.findOneAndUpdate(
        {
          _id: user._id,
          emailVerificationCodeHash: user.emailVerificationCodeHash,
          emailVerificationCodeExpires: { $gt: now },
          emailVerificationCodeAttempts: { $lt: EMAIL_VERIFICATION_CODE_MAX_ATTEMPTS },
        },
        { $inc: { emailVerificationCodeAttempts: 1 } },
        { new: true }
      ).select("+emailVerificationCodeAttempts");
      if (updated?.emailVerificationCodeAttempts >= EMAIL_VERIFICATION_CODE_MAX_ATTEMPTS) {
        throw new Error("Too many incorrect codes. Request a new verification email.");
      }
      throw new Error("Invalid or expired verification code");
    }

    const verified = await User.findOneAndUpdate(
      {
        _id: user._id,
        emailVerificationCodeHash: user.emailVerificationCodeHash,
        emailVerificationCodeExpires: { $gt: now },
        emailVerificationCodeAttempts: { $lt: EMAIL_VERIFICATION_CODE_MAX_ATTEMPTS },
        emailVerifiedAt: { $exists: false },
      },
      {
        $set: { isVerified: true, emailVerifiedAt: new Date() },
        $unset: {
          emailVerificationToken: 1,
          emailVerificationExpires: 1,
          emailVerificationCodeHash: 1,
          emailVerificationCodeExpires: 1,
          emailVerificationCodeAttempts: 1,
        },
      },
      { new: true }
    );
    if (!verified) throw new Error("Invalid or expired verification code");
    return verified;
  }

  async sendEmailVerification(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.isVerified && user.emailVerifiedAt) return { alreadyVerified: true };
    if (process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "development" && (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD)) {
      throw new Error("Email verification is unavailable. Configure SMTP and try again.");
    }

    const now = Date.now();
    const token = this.generateVerificationToken();
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const claimFilter = {
      _id: user._id,
      emailVerifiedAt: { $exists: false },
      $or: [
        { emailVerificationSentAt: { $exists: false } },
        { emailVerificationSentAt: { $lte: new Date(now - VERIFICATION_RESEND_COOLDOWN) } },
      ],
    };
    const claimed = await User.findOneAndUpdate(
      claimFilter,
      {
        $set: {
          isVerified: false,
          emailVerificationToken: hashToken(token),
          emailVerificationExpires: now + EMAIL_VERIFICATION_TTL,
          emailVerificationCodeHash: hashEmailCode(user._id, code),
          emailVerificationCodeExpires: new Date(now + EMAIL_VERIFICATION_CODE_TTL),
          emailVerificationCodeAttempts: 0,
          emailVerificationSentAt: new Date(now),
        },
        $unset: { emailVerifiedAt: 1 },
      },
      { new: true }
    );
    if (!claimed) {
      const current = await User.findById(user._id).select("isVerified emailVerifiedAt");
      if (current?.isVerified && current.emailVerifiedAt) return { alreadyVerified: true };
      throw new Error("Please wait before requesting another verification email");
    }
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    if (!process.env.EMAIL_USER && process.env.NODE_ENV === "development") console.warn(`Email verification link for ${claimed.email}: ${verificationUrl}`);
    let delivery;
    try {
      delivery = await this.sendEmail({
        to: claimed.email,
        subject: "Verify Your Email - ChatShop AI",
        text: `Verify your email using this link: ${verificationUrl}\n\nIf you cannot use the link, enter this 6-digit code in the app: ${code}\n\nThe code expires in 5 minutes and can be used up to 5 times. The link expires in 24 hours.`,
        html: `
          <h1>Verify your email</h1>
          <p>Hi ${escapeHtml(claimed.name)},</p>
          <p>Confirm this email address by clicking the link below:</p>
          <a href="${verificationUrl}">Verify email</a>
          <p>Or enter this 6-digit code in the app if you cannot use the link:</p>
          <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
          <p>The code expires in 5 minutes and can be used up to 5 times. The link expires in 24 hours.</p>
        `,
      });
    } catch (error) {
      console.error("Email verification delivery failed:", error.message);
      throw new Error("Email verification could not be delivered. Check SMTP configuration and try again.");
    }
    return { sent: !["test-mode-no-email", "dev-mode-failed"].includes(delivery?.messageId) };
  }

  async sendPhoneVerification(userId) {
    const user = await User.findById(userId).select("+phoneVerificationOtpHash +phoneVerificationExpires +phoneVerificationAttempts");
    if (!user) throw new Error("User not found");
    if (user.phoneVerified) return { alreadyVerified: true };
    if (!user.phone || user.phone === "-") throw new Error("Add a mobile number before requesting verification");

    const now = Date.now();
    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const claimFilter = {
      _id: user._id,
      phone: user.phone,
      phoneVerified: { $ne: true },
      $or: [
        { phoneVerificationSentAt: { $exists: false } },
        { phoneVerificationSentAt: { $lte: new Date(now - VERIFICATION_RESEND_COOLDOWN) } },
      ],
    };
    const claimed = await User.findOneAndUpdate(
      claimFilter,
      {
        $set: {
          phoneVerificationOtpHash: hashPhoneOtp(user._id, otp),
          phoneVerificationExpires: now + PHONE_OTP_TTL,
          phoneVerificationSentAt: new Date(now),
          phoneVerificationAttempts: 0,
        },
      },
      { new: true }
    );
    if (!claimed) {
      const current = await User.findById(user._id).select("phoneVerified");
      if (current?.phoneVerified) return { alreadyVerified: true };
      throw new Error("Please wait before requesting another verification code");
    }

    try {
      const delivery = await this.sendOtp(claimed.phone, otp);
      if (delivery?.skipped) {
        await User.updateOne(
          { _id: claimed._id, phoneVerificationOtpHash: hashPhoneOtp(claimed._id, otp) },
          { $unset: { phoneVerificationOtpHash: 1, phoneVerificationExpires: 1, phoneVerificationAttempts: 1 } }
        );
        return { sent: false, setupRequired: true };
      }
    } catch (error) {
      await User.updateOne(
        { _id: claimed._id, phoneVerificationOtpHash: hashPhoneOtp(claimed._id, otp) },
        { $unset: { phoneVerificationOtpHash: 1, phoneVerificationExpires: 1, phoneVerificationAttempts: 1 } }
      );
      throw error;
    }
    return { sent: true, expiresInSeconds: PHONE_OTP_TTL / 1000 };
  }

  async verifyPhone(userId, otp) {
    const user = await User.findById(userId).select("+phoneVerificationOtpHash +phoneVerificationExpires +phoneVerificationAttempts");
    const now = Date.now();
    if (!user || !user.phoneVerificationOtpHash || !user.phoneVerificationExpires || user.phoneVerificationExpires.getTime() <= now) {
      if (user) {
        user.phoneVerificationOtpHash = undefined;
        user.phoneVerificationExpires = undefined;
        user.phoneVerificationAttempts = 0;
        await user.save();
      }
      throw new Error("The verification code has expired. Request a new one.");
    }
    if (user.phoneVerificationAttempts >= PHONE_OTP_MAX_ATTEMPTS) {
      throw new Error("Too many incorrect codes. Request a new verification code.");
    }

    const expected = Buffer.from(user.phoneVerificationOtpHash, "hex");
    const actual = Buffer.from(hashPhoneOtp(user._id, String(otp)), "hex");
    if (!crypto.timingSafeEqual(expected, actual)) {
      const updated = await User.findOneAndUpdate(
        {
          _id: user._id,
          phoneVerificationOtpHash: user.phoneVerificationOtpHash,
          phoneVerificationExpires: { $gt: now },
          phoneVerificationAttempts: { $lt: PHONE_OTP_MAX_ATTEMPTS },
        },
        { $inc: { phoneVerificationAttempts: 1 } },
        { new: true }
      ).select("+phoneVerificationAttempts");
      if (updated?.phoneVerificationAttempts >= PHONE_OTP_MAX_ATTEMPTS) {
        await User.updateOne({ _id: user._id, phoneVerificationOtpHash: user.phoneVerificationOtpHash }, {
          $unset: { phoneVerificationOtpHash: 1, phoneVerificationExpires: 1 },
        });
        throw new Error("Too many incorrect codes. Request a new verification code.");
      }
      throw new Error("Incorrect verification code");
    }

    const verified = await User.findOneAndUpdate(
      { _id: user._id, phoneVerificationOtpHash: user.phoneVerificationOtpHash, phoneVerificationExpires: { $gt: now }, phoneVerificationAttempts: { $lt: PHONE_OTP_MAX_ATTEMPTS } },
      {
        $set: { phoneVerified: true },
        $unset: { phoneVerificationOtpHash: 1, phoneVerificationExpires: 1, phoneVerificationAttempts: 1 },
      },
      { new: true }
    );
    if (!verified) throw new Error("The verification code expired or was already used");
    return verified;
  }

  // Forgot password. Resolves the same way whether or not the email
  // exists, so the endpoint can't be used to discover accounts.
  async forgotPassword(email) {
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return true;
    }

    // Email the raw token; store only its hash
    const resetToken = this.generateVerificationToken();
    user.passwordResetToken = hashToken(resetToken);
    user.passwordResetExpires = Date.now() + RESET_TOKEN_TTL;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Without SMTP settings the email is skipped, so log the link locally
    if (!process.env.EMAIL_USER && process.env.NODE_ENV === "development") {
      console.log(`🔑 Password reset link for ${user.email}: ${resetUrl}`);
    }

    try {
      await this.sendEmail({
        to: user.email,
        subject: "Reset your password - ChatShop AI",
        html: `
          <h1>Password Reset Request</h1>
          <p>Hi ${user.name},</p>
          <p>You requested to reset your password. Click the link below to choose a new one:</p>
          <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
          <p>Or copy this link: ${resetUrl}</p>
          <p>This link will expire in 1 hour and can be used once.</p>
          <p>If you didn't request this, you can ignore this email.</p>
          <p>Best regards,<br>ChatShop AI Team</p>
        `,
      });
    } catch (error) {
      console.error("Password reset email failed:", error.message);
    }

    return true;
  }

  // Find the user a reset token belongs to, if it is still valid
  async findUserByResetToken(token) {
    if (!token) return null;
    return User.findOne({
      passwordResetToken: hashToken(token),
      passwordResetExpires: { $gt: Date.now() },
    });
  }

  // Reset password; the token is cleared so the link works once
  async resetPassword(token, newPassword) {
    const user = await this.findUserByResetToken(token);

    if (!user) {
      throw new Error("This reset link has expired or was already used");
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // 1s back so a token issued right now is not caught by the check
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save();

    return true;
  }
}

module.exports = new AuthService();
