const express = require("express");
const router = express.Router();
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const {
  getMessages,
  sendMessage,
  deleteMessage,
  getMessageStats,
} = require("../controllers/message.controller");

// @route   GET /api/messages
// @desc    Get all messages
// @access  Private
router.get("/", protect, checkSubscription, getMessages);

// @route   POST /api/messages/send
// @desc    Send message
// @access  Private
router.post("/send", protect, checkSubscription, sendMessage);

// @route   DELETE /api/messages/:id
// @desc    Delete message
// @access  Private
router.delete("/:id", protect, checkSubscription, deleteMessage);

// @route   GET /api/messages/stats
// @desc    Get message statistics
// @access  Private
router.get("/stats", protect, checkSubscription, getMessageStats);

module.exports = router;
