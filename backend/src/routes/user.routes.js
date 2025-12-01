const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const {
  getProfile,
  updateProfile,
  updatePassword,
  deleteAccount,
  updateWhatsAppConfig,
  updateInstagramConfig,
  updateAIConfig,
  updateBusinessInfo,
} = require("../controllers/user.controller");

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", protect, getProfile);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", protect, upload.single("profilePhoto"), updateProfile);

// @route   PUT /api/users/password
// @desc    Update user password
// @access  Private
router.put("/password", protect, updatePassword);

// @route   DELETE /api/users/account
// @desc    Delete user account
// @access  Private
router.delete("/account", protect, deleteAccount);

// @route   PUT /api/users/whatsapp-config
// @desc    Update WhatsApp configuration
// @access  Private
router.put("/whatsapp-config", protect, updateWhatsAppConfig);

// @route   PUT /api/users/instagram-config
// @desc    Update Instagram configuration
// @access  Private
router.put("/instagram-config", protect, updateInstagramConfig);

// @route   PUT /api/users/ai-config
// @desc    Update AI configuration
// @access  Private
router.put("/ai-config", protect, updateAIConfig);

// @route   PUT /api/users/business-info
// @desc    Update business information
// @access  Private
router.put("/business-info", protect, updateBusinessInfo);

module.exports = router;
