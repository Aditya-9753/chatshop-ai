const mongoose = require("mongoose");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Conversation = require("../models/Conversation.model");

// Which shop each record belongs to, shown in every admin list
const SHOP_FIELDS = "name email phone businessInfo.businessName";

const MAX_LIMIT = 2000;

// Optional ?shop=<userId> filter shared by every list
const shopFilter = (shop) =>
  shop && mongoose.isValidObjectId(shop) ? { userId: new mongoose.Types.ObjectId(shop) } : {};

const limitOf = (limit, fallback = 500) => Math.min(Math.max(Number(limit) || fallback, 1), MAX_LIMIT);

/**
 * Platform-wide, read-only lists for the super admin: every shop's
 * orders, customers, products and conversations.
 */
class AdminDataService {
  async orders({ shop, status, limit } = {}) {
    const query = { ...shopFilter(shop) };
    if (status && status !== "all") query.status = status;
    return Order.find(query)
      .populate("userId", SHOP_FIELDS)
      .populate("customerId", "name phone email platform")
      .sort({ createdAt: -1 })
      .limit(limitOf(limit))
      .lean();
  }

  async customers({ shop, limit } = {}) {
    return Customer.find(shopFilter(shop))
      .populate("userId", SHOP_FIELDS)
      .sort({ lastMessageDate: -1, createdAt: -1 })
      .limit(limitOf(limit))
      .lean();
  }

  async products({ shop, limit } = {}) {
    return Product.find(shopFilter(shop))
      .populate("userId", SHOP_FIELDS)
      .sort({ createdAt: -1 })
      .limit(limitOf(limit))
      .lean();
  }

  async conversations({ shop, limit } = {}) {
    return Conversation.find(shopFilter(shop))
      .populate("userId", SHOP_FIELDS)
      .populate("customerId", "name phone platform")
      .sort({ "lastMessage.timestamp": -1 })
      .limit(limitOf(limit))
      .lean();
  }

  // Full thread of one conversation, oldest first (read-only for admins)
  async conversationMessages(conversationId) {
    const conversation = await Conversation.findById(conversationId)
      .populate("userId", SHOP_FIELDS)
      .populate("customerId", "name phone platform")
      .lean();
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const messages = await Message.find({
      userId: conversation.userId._id,
      customerId: conversation.customerId?._id,
      platform: conversation.platform,
      isDeleted: false,
    })
      .sort({ createdAt: 1 })
      .limit(MAX_LIMIT)
      .lean();

    return { conversation, messages };
  }
}

module.exports = new AdminDataService();
