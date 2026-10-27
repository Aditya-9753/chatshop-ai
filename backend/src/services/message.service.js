const Message = require("../models/Message.model");
const Customer = require("../models/Customer.model");
const User = require("../models/User.model");
const Conversation = require("../models/Conversation.model");
const conversationService = require("./conversation.service");
const channelService = require("./channel.service");
const whatsappApi = require("../utils/whatsapp.api");
const realtime = require("../realtime/socket");

// Outgoing statuses only move forward: a late "delivered" webhook must not
// overwrite "read". "failed" can only replace queued or sent.
const STATUS_RANK = { queued: 0, sent: 1, delivered: 2, read: 3 };

const lowerStatuses = (status) =>
  status === "failed"
    ? ["queued", "sent"]
    : Object.keys(STATUS_RANK).filter((s) => STATUS_RANK[s] < STATUS_RANK[status]);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  // Send a message from the dashboard: save it as queued, hand it to the
  // platform, then record sent (with the platform ID) or failed.
  async sendMessage(userId, messageData) {
    const {
      customerId,
      type = "text",
      content = {},
      isAIGenerated = false,
      replyTo = null,
    } = messageData;

    const customer = await Customer.findOne({ _id: customerId, userId });
    if (!customer) {
      throw new Error("Customer not found");
    }
    if (customer.isBlocked) {
      throw new Error("This customer is blocked");
    }

    const platform = messageData.platform || customer.platform;
    const normalizedContent = {
      text: content.text || "",
      mediaUrl: content.mediaUrl || null,
      caption: content.caption || null,
      fileName: content.fileName,
      mimeType: content.mimeType,
      fileSize: content.fileSize,
      duration: content.duration,
      location: content.location,
    };

    if (!normalizedContent.text && !normalizedContent.mediaUrl && !normalizedContent.location) {
      throw new Error("Message is empty");
    }

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
      isAIGenerated,
      replyTo,
      status: "queued",
    });

    const updatedConversation = await conversationService.updateLastMessage(
      conversation._id,
      { content: normalizedContent, type, direction: "outgoing" },
    );

    await Customer.findByIdAndUpdate(customerId, { lastMessageDate: new Date() });
    await User.findByIdAndUpdate(userId, {
      $inc: {
        "stats.totalMessages": 1,
        "stats.messagesSent": 1,
        [`stats.platforms.${platform}`]: 1,
      },
    });

    await this.emitNewMessage(message, updatedConversation);
    return this.deliver(message, customer);
  }

  // Hand a queued message to its platform and record the outcome
  async deliver(message, customer) {
    const user = await User.findById(message.userId);

    try {
      const { platformMessageId } = await channelService.send(
        message.platform,
        user,
        customer,
        message,
      );
      message.status = "sent";
      message.errorDetails = undefined;
      if (platformMessageId) {
        message.metadata = { platformMessageId, timestamp: new Date() };
      }
    } catch (error) {
      message.status = "failed";
      message.errorDetails = {
        code: error.code || "SEND_FAILED",
        message: error.message || "Message could not be delivered",
        timestamp: new Date(),
      };
    }

    await message.save();
    this.emitStatus(message);
    return message;
  }

  // Try a failed message again
  async retryMessage(userId, messageId) {
    const message = await Message.findOne({
      _id: messageId,
      userId,
      direction: "outgoing",
      isDeleted: false,
    });

    if (!message) {
      throw new Error("Message not found");
    }
    if (message.status !== "failed") {
      throw new Error("Only failed messages can be retried");
    }

    const customer = await Customer.findById(message.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    message.status = "queued";
    await message.save();
    this.emitStatus(message);
    return this.deliver(message, customer);
  }

  // Find the customer a webhook message came from, or create them
  async findOrCreateSender(user, platform, sender) {
    const { platformId, name, resolveName } = sender;

    let customer = await Customer.findOne({ userId: user._id, platform, platformId });

    // A customer added by hand has a phone number but no WhatsApp ID yet
    if (!customer && platform === "whatsapp") {
      const digits = platformId.replace(/\D/g, "");
      customer = await Customer.findOne({
        userId: user._id,
        platform,
        phone: new RegExp(`^\\D*${digits.split("").map(escapeRegex).join("\\D*")}\\D*$`),
      });
      if (customer) {
        customer.platformId = platformId;
      }
    }

    if (!customer) {
      const resolvedName = name || (resolveName && (await resolveName())) || null;
      customer = await Customer.create({
        userId: user._id,
        platform,
        platformId,
        phone: platform === "whatsapp" ? `+${platformId}` : undefined,
        name: resolvedName || (platform === "whatsapp" ? `+${platformId}` : "Unknown"),
      });

      await User.findByIdAndUpdate(user._id, { $inc: { "stats.totalCustomers": 1 } });
    }

    return customer;
  }

  // Save a message that arrived through a platform webhook. Returns null
  // when the webhook was a re-delivery of a message we already have.
  async receiveMessage({ user, platform, sender, platformMessageId, type, content, timestamp }) {
    if (
      platformMessageId &&
      (await Message.exists({ "metadata.platformMessageId": platformMessageId }))
    ) {
      return null;
    }

    const customer = await this.findOrCreateSender(user, platform, sender);
    const conversation = await conversationService.getOrCreateConversation(
      user._id,
      customer._id,
      platform,
    );

    let message;
    try {
      message = await Message.create({
        userId: user._id,
        customerId: customer._id,
        conversationId: conversation._id,
        platform,
        direction: "incoming",
        type,
        content,
        status: "received",
        metadata: {
          ...(platformMessageId && { platformMessageId }),
          timestamp: timestamp || new Date(),
        },
      });
    } catch (error) {
      // Two deliveries of the same webhook raced past the check above
      if (error.code === 11000) return null;
      throw error;
    }

    const updatedConversation = await conversationService.updateLastMessage(
      conversation._id,
      { content, type, direction: "incoming" },
    );

    customer.lastMessageDate = new Date();
    await customer.save();

    await User.findByIdAndUpdate(user._id, {
      $inc: {
        "stats.totalMessages": 1,
        "stats.messagesReceived": 1,
        [`stats.platforms.${platform}`]: 1,
      },
    });

    await this.emitNewMessage(message, updatedConversation);
    return message;
  }

  // Apply a delivery receipt (sent / delivered / read / failed) from a webhook
  async applyDeliveryStatus(platformMessageId, status, { timestamp, error } = {}) {
    if (!platformMessageId || !(status in STATUS_RANK || status === "failed")) {
      return null;
    }

    const at = timestamp || new Date();
    const update = { status };
    if (status === "delivered") update["metadata.deliveredAt"] = at;
    if (status === "read") update["metadata.readAt"] = at;
    if (status === "failed") {
      update.errorDetails = {
        code: error?.code ? String(error.code) : "DELIVERY_FAILED",
        message: error?.message || "Message could not be delivered",
        timestamp: at,
      };
    }

    const message = await Message.findOneAndUpdate(
      {
        "metadata.platformMessageId": platformMessageId,
        direction: "outgoing",
        status: { $in: lowerStatuses(status) },
      },
      { $set: update },
      { new: true },
    );

    if (message) this.emitStatus(message);
    return message;
  }

  // Messenger and Instagram send one "read up to" watermark per customer
  // instead of a receipt per message.
  async markReadUpTo(userId, customerId, watermark) {
    const messages = await Message.find({
      userId,
      customerId,
      direction: "outgoing",
      status: { $in: ["sent", "delivered"] },
      createdAt: { $lte: watermark },
    }).select("_id");

    for (const { _id } of messages) {
      const message = await Message.findByIdAndUpdate(
        _id,
        { $set: { status: "read", "metadata.readAt": watermark } },
        { new: true },
      );
      this.emitStatus(message);
    }
  }

  async emitNewMessage(message, conversation) {
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

  emitStatus(message) {
    realtime.emitToUser(message.userId, "message:status", {
      messageId: message._id,
      customerId: message.customerId,
      conversationId: message.conversationId,
      status: message.status,
      errorDetails: message.errorDetails,
    });
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

  // Get all messages for a specific customer, marking incoming ones read
  async getCustomerMessages(userId, customerId) {
    const messages = await Message.find({
      userId,
      customerId,
      isDeleted: false, // Exclude deleted messages
    })
      .populate("replyTo", "content type direction") // Populate reply-to messages
      .sort({ createdAt: 1 })
      .lean();

    const { modifiedCount } = await Message.updateMany(
      { userId, customerId, direction: "incoming", isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    await Conversation.updateMany({ userId, customerId }, { unreadCount: 0 });

    if (modifiedCount > 0) {
      this.sendWhatsAppReadReceipt(userId, messages);
    }

    return messages;
  }

  // Show blue ticks on the customer's phone for the latest incoming message.
  // Best effort: a failure here must not break opening the chat.
  async sendWhatsAppReadReceipt(userId, messages) {
    const latest = [...messages]
      .reverse()
      .find(
        (m) =>
          m.platform === "whatsapp" &&
          m.direction === "incoming" &&
          m.metadata?.platformMessageId,
      );
    if (!latest) return;

    try {
      const user = await User.findById(userId);
      const config = user?.whatsappConfig;
      if (!config?.isConnected || !config.phoneNumberId || !config.accessToken) return;
      await whatsappApi.markAsRead(
        config.phoneNumberId,
        config.accessToken,
        latest.metadata.platformMessageId,
      );
    } catch (error) {
      console.warn("WhatsApp read receipt failed:", error.message);
    }
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
