const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const { REVENUE_MATCH } = require("../utils/revenue");

class AnalyticsService {
  // Get dashboard statistics
  async getDashboardStats(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get counts
    const totalCustomers = await Customer.countDocuments({ userId });
    const totalMessages = await Message.countDocuments({ userId });
    const totalOrders = await Order.countDocuments({ userId });
    const totalProducts = await Product.countDocuments({ userId });

    // Get revenue
    const revenueData = await Order.aggregate([
      { $match: { userId, ...REVENUE_MATCH } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayMessages = await Message.countDocuments({
      userId,
      createdAt: { $gte: today },
    });

    const todayOrders = await Order.countDocuments({
      userId,
      createdAt: { $gte: today },
    });

    // Get platform distribution
    const whatsappCustomers = await Customer.countDocuments({
      userId,
      platform: "whatsapp",
    });

    const instagramCustomers = await Customer.countDocuments({
      userId,
      platform: "instagram",
    });

    // Calculate conversion rate (orders / customers)
    const conversionRate =
      totalCustomers > 0
        ? ((totalOrders / totalCustomers) * 100).toFixed(2)
        : 0;

    return {
      totalCustomers,
      totalMessages,
      totalOrders,
      totalProducts,
      totalRevenue,
      conversionRate,
      todayMessages,
      todayOrders,
      whatsappCustomers,
      instagramCustomers,
      subscription: user.subscription,
      whatsappConnected: user.whatsappConfig.isConnected,
      instagramConnected: user.instagramConfig.isConnected,
    };
  }

  // Get revenue analytics
  async getRevenueAnalytics(userId, period = "month") {
    let groupBy;
    let dateRange = new Date();

    if (period === "week") {
      dateRange.setDate(dateRange.getDate() - 7);
      groupBy = { $dayOfYear: "$createdAt" };
    } else if (period === "month") {
      dateRange.setMonth(dateRange.getMonth() - 1);
      groupBy = { $dayOfMonth: "$createdAt" };
    } else if (period === "year") {
      dateRange.setFullYear(dateRange.getFullYear() - 1);
      groupBy = { $month: "$createdAt" };
    }

    const revenueData = await Order.aggregate([
      {
        $match: {
          userId,
          ...REVENUE_MATCH,
          createdAt: { $gte: dateRange },
        },
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return revenueData;
  }

  // Get customer analytics
  async getCustomerAnalytics(userId) {
    // Top customers by spending
    const topCustomers = await Customer.find({ userId })
      .sort({ totalSpent: -1 })
      .limit(10)
      .select("name phone platform totalOrders totalSpent");

    // Customer growth
    const customerGrowth = await Customer.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);

    // Platform distribution
    const platformDistribution = await Customer.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$platform",
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      topCustomers,
      customerGrowth,
      platformDistribution,
    };
  }

  // Get message analytics
  async getMessageAnalytics(userId, period = "week") {
    let dateRange = new Date();

    if (period === "week") {
      dateRange.setDate(dateRange.getDate() - 7);
    } else if (period === "month") {
      dateRange.setMonth(dateRange.getMonth() - 1);
    } else if (period === "year") {
      dateRange.setFullYear(dateRange.getFullYear() - 1);
    }

    // Message volume over time
    const messageVolume = await Message.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: dateRange },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
          incoming: {
            $sum: { $cond: [{ $eq: ["$direction", "incoming"] }, 1, 0] },
          },
          outgoing: {
            $sum: { $cond: [{ $eq: ["$direction", "outgoing"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Platform distribution
    const platformMessages = await Message.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$platform",
          count: { $sum: 1 },
        },
      },
    ]);

    // AI usage
    const aiUsage = await Message.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          aiGenerated: { $sum: { $cond: ["$isAIGenerated", 1, 0] } },
        },
      },
    ]);

    const aiStats = aiUsage[0] || { total: 0, aiGenerated: 0 };
    const aiPercentage =
      aiStats.total > 0 ? (aiStats.aiGenerated / aiStats.total) * 100 : 0;

    return {
      messageVolume,
      platformMessages,
      aiStats: {
        ...aiStats,
        percentage: aiPercentage.toFixed(2),
      },
    };
  }
}

module.exports = new AnalyticsService();
