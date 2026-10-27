const mongoose = require("mongoose");
const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Conversation = require("../models/Conversation.model");
const { REVENUE_MATCH, ORDER_MATCH } = require("../utils/revenue");

const DAY_MS = 24 * 60 * 60 * 1000;
const LOW_STOCK_THRESHOLD = 5;
const PLATFORMS = ["whatsapp", "instagram", "facebook"];

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const validTimeZone = (tz) => {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
};

// Every calendar day (YYYY-MM-DD in `tz`) between start and end
const dayKeys = (start, end, tz) => {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  const keys = new Set();
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS / 2) {
    keys.add(format.format(new Date(t)));
  }
  keys.add(format.format(end));
  return [...keys];
};

/**
 * Reporting for the dashboard and analytics pages. Every KPI is returned
 * for the requested period and the period of equal length before it, so
 * the UI can show a delta.
 */
class ReportService {
  async report(userId, { start, end, tz = "UTC" }) {
    userId = new mongoose.Types.ObjectId(userId);
    tz = validTimeZone(tz);
    end = end ? new Date(end) : new Date();
    start = start ? new Date(start) : new Date(end.getTime() - 7 * DAY_MS);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new Error("Invalid date range");
    }
    const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));

    const inRange = (from, to) => ({ createdAt: { $gte: from, $lt: to } });
    const bothPeriods = { createdAt: { $gte: previousStart, $lt: end } };
    const periodOf = { $cond: [{ $gte: ["$createdAt", start] }, "current", "previous"] };
    const day = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } };

    const [orderTotals, customerTotals, messageTotals, orderSeries, messageSeries, customerSeries, channelOrders, channelMessages, channelCustomers, topProducts, topCustomers, responseTimes] =
      await Promise.all([
        Order.aggregate([
          { $match: { userId, ...bothPeriods, ...ORDER_MATCH } },
          {
            $group: {
              _id: periodOf,
              orders: { $sum: 1 },
              revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } },
              paidOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
            },
          },
        ]),
        Customer.aggregate([{ $match: { userId, ...bothPeriods } }, { $group: { _id: periodOf, count: { $sum: 1 } } }]),
        Message.aggregate([
          { $match: { userId, ...bothPeriods } },
          {
            $group: {
              _id: periodOf,
              received: { $sum: { $cond: [{ $eq: ["$direction", "incoming"] }, 1, 0] } },
              sent: { $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] } },
            },
          },
        ]),
        Order.aggregate([
          { $match: { userId, ...inRange(start, end), ...ORDER_MATCH } },
          {
            $group: {
              _id: day,
              orders: { $sum: 1 },
              revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } },
            },
          },
        ]),
        Message.aggregate([
          { $match: { userId, ...inRange(start, end) } },
          {
            $group: {
              _id: day,
              messagesIn: { $sum: { $cond: [{ $eq: ["$direction", "incoming"] }, 1, 0] } },
              messagesOut: { $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] } },
            },
          },
        ]),
        Customer.aggregate([{ $match: { userId, ...inRange(start, end) } }, { $group: { _id: day, newCustomers: { $sum: 1 } } }]),
        Order.aggregate([
          { $match: { userId, ...inRange(start, end), ...REVENUE_MATCH } },
          { $group: { _id: "$platform", revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
        ]),
        Message.aggregate([{ $match: { userId, ...inRange(start, end) } }, { $group: { _id: "$platform", messages: { $sum: 1 } } }]),
        Customer.aggregate([{ $match: { userId } }, { $group: { _id: "$platform", customers: { $sum: 1 } } }]),
        Order.aggregate([
          { $match: { userId, ...inRange(start, end), ...REVENUE_MATCH } },
          { $unwind: "$items" },
          {
            $group: {
              _id: { $ifNull: ["$items.productId", "$items.name"] },
              name: { $first: "$items.name" },
              quantity: { $sum: "$items.quantity" },
              revenue: { $sum: { $ifNull: ["$items.total", { $multiply: ["$items.price", "$items.quantity"] }] } },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
        ]),
        Order.aggregate([
          { $match: { userId, ...inRange(start, end), ...REVENUE_MATCH } },
          { $group: { _id: "$customerId", revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
          { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "customer" } },
          { $unwind: "$customer" },
          { $project: { revenue: 1, orders: 1, name: "$customer.name", platform: "$customer.platform", phone: "$customer.phone" } },
        ]),
        this.responseTimes(userId, previousStart, start, end),
      ]);

    const pick = (rows, period, field) => rows.find((r) => r._id === period)?.[field] || 0;
    const pair = (rows, field) => ({ current: pick(rows, "current", field), previous: pick(rows, "previous", field) });

    const revenue = pair(orderTotals, "revenue");
    const paidOrders = pair(orderTotals, "paidOrders");

    const byDay = (rows) => Object.fromEntries(rows.map((r) => [r._id, r]));
    const ordersByDay = byDay(orderSeries);
    const messagesByDay = byDay(messageSeries);
    const customersByDay = byDay(customerSeries);

    const series = dayKeys(start, new Date(end.getTime() - 1), tz).map((date) => ({
      date,
      revenue: ordersByDay[date]?.revenue || 0,
      orders: ordersByDay[date]?.orders || 0,
      messagesIn: messagesByDay[date]?.messagesIn || 0,
      messagesOut: messagesByDay[date]?.messagesOut || 0,
      newCustomers: customersByDay[date]?.newCustomers || 0,
    }));

    const channels = PLATFORMS.map((platform) => ({
      platform,
      revenue: channelOrders.find((r) => r._id === platform)?.revenue || 0,
      orders: channelOrders.find((r) => r._id === platform)?.orders || 0,
      messages: channelMessages.find((r) => r._id === platform)?.messages || 0,
      customers: channelCustomers.find((r) => r._id === platform)?.customers || 0,
    }));

    return {
      range: { start, end, previousStart, timeZone: tz },
      kpis: {
        revenue,
        orders: pair(orderTotals, "orders"),
        newCustomers: pair(customerTotals, "count"),
        messagesReceived: pair(messageTotals, "received"),
        messagesSent: pair(messageTotals, "sent"),
        averageOrderValue: {
          current: paidOrders.current ? revenue.current / paidOrders.current : 0,
          previous: paidOrders.previous ? revenue.previous / paidOrders.previous : 0,
        },
        responseTimeMinutes: responseTimes,
      },
      series,
      channels,
      topProducts: topProducts.map((p) => ({ productId: p._id, name: p.name, quantity: p.quantity, revenue: p.revenue })),
      topCustomers,
    };
  }

  // Median minutes from a customer's first unanswered message to our reply
  async responseTimes(userId, previousStart, start, end) {
    const messages = await Message.find({ userId, createdAt: { $gte: previousStart, $lt: end }, isDeleted: false })
      .select("customerId direction createdAt")
      .sort({ customerId: 1, createdAt: 1 })
      .limit(50000)
      .lean();

    const current = [];
    const previous = [];
    let customer = null;
    let waitingSince = null;

    for (const message of messages) {
      if (String(message.customerId) !== customer) {
        customer = String(message.customerId);
        waitingSince = null;
      }
      if (message.direction === "incoming") {
        waitingSince = waitingSince || message.createdAt;
      } else if (waitingSince) {
        const minutes = (message.createdAt - waitingSince) / 60000;
        (waitingSince >= start ? current : previous).push(minutes);
        waitingSince = null;
      }
    }

    return { current: median(current), previous: median(previous) };
  }

  // Latest things that happened in the shop: messages in, orders, new customers
  async recentActivity(userId, limit = 8) {
    const [messages, orders, customers] = await Promise.all([
      Message.find({ userId, direction: "incoming", isDeleted: false })
        .populate("customerId", "name platform")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Order.find({ userId }).populate("customerId", "name platform").sort({ createdAt: -1 }).limit(limit).lean(),
      Customer.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]);

    return [
      ...messages.map((m) => ({
        kind: "message",
        at: m.createdAt,
        customerId: m.customerId?._id,
        name: m.customerId?.name,
        platform: m.platform,
        text: m.content?.text || m.content?.caption || `[${m.type}]`,
      })),
      ...orders.map((o) => ({
        kind: "order",
        at: o.createdAt,
        orderId: o._id,
        name: o.customerId?.name,
        platform: o.platform,
        text: o.orderNumber,
        total: o.total,
        status: o.status,
      })),
      ...customers.map((c) => ({ kind: "customer", at: c.createdAt, customerId: c._id, name: c.name, platform: c.platform })),
    ]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, limit);
  }

  // Dashboard: last 7 days plus what needs attention right now
  async overview(userId, { tz }) {
    const objectId = new mongoose.Types.ObjectId(userId);
    const [report, user, unanswered, unansweredCount, pendingOrders, pendingCount, lowStock, lowStockCount, productCount, customerCount, orderCount] =
      await Promise.all([
        this.report(userId, { tz }),
        User.findById(userId),
        Conversation.find({ userId: objectId, status: { $ne: "closed" }, "lastMessage.direction": "incoming" })
          .populate("customerId", "name phone platform")
          .sort({ "lastMessage.timestamp": 1 })
          .limit(5)
          .lean(),
        Conversation.countDocuments({ userId: objectId, status: { $ne: "closed" }, "lastMessage.direction": "incoming" }),
        Order.find({ userId: objectId, status: "pending" }).populate("customerId", "name platform").sort({ createdAt: 1 }).limit(5).lean(),
        Order.countDocuments({ userId: objectId, status: "pending" }),
        Product.find({ userId: objectId, isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } }).sort({ stock: 1 }).limit(5).lean(),
        Product.countDocuments({ userId: objectId, isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } }),
        Product.countDocuments({ userId: objectId }),
        Customer.countDocuments({ userId: objectId }),
        Order.countDocuments({ userId: objectId }),
      ]);

    return {
      ...report,
      conversionRate: customerCount ? Math.round((orderCount / customerCount) * 1000) / 10 : 0,
      recentActivity: await this.recentActivity(objectId),
      attention: {
        unansweredChats: unanswered,
        unansweredCount,
        pendingOrders,
        pendingCount,
        lowStock,
        lowStockCount,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
      },
      channels: {
        whatsapp: { connected: !!user.whatsappConfig?.isConnected, label: user.whatsappConfig?.phoneNumber },
        instagram: { connected: !!user.instagramConfig?.isConnected, label: user.instagramConfig?.username },
        facebook: { connected: !!user.facebookConfig?.isConnected, label: user.facebookConfig?.pageName },
      },
      channelStats: report.channels,
      onboarding: {
        businessProfile: !!user.businessInfo?.businessName,
        whatsappConnected: !!user.whatsappConfig?.isConnected,
        firstProduct: productCount > 0,
        firstCustomer: customerCount > 0,
        firstOrder: orderCount > 0,
      },
    };
  }
}

module.exports = new ReportService();
module.exports.dayKeys = dayKeys;
module.exports.validTimeZone = validTimeZone;
