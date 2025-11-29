const express = require("express");
const router = express.Router();
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const {
  connectInstagram,
  disconnectInstagram,
  sendInstagramMessage,
  handleWebhook,
  verifyWebhook,
} = require("../controllers/instagram.controller");

// @route   POST /api/instagram/connect
// @desc    Connect Instagram Business account
// @access  Private
router.post("/connect", protect, checkSubscription, connectInstagram);

// @route   POST /api/instagram/disconnect
// @desc    Disconnect Instagram Business account
// @access  Private
router.post("/disconnect", protect, checkSubscription, disconnectInstagram);

// @route   POST /api/instagram/send
// @desc    Send Instagram message
// @access  Private
router.post("/send", protect, checkSubscription, sendInstagramMessage);

// @route   GET /api/instagram/webhook
// @desc    Verify Instagram webhook
// @access  Public
router.get("/webhook", verifyWebhook);

// @route   POST /api/instagram/webhook
// @desc    Handle Instagram webhook events
// @access  Public
router.post("/webhook", handleWebhook);

module.exports = router;
