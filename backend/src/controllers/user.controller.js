const userService = require("../services/user.service");
const authService = require("../services/auth.service");
const audit = require("../utils/audit");
const ResponseHandler = require("../utils/response.handler");
const { validationResult } = require("express-validator");

// @desc    Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user._id);
    return ResponseHandler.success(res, user);
  } catch (error) {
    console.error("Get profile error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const profilePhotoPath = req.file
      ? `/uploads/profiles/${req.file.filename}`
      : null;

    const user = await userService.updateProfile(
      req.user._id,
      req.body,
      profilePhotoPath
    );

    const verification = {};
    if (req.body.email && req.body.email.trim().toLowerCase() !== req.user.email) {
      try {
        verification.email = await authService.sendEmailVerification(req.user._id);
      } catch (error) {
        console.error("Profile email verification delivery failed:", error.message);
        verification.email = { sent: false };
      }
    }
    if (req.body.phone !== undefined && req.body.phone !== req.user.phone) {
      try {
        verification.phone = await authService.sendPhoneVerification(req.user._id);
      } catch (error) {
        console.error("Profile mobile verification delivery failed:", error.message);
        verification.phone = { sent: false };
      }
    }

    const updated = user.toJSON();
    updated.verification = verification;
    const deliveryFailed = Object.values(verification).some((result) => result.sent === false);
    return ResponseHandler.success(
      res,
      updated,
      deliveryFailed ? "Profile updated, but a verification message could not be delivered. Try again from Profile." : "Profile updated successfully"
    );
  } catch (error) {
    console.error("Update profile error:", error);
    return ResponseHandler.error(res, error.message, 400);
  }
};

exports.resendEmailVerification = async (req, res) => {
  try {
    const result = await authService.sendEmailVerification(req.user._id);
    if (!result.sent && !result.alreadyVerified) {
      return ResponseHandler.error(res, "Email verification could not be delivered. Check SMTP configuration and try again.", 503);
    }
    return ResponseHandler.success(res, result, result.alreadyVerified ? "Email is already verified" : "Verification email sent");
  } catch (error) {
    const unavailable = /email verification could not be delivered|email verification is unavailable/i.test(error.message);
    return ResponseHandler.error(res, error.message, unavailable ? 503 : 400);
  }
};

exports.sendPhoneVerification = async (req, res) => {
  try {
    const result = await authService.sendPhoneVerification(req.user._id);
    if (!result.sent && !result.alreadyVerified) {
      return ResponseHandler.error(res, "Mobile verification is not configured. Contact the administrator.", 503);
    }
    return ResponseHandler.success(res, result, result.alreadyVerified ? "Mobile number is already verified" : "Verification code sent");
  } catch (error) {
    const unavailable = /MSG91|verification is unavailable/i.test(error.message);
    return ResponseHandler.error(res, error.message, unavailable ? 503 : 400);
  }
};

exports.verifyPhone = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return ResponseHandler.validationError(res, errors.array());
    const user = await authService.verifyPhone(req.user._id, req.body.otp);
    return ResponseHandler.success(res, { phoneVerified: user.phoneVerified }, "Mobile number verified successfully");
  } catch (error) {
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Update password
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return ResponseHandler.badRequest(
        res,
        "Please provide current and new password"
      );
    }

    await userService.updatePassword(
      req.user._id,
      currentPassword,
      newPassword
    );

    await audit(req, "auth.password_change");

    // Other sessions are now logged out; this one gets a fresh token
    return ResponseHandler.success(
      res,
      { token: authService.generateToken(req.user._id, undefined, req.user.role === "staff" ? req.user.staffAuthVersion || 0 : undefined) },
      "Password updated. Other sessions have been logged out."
    );
  } catch (error) {
    console.error("Update password error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete account
exports.deleteAccount = async (req, res) => {
  try {
    await userService.deleteAccount(req.user._id);
    return ResponseHandler.success(res, null, "Account deleted successfully");
  } catch (error) {
    console.error("Delete account error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update WhatsApp configuration
exports.updateWhatsAppConfig = async (req, res) => {
  try {
    const config = await userService.updateWhatsAppConfig(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      config,
      "WhatsApp configuration updated successfully"
    );
  } catch (error) {
    console.error("Update WhatsApp config error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update Instagram configuration
exports.updateInstagramConfig = async (req, res) => {
  try {
    const config = await userService.updateInstagramConfig(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      config,
      "Instagram configuration updated successfully"
    );
  } catch (error) {
    console.error("Update Instagram config error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update AI configuration
exports.updateAIConfig = async (req, res) => {
  try {
    const config = await userService.updateAIConfig(req.user._id, req.body);
    return ResponseHandler.success(
      res,
      config,
      "AI configuration updated successfully"
    );
  } catch (error) {
    console.error("Update AI config error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update business information
exports.updateBusinessInfo = async (req, res) => {
  try {
    const businessInfo = await userService.updateBusinessInfo(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      businessInfo,
      "Business information updated successfully"
    );
  } catch (error) {
    console.error("Update business info error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update Facebook configuration
exports.updateFacebookConfig = async (req, res) => {
  try {
    const config = await userService.updateFacebookConfig(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      config,
      "Facebook configuration updated successfully"
    );
  } catch (error) {
    console.error("Update Facebook config error:", error);
    return ResponseHandler.error(res, error.message);
  }
};
