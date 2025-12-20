const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");

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

  // Calculate total revenue
  async calculateTotalRevenue() {
    const planPrices = {
      starter: 499,
      business: 999,
      premium: 1999,
    };

    const activeSubscriptions = await User.find({
      role: "user",
      "subscription.status": "active",
    }).select("subscription.plan");

    let total = 0;
    activeSubscriptions.forEach((user) => {
      if (user.subscription && user.subscription.plan) {
        total += planPrices[user.subscription.plan] || 0;
      }
    });

    return total;
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

    const query = { role: { $ne: "admin" } }; // Exclude admin users

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

    return {
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
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
      { $match: { userId: user._id, paymentStatus: "paid" } },
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
      if (subscription.plan) user.subscription.plan = subscription.plan;
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
    await Customer.deleteMany({ userId: user._id });
    await Message.deleteMany({ userId: user._id });
    await Order.deleteMany({ userId: user._id });
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
      { $match: { paymentStatus: "paid" } },
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
      { $match: { paymentStatus: "paid" } },
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

    return {
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
