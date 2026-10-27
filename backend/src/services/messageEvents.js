const Conversation = require("../models/Conversation.model");
const realtime = require("../realtime/socket");

// Realtime inbox events, sent to the owner's socket.io room

async function emitNewMessage(message, conversation) {
  const populated = conversation
    ? await Conversation.findById(conversation._id)
        .populate("customerId", "name phone platform profilePicture")
        .lean()
    : null;

  realtime.emitToUser(message.userId, "message:new", {
    message: message.toObject ? message.toObject() : message,
    conversation: populated,
  });
}

function emitStatus(message) {
  realtime.emitToUser(message.userId, "message:status", {
    messageId: message._id,
    customerId: message.customerId,
    conversationId: message.conversationId,
    status: message.status,
    errorDetails: message.errorDetails,
  });
}

module.exports = { emitNewMessage, emitStatus };
