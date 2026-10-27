const express = require("express");
const router = express.Router();
const { verifyMetaSignature } = require("../middleware/webhookSignature.middleware");
const facebookController = require("../controllers/facebook.controller");
const { protect, checkSubscription } = require("../middleware/auth.middleware");

// @route   POST /api/facebook/connect
// @desc    Connect Facebook account
// @access  Private
router.post("/connect", protect, facebookController.connectFacebook);

// @route   POST /api/facebook/disconnect
// @desc    Disconnect Facebook account
// @access  Private
router.post("/disconnect", protect, facebookController.disconnectFacebook);

// @route   POST /api/facebook/send
// @desc    Send message via Facebook
// @access  Private
router.post(
  "/send",
  protect,
  checkSubscription,
  facebookController.sendFacebookMessage
);

// @route   GET /api/facebook/webhook
// @desc    Verify webhook
// @access  Public
router.get("/webhook", facebookController.verifyWebhook);

// @route   POST /api/facebook/webhook
// @desc    Handle webhook events
// @access  Public (signed by Meta: X-Hub-Signature-256)
router.post("/webhook", verifyMetaSignature, facebookController.handleWebhook);

module.exports = router;
