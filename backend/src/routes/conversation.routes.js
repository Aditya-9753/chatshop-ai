const express = require("express");
const router = express.Router();
const conversationController = require("../controllers/conversation.controller");
const authMiddleware = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authMiddleware.protect);

// @route   GET /api/conversations
// @desc    Get all conversations for inbox
// @access  Private
router.get("/", conversationController.getConversations);

// @route   PUT /api/conversations/:id/read
// @desc    Mark conversation as read
// @access  Private
router.put("/:id/read", conversationController.markAsRead);

// @route   PUT /api/conversations/:id/status
// @desc    Update conversation status
// @access  Private
router.put("/:id/status", conversationController.updateStatus);

// @route   PUT /api/conversations/:id/assign
// @desc    Assign conversation to team member
// @access  Private
router.put("/:id/assign", conversationController.assignConversation);

// @route   PUT /api/conversations/:id/tags
// @desc    Add tags to conversation
// @access  Private
router.put("/:id/tags", conversationController.addTags);

// @route   DELETE /api/conversations/:id/tags
// @desc    Remove tags from conversation
// @access  Private
router.delete("/:id/tags", conversationController.removeTags);

module.exports = router;
