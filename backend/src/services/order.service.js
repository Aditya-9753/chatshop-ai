const Order = require("../models/Order.model");
const Customer = require("../models/Customer.model");
const User = require("../models/User.model");
const orderHelper = require("../utils/order.helper");

class OrderService {
  // Get all orders with filters
  async getOrders(userId, filters = {}) {
    const { status, paymentStatus, customerId, page = 1, limit = 20 } = filters;

    const query = { userId };

    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (customerId) query.customerId = customerId;

    const orders = await Order.find(query)
      .populate("customerId", "name phone platform")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Order.countDocuments(query);

    return {
      orders,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    };
  }

  // Get single order
  async getOrder(userId, orderId) {
    const order = await Order.findOne({
      _id: orderId,
      userId,
    }).populate("customerId", "name phone email platform");

    if (!order) {
      throw new Error("Order not found");
    }

    return order;
  }

  // Create new order
  async createOrder(userId, orderData) {
    const {
      customerId,
      platform,
      items,
      subtotal,
      tax,
      shipping,
      total,
      paymentMethod,
      shippingAddress,
    } = orderData;

    const order = await Order.create({
      userId,
      customerId,
      orderNumber: orderHelper.generateOrderNumber(),
      platform,
      items,
      subtotal,
      tax,
      shipping,
      total,
      paymentMethod,
      shippingAddress,
    });

    // Update customer stats
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { totalOrders: 1, totalSpent: total },
    });

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { "stats.totalOrders": 1, "stats.totalRevenue": total },
    });

    return order;
  }

  // Update order status
  async updateOrderStatus(userId, orderId, statusData) {
    const order = await Order.findOne({
      _id: orderId,
      userId,
    });

    if (!order) {
      throw new Error("Order not found");
    }

    const { orderStatus, paymentStatus } = statusData;

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    await order.save();
    return order;
  }

  // Delete order
  async deleteOrder(userId, orderId) {
    const order = await Order.findOneAndDelete({
      _id: orderId,
      userId,
    });

    if (!order) {
      throw new Error("Order not found");
    }

    return true;
  }

  // Get order statistics
  async getOrderStats(userId, filters = {}) {
    const { startDate, endDate } = filters;

    const query = { userId };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "pending"] }, 1, 0] },
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "confirmed"] }, 1, 0] },
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "processing"] }, 1, 0] },
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "shipped"] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] },
          },
          paidOrders: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
          },
          pendingPayments: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] },
          },
        },
      },
    ]);

    return (
      stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        processingOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        paidOrders: 0,
        pendingPayments: 0,
      }
    );
  }
}

module.exports = new OrderService();
