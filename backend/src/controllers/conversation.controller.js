const conversationService = require("../services/conversation.service");
const ResponseHandler = require("../utils/response.handler");

/**
 * @desc    Get all conversations for inbox
 * @route   GET /api/conversations
 * @access  Private
 */
exports.getConversations = async (req, res) => {
  try {
    const { platform, status } = req.query;
    const conversations = await conversationService.getConversations(
      req.user._id,
      { platform, status }
    );
    return ResponseHandler.success(res, conversations);
  } catch (error) {
    console.error("Get conversations error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

/**
 * @desc    Mark conversation as read
 * @route   PUT /api/conversations/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res) => {
  try {
    const conversation = await conversationService.markAsRead(
      req.user._id,
      req.params.id
    );
    return ResponseHandler.success(
      res,
      conversation,
      "Conversation marked as read"
    );
  } catch (error) {
    console.error("Mark as read error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

/**
 * @desc    Update conversation status
 * @route   PUT /api/conversations/:id/status
 * @access  Private
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const conversation = await conversationService.updateStatus(
      req.user._id,
      req.params.id,
      status
    );
    return ResponseHandler.success(
      res,
      conversation,
      "Conversation status updated"
    );
  } catch (error) {
    console.error("Update status error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

/**
 * @desc    Assign conversation to team member
 * @route   PUT /api/conversations/:id/assign
 * @access  Private
 */
exports.assignConversation = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const conversation = await conversationService.assignConversation(
      req.user._id,
      req.params.id,
      assignedTo
    );
    return ResponseHandler.success(
      res,
      conversation,
      "Conversation assigned successfully"
    );
  } catch (error) {
    console.error("Assign conversation error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

/**
 * @desc    Add tags to conversation
 * @route   PUT /api/conversations/:id/tags
 * @access  Private
 */
exports.addTags = async (req, res) => {
  try {
    const { tags } = req.body;
    const conversation = await conversationService.addTags(
      req.user._id,
      req.params.id,
      tags
    );
    return ResponseHandler.success(res, conversation, "Tags added successfully");
  } catch (error) {
    console.error("Add tags error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

/**
 * @desc    Remove tags from conversation
 * @route   DELETE /api/conversations/:id/tags
 * @access  Private
 */
exports.removeTags = async (req, res) => {
  try {
    const { tags } = req.body;
    const conversation = await conversationService.removeTags(
      req.user._id,
      req.params.id,
      tags
    );
    return ResponseHandler.success(
      res,
      conversation,
      "Tags removed successfully"
    );
  } catch (error) {
    console.error("Remove tags error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};
