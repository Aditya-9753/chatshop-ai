const Message = require("../models/Message.model");
const Customer = require("../models/Customer.model");
const User = require("../models/User.model");

class MessageService {
  // Get all messages with filters
  async getMessages(userId, filters = {}) {
    const { customerId, platform, type, page = 1, limit = 50 } = filters;

    const query = { userId };

    if (customerId) query.customerId = customerId;
    if (platform) query.platform = platform;
    if (type) query.type = type;

    const messages = await Message.find(query)
      .populate("customerId", "name phone platform")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
    const { customerId, platform, type, content, isAIGenerated } = messageData;

    // Create message record
    const message = await Message.create({
      userId,
      customerId,
      platform,
      direction: "outgoing",
      type,
      content,
      isAIGenerated: isAIGenerated || false,
      status: "sent",
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

  // Delete message
  async deleteMessage(userId, messageId) {
    const message = await Message.findOneAndDelete({
      _id: messageId,
      userId,
    });

    if (!message) {
      throw new Error("Message not found");
    }

    return true;
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
}

module.exports = new MessageService();
