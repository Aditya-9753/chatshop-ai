const express = require("express");
const router = express.Router();
const { verifyMetaSignature } = require("../middleware/webhookSignature.middleware");
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const {
  connectWhatsApp,
  disconnectWhatsApp,
  sendWhatsAppMessage,
  handleWebhook,
  verifyWebhook,
} = require("../controllers/whatsapp.controller");

// @route   POST /api/whatsapp/connect
// @desc    Connect WhatsApp Business account
// @access  Private
router.post("/connect", protect, checkSubscription, connectWhatsApp);

// @route   POST /api/whatsapp/disconnect
// @desc    Disconnect WhatsApp Business account
// @access  Private
router.post("/disconnect", protect, checkSubscription, disconnectWhatsApp);

// @route   POST /api/whatsapp/send
// @desc    Send WhatsApp message
// @access  Private
router.post("/send", protect, checkSubscription, sendWhatsAppMessage);

// @route   GET /api/whatsapp/webhook
// @desc    Verify WhatsApp webhook
// @access  Public
router.get("/webhook", verifyWebhook);

// @route   POST /api/whatsapp/webhook
// @desc    Handle WhatsApp webhook events
// @access  Public (signed by Meta: X-Hub-Signature-256)
router.post("/webhook", verifyMetaSignature, handleWebhook);

module.exports = router;
