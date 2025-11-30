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
    })
      .sort({ createdAt: 1 })
      .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        userId,
        customerId,
        direction: "incoming",
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    return messages;
  }
}

module.exports = new MessageService();
