const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const Order = require("../models/Order.model");

class AdminService {
  // Get all users
  async getAllUsers(filters = {}) {
    const { page = 1, limit = 20, search, subscriptionStatus } = filters;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (subscriptionStatus) {
      query["subscription.status"] = subscriptionStatus;
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

    const revenueData = await Order.aggregate([
      { $match: { userId: user._id, paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    return {
      ...user.toObject(),
      stats: {
        totalCustomers,
        totalMessages,
        totalOrders,
        totalRevenue,
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
