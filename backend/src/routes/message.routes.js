const express = require("express");
const router = express.Router();
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const {
  getMessages,
  sendMessage,
  deleteMessage,
  editMessage,
  getMessageStats,
  getConversations,
  getCustomerMessages,
  markMessageAsRead,
  uploadMessageMedia,
  retryMessage,
} = require("../controllers/message.controller");

// @route   GET /api/messages/conversations
// @desc    Get all conversations grouped by customer
// @access  Private
router.get("/conversations", protect, checkSubscription, getConversations);

// @route   GET /api/messages/stats
// @desc    Get message statistics
// @access  Private
router.get("/stats", protect, checkSubscription, getMessageStats);

// @route   GET /api/messages/:customerId
// @desc    Get messages for a specific customer
// @access  Private
router.get("/:customerId", protect, checkSubscription, getCustomerMessages);

// @route   GET /api/messages
// @desc    Get all messages
// @access  Private
router.get("/", protect, checkSubscription, getMessages);

// @route   POST /api/messages/send
// @desc    Send message
// @access  Private
router.post("/send", protect, checkSubscription, sendMessage);

// @route   POST /api/messages/upload
// @desc    Upload media for message (voice, image, video, document)
// @access  Private
router.post(
  "/upload",
  protect,
  checkSubscription,
  upload.single("file"),
  uploadMessageMedia,
);

// @route   POST /api/messages/:id/retry
// @desc    Retry sending a failed message
// @access  Private
router.post("/:id/retry", protect, checkSubscription, retryMessage);

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put("/:id/read", protect, checkSubscription, markMessageAsRead);

// @route   PUT /api/messages/:id/edit
// @desc    Edit message
// @access  Private
router.put("/:id/edit", protect, checkSubscription, editMessage);

// @route   DELETE /api/messages/:id
// @desc    Delete message (soft delete)
// @access  Private
router.delete("/:id", protect, checkSubscription, deleteMessage);

module.exports = router;
