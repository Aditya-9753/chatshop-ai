const Message = require("../models/Message.model");
const Customer = require("../models/Customer.model");
const User = require("../models/User.model");
const conversationService = require("./conversation.service");
const messageEvents = require("./messageEvents");

// Outgoing statuses only move forward: a late "delivered" webhook must not
// overwrite "read". "failed" can only replace queued or sent.
const STATUS_RANK = { queued: 0, sent: 1, delivered: 2, read: 3 };

const lowerStatuses = (status) =>
  status === "failed"
    ? ["queued", "sent"]
    : Object.keys(STATUS_RANK).filter((s) => STATUS_RANK[s] < STATUS_RANK[status]);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Messages and delivery receipts arriving from platform webhooks
class InboundService {
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

    await messageEvents.emitNewMessage(message, updatedConversation);
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

    if (message) messageEvents.emitStatus(message);
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
      messageEvents.emitStatus(message);
    }
  }
}

module.exports = new InboundService();
