const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
// The limited Admin panel shares the Super Admin's account, so it can't
// change that account's profile, password or two-factor login. ownerOnly:
// a Super Admin viewing a shop can't change the owner's password, 2FA or
// delete the account.
const { protect, ownerOnly } = require("../middleware/auth.middleware");
const { superAdminOnly } = require("../middleware/admin.middleware");
const rateLimit = require("express-rate-limit");
const upload = require("../middleware/upload.middleware");
const {
  getProfile,
  updateProfile,
  updatePassword,
  deleteAccount,
  updateWhatsAppConfig,
  updateInstagramConfig,
  updateFacebookConfig,
  updateAIConfig,
  updateBusinessInfo,
  resendEmailVerification,
  sendPhoneVerification,
  verifyPhone,
} = require("../controllers/user.controller");

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user._id.toString(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many verification attempts. Please wait and try again." },
});

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", protect, getProfile);
router.post("/email-verification/resend", protect, verificationLimiter, resendEmailVerification);
router.post("/phone-verification/send", protect, verificationLimiter, sendPhoneVerification);
router.post(
  "/phone-verification/verify",
  protect,
  verificationLimiter,
  [body("otp").isLength({ min: 6, max: 6 }).isNumeric()],
  verifyPhone
);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", protect, superAdminOnly, upload.single("profilePhoto"), updateProfile);

// @route   PUT /api/users/password
// @desc    Update user password
// @access  Private
router.put("/password", protect, superAdminOnly, ownerOnly, updatePassword);

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete("/account", protect, superAdminOnly, ownerOnly, deleteAccount);

// @route   PUT /api/users/whatsapp-config
// @desc    Update WhatsApp configuration
// @access  Private
router.put("/whatsapp-config", protect, updateWhatsAppConfig);

// @route   PUT /api/users/instagram-config
// @desc    Update Instagram configuration
// @access  Private
router.put("/instagram-config", protect, updateInstagramConfig);

// @route   PUT /api/users/facebook-config
// @desc    Update Facebook configuration
// @access  Private
router.put("/facebook-config", protect, updateFacebookConfig);

// @route   PUT /api/users/ai-config
// @desc    Update AI configuration
// @access  Private
router.put("/ai-config", protect, updateAIConfig);

// @route   PUT /api/users/business-info
// @desc    Update business information
// @access  Private
router.put("/business-info", protect, updateBusinessInfo);

const tools = require("../controllers/adminTools.controller");

// @route   GET /api/users/announcements
// @desc    Messages from the platform admin for this shop
// @access  Private
router.get("/announcements", protect, tools.myAnnouncements);

// @route   POST /api/users/2fa/{setup,enable,disable}
// @desc    Two-factor login with an authenticator app
// @access  Private
router.post("/2fa/setup", protect, superAdminOnly, ownerOnly, tools.twoFactorSetup);
router.post("/2fa/enable", protect, superAdminOnly, ownerOnly, tools.twoFactorEnable);
router.post("/2fa/disable", protect, superAdminOnly, ownerOnly, tools.twoFactorDisable);

module.exports = router;
