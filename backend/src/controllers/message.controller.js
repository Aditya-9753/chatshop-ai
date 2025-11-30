const messageService = require("../services/message.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Get all messages
exports.getMessages = async (req, res) => {
  try {
    const result = await messageService.getMessages(req.user._id, req.query);
    return ResponseHandler.paginated(res, result.messages, {
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      total: result.total,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Send message
exports.sendMessage = async (req, res) => {
  try {
    const message = await messageService.sendMessage(req.user._id, req.body);
    return ResponseHandler.created(res, message, "Message sent successfully");
  } catch (error) {
    console.error("Send message error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete message
exports.deleteMessage = async (req, res) => {
  try {
    await messageService.deleteMessage(req.user._id, req.params.id);
    return ResponseHandler.success(res, null, "Message deleted successfully");
  } catch (error) {
    console.error("Delete message error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Get message statistics
exports.getMessageStats = async (req, res) => {
  try {
    const stats = await messageService.getMessageStats(req.user._id, req.query);
    return ResponseHandler.success(res, stats);
  } catch (error) {
    console.error("Get message stats error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get conversations grouped by customer
exports.getConversations = async (req, res) => {
  try {
    const conversations = await messageService.getConversations(req.user._id);
    return ResponseHandler.success(res, conversations);
  } catch (error) {
    console.error("Get conversations error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get messages for a specific customer
exports.getCustomerMessages = async (req, res) => {
  try {
    const messages = await messageService.getCustomerMessages(
      req.user._id,
      req.params.customerId
    );
    return ResponseHandler.success(res, messages);
  } catch (error) {
    console.error("Get customer messages error:", error);
    return ResponseHandler.error(res, error.message);
  }
};
