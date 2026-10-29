const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Conversation = require("../models/Conversation.model");
const InternalNote = require("../models/InternalNote.model");
const subscriptionService = require("./subscription.service");
const { REVENUE_MATCH, ORDER_MATCH } = require("../utils/revenue");
const { dayKeys, validTimeZone } = require("./report.service");

const DAY_MS = 24 * 60 * 60 * 1000;

class AdminService {
  // Get dashboard overview stats
  async getDashboardStats() {
    // Total users
    const totalUsers = await User.countDocuments({ role: "user" });

    // Active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await User.countDocuments({
      role: "user",
      updatedAt: { $gte: thirtyDaysAgo },
    });

    // Premium users
    const premiumUsers = await User.countDocuments({
      role: "user",
      "subscription.status": "active",
    });

    // Free users
    const freeUsers = totalUsers - premiumUsers;

    // Users by plan
    const starterUsers = await User.countDocuments({
      role: "user",
      "subscription.plan": "starter",
      "subscription.status": "active",
    });

    const businessUsers = await User.countDocuments({
      role: "user",
      "subscription.plan": "business",
      "subscription.status": "active",
    });

    const premiumPlanUsers = await User.countDocuments({
      role: "user",
      "subscription.plan": "premium",
      "subscription.status": "active",
    });

    // Total revenue
    const totalRevenue = await this.calculateTotalRevenue();

    // Platform connections
    const whatsappConnected = await User.countDocuments({
      role: "user",
      "whatsappConfig.isConnected": true,
    });

    const instagramConnected = await User.countDocuments({
      role: "user",
      "instagramConfig.isConnected": true,
    });
    const facebookConnected = await User.countDocuments({
      role: "user",
      "facebookConfig.isConnected": true,
    });

    // Total entities across all users
    const totalCustomers = await Customer.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalMessages = await Message.countDocuments();

    // Recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSignups = await User.countDocuments({
      role: "user",
      createdAt: { $gte: sevenDaysAgo },
    });

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        premium: premiumUsers,
        free: freeUsers,
        recentSignups,
      },
      subscriptions: {
        starter: starterUsers,
        business: businessUsers,
        premium: premiumPlanUsers,
      },
      platforms: {
        whatsapp: whatsappConnected,
        instagram: instagramConnected,
        facebook: facebookConnected,
      },
      entities: {
        customers: totalCustomers,
        orders: totalOrders,
        products: totalProducts,
        messages: totalMessages,
      },
      revenue: {
        total: totalRevenue,
      },
    };
  }

  // Monthly recurring revenue from active subscriptions, priced from the
  // same plan list the billing page shows (one-time plans excluded)
  async calculateTotalRevenue() {
    const plans = subscriptionService.getPlans();
    const activeSubscriptions = await User.find({
      role: "user",
      "subscription.status": "active",
    }).select("subscription.plan");

    return activeSubscriptions.reduce((total, user) => {
      const plan = user.subscription?.plan;
      return plan && plan !== "one-time" ? total + (plans[plan]?.price || 0) : total;
    }, 0);
  }

  // Get all users
  async getAllUsers(filters = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      subscriptionStatus,
      plan,
      status,
    } = filters;

    const query = { role: "user" }; // Shops only: no admins, no shop staff

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (subscriptionStatus) {
      query["subscription.status"] = subscriptionStatus;
    }

    if (plan && plan !== "all") {
      if (plan === "free") {
        query.$or = [
          { "subscription.plan": { $exists: false } },
          { "subscription.plan": null },
          { "subscription.plan": "" },
        ];
      } else {
        query["subscription.plan"] = plan;
      }
    }

    if (status && status !== "all") {
      query["subscription.status"] = status;
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await User.countDocuments(query);
    const activity = await this.shopActivity(users.map((u) => u._id));

    return {
      users: users.map((u) => ({ ...u.toJSON(), activity: activity[u._id.toString()] })),
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    };
  }

  // Real per-shop numbers (customers, orders, revenue, messages), counted
  // from the collections rather than the cached user.stats
  async shopActivity(userIds) {
    const byUser = (rows, field = "count") => Object.fromEntries(rows.map((r) => [r._id.toString(), r[field]]));
    const match = { userId: { $in: userIds } };
    const [customers, orders, revenue, messages] = await Promise.all([
      Customer.aggregate([{ $match: match }, { $group: { _id: "$userId", count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { ...match, ...ORDER_MATCH } }, { $group: { _id: "$userId", count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { ...match, ...REVENUE_MATCH } }, { $group: { _id: "$userId", total: { $sum: "$total" } } }]),
      Message.aggregate([{ $match: match }, { $group: { _id: "$userId", count: { $sum: 1 } } }]),
    ]);
    const maps = { customers: byUser(customers), orders: byUser(orders), revenue: byUser(revenue, "total"), messages: byUser(messages) };
    return Object.fromEntries(
      userIds.map((id) => {
        const key = id.toString();
        return [key, { customers: maps.customers[key] || 0, orders: maps.orders[key] || 0, revenue: maps.revenue[key] || 0, messages: maps.messages[key] || 0 }];
      })
    );
  }

  // Platform activity per day for the last `days` days, plus the shops
  // that sold the most in that window
  async getDailyActivity({ days = 30, tz } = {}) {
    tz = validTimeZone(tz || "UTC");
    days = Math.min(Math.max(Number(days) || 30, 7), 365);
    const end = new Date();
    const start = new Date(end.getTime() - days * DAY_MS);
    const range = { createdAt: { $gte: start, $lt: end } };
    const day = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } };

    const [signups, orders, messages, top] = await Promise.all([
      User.aggregate([{ $match: { role: "user", ...range } }, { $group: { _id: day, signups: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { ...range, ...ORDER_MATCH } },
        {
          $group: {
            _id: day,
            orders: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } },
          },
        },
      ]),
      Message.aggregate([{ $match: range }, { $group: { _id: day, messages: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { ...range, ...REVENUE_MATCH } },
        { $group: { _id: "$userId", revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $project: { revenue: 1, orders: 1, name: "$user.name", email: "$user.email", business: "$user.businessInfo.businessName" } },
      ]),
    ]);

    const index = (rows) => Object.fromEntries(rows.map((r) => [r._id, r]));
    const s = index(signups);
    const o = index(orders);
    const m = index(messages);

    return {
      days,
      series: dayKeys(start, new Date(end.getTime() - 1), tz).map((date) => ({
        date,
        signups: s[date]?.signups || 0,
        orders: o[date]?.orders || 0,
        revenue: o[date]?.revenue || 0,
        messages: m[date]?.messages || 0,
      })),
      topShops: top,
    };
  }

  // Get single user with stats
  async getUser(userId) {
    const user = await User.findById(userId).select("-password");

    if (!user) {
      throw new Error("User not found");
    }

    // Get user statistics
    const totalCustomers = await Customer.countDocuments({ userId: user._id });
    const totalMessages = await Message.countDocuments({ userId: user._id });
    const totalOrders = await Order.countDocuments({ userId: user._id });
    const totalProducts = await Product.countDocuments({ userId: user._id });

    const revenueData = await Order.aggregate([
      { $match: { userId: user._id, ...REVENUE_MATCH } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    return {
      user: user.toObject(),
      stats: {
        customers: totalCustomers,
        messages: totalMessages,
        orders: totalOrders,
        products: totalProducts,
        revenue: totalRevenue,
      },
    };
  }

  // Update user
  async updateUser(userId, updateData) {
    const { role, subscription } = updateData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (role) user.role = role;
    if (subscription) {
      if (subscription.plan !== undefined) user.subscription.plan = subscription.plan || null;
      if (subscription.status) user.subscription.status = subscription.status;
      if (subscription.startDate)
        user.subscription.startDate = subscription.startDate;
      if (subscription.endDate)
        user.subscription.endDate = subscription.endDate;
    }

    await user.save();
    return user;
  }

  // Delete user and all data
  async deleteUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Delete all user data
    await Promise.all([
      Customer.deleteMany({ userId: user._id }),
      Message.deleteMany({ userId: user._id }),
      Order.deleteMany({ userId: user._id }),
      Product.deleteMany({ userId: user._id }),
      Conversation.deleteMany({ userId: user._id }),
      InternalNote.deleteMany({ userId: user._id }),
    ]);
    await user.deleteOne();

    return true;
  }

  // Get system statistics
  async getSystemStats() {
    const totalUsers = await User.countDocuments();
    const activeSubscriptions = await User.countDocuments({
      "subscription.status": "active",
    });
    const totalCustomers = await Customer.countDocuments();
    const totalMessages = await Message.countDocuments();
    const totalOrders = await Order.countDocuments();

    // Total revenue
    const revenueData = await Order.aggregate([
      { $match: REVENUE_MATCH },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    // Subscription distribution
    const subscriptionDistribution = await User.aggregate([
      {
        $group: {
          _id: "$subscription.plan",
          count: { $sum: 1 },
        },
      },
    ]);

    // Monthly revenue trend
    const monthlyRevenue = await Order.aggregate([
      { $match: REVENUE_MATCH },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]);

    // User growth
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]);

    // Platform usage: messages and customers per channel
    const [messagesByPlatform, customersByPlatform] = await Promise.all([
      Message.aggregate([{ $group: { _id: "$platform", count: { $sum: 1 } } }]),
      Customer.aggregate([{ $group: { _id: "$platform", count: { $sum: 1 } } }]),
    ]);
    const platformUsage = ["whatsapp", "instagram", "facebook"].map((platform) => ({
      platform,
      messages: messagesByPlatform.find((r) => r._id === platform)?.count || 0,
      customers: customersByPlatform.find((r) => r._id === platform)?.count || 0,
      connectedShops: 0,
    }));
    for (const usage of platformUsage) {
      usage.connectedShops = await User.countDocuments({ [`${usage.platform}Config.isConnected`]: true });
    }

    return {
      platformUsage,
      totalUsers,
      activeSubscriptions,
      totalCustomers,
      totalMessages,
      totalOrders,
      totalRevenue,
      subscriptionDistribution,
      monthlyRevenue,
      userGrowth,
    };
  }
}

module.exports = new AdminService();
