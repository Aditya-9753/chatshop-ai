const Message = require("../models/Message.model");
const Customer = require("../models/Customer.model");
const User = require("../models/User.model");
const Conversation = require("../models/Conversation.model");
const conversationService = require("./conversation.service");

class MessageService {
  // Get all messages with filters
  async getMessages(userId, filters = {}) {
    const { customerId, platform, type, page = 1, limit = 50 } = filters;

    const query = { userId, isDeleted: false }; // Exclude deleted messages

    if (customerId) query.customerId = customerId;
    if (platform) query.platform = platform;
    if (type) query.type = type;

    const messages = await Message.find(query)
      .populate("customerId", "name phone platform")
      .populate("replyTo", "content type") // Populate reply-to messages
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Message.countDocuments(query);

    return {
      messages,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    };
  }

  // Send message
  async sendMessage(userId, messageData) {
    const {
      customerId,
      platform,
      type,
      content = {},
      isAIGenerated = false,
      replyTo = null,
    } = messageData;

    // Create message record
    const normalizedContent = {
      text: content.text || "",
      mediaUrl: content.mediaUrl || null,
      caption: content.caption || null,
    };

    // Get or create conversation
    const conversation = await conversationService.getOrCreateConversation(
      userId,
      customerId,
      platform,
    );

    const message = await Message.create({
      userId,
      customerId,
      conversationId: conversation._id,
      platform,
      direction: "outgoing",
      type,
      content: normalizedContent,
      isAIGenerated: isAIGenerated || false,
      replyTo: replyTo || null,
      status: "sent",
    });

    // Update conversation with latest message
    await conversationService.updateLastMessage(conversation._id, {
      content: normalizedContent,
      type,
      direction: "outgoing",
    });

    // Update customer last message date
    await Customer.findByIdAndUpdate(customerId, {
      lastMessageDate: new Date(),
    });

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { "stats.totalMessages": 1 },
    });

    return message;
  }

  // Delete message (Soft Delete)
  async deleteMessage(userId, messageId) {
    const message = await Message.findOne({
      _id: messageId,
      userId,
      isDeleted: false,
    });

    if (!message) {
      throw new Error("Message not found or already deleted");
    }

    // Soft delete: Set flags instead of removing from database
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = "user";
    await message.save();

    return message;
  }

  // Edit message
  async editMessage(userId, messageId, newText) {
    const message = await Message.findOne({
      _id: messageId,
      userId,
      direction: "outgoing", // Only allow editing own messages
      isDeleted: false,
    });

    if (!message) {
      throw new Error("Message not found or cannot be edited");
    }

    // Check if message is older than 3 minutes
    const EDIT_TIME_LIMIT = 3 * 60 * 1000; // 3 minutes in milliseconds
    const messageAge = Date.now() - new Date(message.createdAt).getTime();

    if (messageAge > EDIT_TIME_LIMIT) {
      throw new Error("Message can only be edited within 3 minutes of sending");
    }

    // Save current content to edit history
    message.editHistory.push({
      previousContent: message.content.text,
      editedAt: new Date(),
    });

    // Update the message content
    message.content.text = newText;
    message.isEdited = true;
    await message.save();

    return message;
  }

  // Get message statistics
  async getMessageStats(userId, filters = {}) {
    const { startDate, endDate } = filters;

    const query = { userId };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const stats = await Message.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          incomingMessages: {
            $sum: { $cond: [{ $eq: ["$direction", "incoming"] }, 1, 0] },
          },
          outgoingMessages: {
            $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] },
          },
          aiGeneratedMessages: {
            $sum: { $cond: ["$isAIGenerated", 1, 0] },
          },
          whatsappMessages: {
            $sum: { $cond: [{ $eq: ["$platform", "whatsapp"] }, 1, 0] },
          },
          instagramMessages: {
            $sum: { $cond: [{ $eq: ["$platform", "instagram"] }, 1, 0] },
          },
        },
      },
    ]);

    return (
      stats[0] || {
        totalMessages: 0,
        incomingMessages: 0,
        outgoingMessages: 0,
        aiGeneratedMessages: 0,
        whatsappMessages: 0,
        instagramMessages: 0,
      }
    );
  }

  // Get conversations grouped by customer
  async getConversations(userId) {
    const conversations = await Message.aggregate([
      { $match: { userId } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$customerId",
          lastMessage: { $first: "$content" },
          lastMessageDate: { $first: "$createdAt" },
          platform: { $first: "$platform" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$direction", "incoming"] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          lastMessageDate: 1,
          platform: 1,
          unreadCount: 1,
          customer: {
            _id: "$customer._id",
            name: "$customer.name",
            phone: "$customer.phone",
            platform: "$customer.platform",
          },
        },
      },
      { $sort: { lastMessageDate: -1 } },
    ]);

    return conversations;
  }

  // Get all messages for a specific customer
  async getCustomerMessages(userId, customerId) {
    const messages = await Message.find({
      userId,
      customerId,
      isDeleted: false, // Exclude deleted messages
    })
      .populate("replyTo", "content type direction") // Populate reply-to messages
      .sort({ createdAt: 1 })
      .lean();

    // Mark incoming messages as read
    await Message.updateMany(
      {
        userId,
        customerId,
        direction: "incoming",
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          status: "read",
        },
      },
    );

    return messages;
  }

  // Mark a specific message as read
  async markMessageAsRead(userId, messageId) {
    const message = await Message.findOne({
      _id: messageId,
      userId,
      isDeleted: false,
    });

    if (!message) {
      throw new Error("Message not found");
    }

    // Update read status
    message.isRead = true;
    message.readAt = new Date();
    message.status = "read";

    // Add to seenBy array if not already there
    const alreadySeen = message.seenBy.some(
      (seen) => seen.userId.toString() === userId.toString(),
    );

    if (!alreadySeen) {
      message.seenBy.push({
        userId: userId,
        seenAt: new Date(),
      });
    }

    await message.save();
    return message;
  }
}

module.exports = new MessageService();
