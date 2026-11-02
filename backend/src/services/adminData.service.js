const mongoose = require("mongoose");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Conversation = require("../models/Conversation.model");

// Which shop each record belongs to, shown in every admin list
const SHOP_FIELDS = "name email phone businessInfo.businessName";

const MAX_LIMIT = 2000;

// Optional ?shop=<userId> filter shared by every list. An Admin who looks
// after one shop (`scope`) only ever gets that shop, whatever ?shop says.
const shopFilter = (shop, scope) => {
  if (scope) return { userId: scope };
  return shop && mongoose.isValidObjectId(shop) ? { userId: new mongoose.Types.ObjectId(shop) } : {};
};

const limitOf = (limit, fallback = 500) => Math.min(Math.max(Number(limit) || fallback, 1), MAX_LIMIT);

/**
 * Read-only lists for the admin panels: every shop's orders, customers,
 * products and conversations, or one shop's for an Admin who looks after it.
 */
class AdminDataService {
  async orders({ shop, status, limit } = {}, scope) {
    const query = { ...shopFilter(shop, scope) };
    if (status && status !== "all") query.status = status;
    return Order.find(query)
      .populate("userId", SHOP_FIELDS)
      .populate("customerId", "name phone email platform")
      .sort({ createdAt: -1 })
      .limit(limitOf(limit))
      .lean();
  }

  async customers({ shop, limit } = {}, scope) {
    return Customer.find(shopFilter(shop, scope))
      .populate("userId", SHOP_FIELDS)
      .sort({ lastMessageDate: -1, createdAt: -1 })
      .limit(limitOf(limit))
      .lean();
  }

  async products({ shop, limit } = {}, scope) {
    return Product.find(shopFilter(shop, scope))
      .populate("userId", SHOP_FIELDS)
      .sort({ createdAt: -1 })
      .limit(limitOf(limit))
      .lean();
  }

  async conversations({ shop, limit } = {}, scope) {
    return Conversation.find(shopFilter(shop, scope))
      .populate("userId", SHOP_FIELDS)
      .populate("customerId", "name phone platform")
      .sort({ "lastMessage.timestamp": -1 })
      .limit(limitOf(limit))
      .lean();
  }

  // Full thread of one conversation, oldest first (read-only for admins)
  async conversationMessages(conversationId, scope) {
    if (!mongoose.isValidObjectId(conversationId)) throw new Error("Conversation not found");
    const conversation = await Conversation.findOne({ _id: conversationId, ...(scope && { userId: scope }) })
      .populate("userId", SHOP_FIELDS)
      .populate("customerId", "name phone platform")
      .lean();
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const messages = await Message.find({
      userId: conversation.userId?._id || conversation.userId, // the shop may have been deleted
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
