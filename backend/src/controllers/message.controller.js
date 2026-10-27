const path = require("path");
const messageService = require("../services/message.service");

const UPLOADS_ROOT = path.join(__dirname, "../../uploads");
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
    // A platform failure is not an HTTP error: the message is saved as
    // "failed" with Meta's error text so the inbox can offer a retry.
    const message = await messageService.sendMessage(req.user._id, req.body);
    return ResponseHandler.created(
      res,
      message,
      message.status === "failed" ? "Message not delivered" : "Message sent",
    );
  } catch (error) {
    console.error("Send message error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Retry a failed message
// @route   POST /api/messages/:id/retry
// @access  Private
exports.retryMessage = async (req, res) => {
  try {
    const message = await messageService.retryMessage(req.user._id, req.params.id);
    return ResponseHandler.success(
      res,
      message,
      message.status === "failed" ? "Message not delivered" : "Message sent",
    );
  } catch (error) {
    console.error("Retry message error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const message = await messageService.deleteMessage(
      req.user._id,
      req.params.id,
    );
    return ResponseHandler.success(
      res,
      message,
      "Message deleted successfully",
    );
  } catch (error) {
    console.error("Delete message error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Edit message
// @route   PUT /api/messages/:id/edit
// @access  Private
exports.editMessage = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return ResponseHandler.badRequest(res, "Message text is required");
    }

    const message = await messageService.editMessage(
      req.user._id,
      req.params.id,
      text,
    );
    return ResponseHandler.success(res, message, "Message edited successfully");
  } catch (error) {
    console.error("Edit message error:", error);
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
      req.params.customerId,
    );
    return ResponseHandler.success(res, messages);
  } catch (error) {
    console.error("Get customer messages error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
exports.markMessageAsRead = async (req, res) => {
  try {
    const message = await messageService.markMessageAsRead(
      req.user._id,
      req.params.id,
    );
    return ResponseHandler.success(res, message, "Message marked as read");
  } catch (error) {
    console.error("Mark message as read error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Upload media for message
// @route   POST /api/messages/upload
// @access  Private
exports.uploadMessageMedia = async (req, res) => {
  try {
    if (!req.file) {
      return ResponseHandler.badRequest(res, "No file uploaded");
    }

    const fileData = {
      // Public URL under /uploads, built from where the file was saved
      mediaUrl: `/uploads/${path.relative(UPLOADS_ROOT, req.file.path).split(path.sep).join("/")}`,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    };

    return ResponseHandler.success(res, fileData, "File uploaded successfully");
  } catch (error) {
    console.error("Upload media error:", error);
    return ResponseHandler.error(res, error.message);
  }
};
