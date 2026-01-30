const Conversation = require("../models/Conversation");
const Message = require("../models/Message.model");
const Customer = require("../models/Customer.model");

class ConversationService {
  /**
   * Get all conversations for the inbox (sorted by newest)
   * @param {String} userId - The logged-in user ID
   * @param {Object} filters - Optional filters (platform, status)
   * @returns {Array} List of conversations
   */
  async getConversations(userId, filters = {}) {
    const { platform, status } = filters;

    const query = { userId };

    if (platform) query.platform = platform;
    if (status) query.status = status;

    const conversations = await Conversation.find(query)
      .populate("customerId", "name phone platform profilePicture")
      .populate("assignedTo", "name email")
      .sort({ "lastMessage.timestamp": -1 })
      .lean();

    return conversations;
  }

  /**
   * Get or create a conversation
   * @param {String} userId
   * @param {String} customerId
   * @param {String} platform
   * @returns {Object} Conversation document
   */
  async getOrCreateConversation(userId, customerId, platform) {
    let conversation = await Conversation.findOne({
      userId,
      customerId,
      platform,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        userId,
        customerId,
        platform,
        lastMessage: {
          content: "",
          type: "text",
          timestamp: new Date(),
        },
        unreadCount: 0,
        status: "open",
      });
    }

    return conversation;
  }

  /**
   * Update conversation with the latest message
   * @param {String} conversationId
   * @param {Object} messageData - Contains content, type, direction
   * @returns {Object} Updated conversation
   */
  async updateLastMessage(conversationId, messageData) {
    const { content, type, direction } = messageData;

    const updateData = {
      lastMessage: {
        content: content.text || content.caption || `[${type}]`,
        type: type,
        timestamp: new Date(),
      },
    };

    // Increment unread count if it's an incoming message
    if (direction === "incoming") {
      updateData.$inc = { unreadCount: 1 };
    }

    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      updateData,
      { new: true }
    );

    return conversation;
  }

  /**
   * Mark a conversation as read (reset unreadCount to 0)
   * @param {String} userId
   * @param {String} conversationId
   * @returns {Object} Updated conversation
   */
  async markAsRead(userId, conversationId) {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { unreadCount: 0 },
      { new: true }
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Also mark all messages in this conversation as read
    await Message.updateMany(
      {
        conversationId,
        userId,
        direction: "incoming",
        isRead: false,
      },
      { isRead: true }
    );

    return conversation;
  }

  /**
   * Update conversation status
   * @param {String} userId
   * @param {String} conversationId
   * @param {String} status - open, closed, archived, snoozed
   * @returns {Object} Updated conversation
   */
  async updateStatus(userId, conversationId, status) {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { status },
      { new: true }
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    return conversation;
  }

  /**
   * Assign conversation to a team member
   * @param {String} userId
   * @param {String} conversationId
   * @param {String} assignedToUserId
   * @returns {Object} Updated conversation
   */
  async assignConversation(userId, conversationId, assignedToUserId) {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { assignedTo: assignedToUserId },
      { new: true }
    ).populate("assignedTo", "name email");

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    return conversation;
  }

  /**
   * Add tags to a conversation
   * @param {String} userId
   * @param {String} conversationId
   * @param {Array} tags - Array of tag strings
   * @returns {Object} Updated conversation
   */
  async addTags(userId, conversationId, tags) {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { $addToSet: { tags: { $each: tags } } },
      { new: true }
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    return conversation;
  }

  /**
   * Remove tags from a conversation
   * @param {String} userId
   * @param {String} conversationId
   * @param {Array} tags - Array of tag strings to remove
   * @returns {Object} Updated conversation
   */
  async removeTags(userId, conversationId, tags) {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, userId },
      { $pull: { tags: { $in: tags } } },
      { new: true }
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    return conversation;
  }
}

module.exports = new ConversationService();
