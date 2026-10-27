const Order = require("../models/Order.model");
const Customer = require("../models/Customer.model");
const User = require("../models/User.model");
const orderHelper = require("../utils/order.helper");

class OrderService {
  // Get all orders with filters
  async getOrders(userId, filters = {}) {
    const {
      status,
      paymentStatus,
      customerId,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const query = { userId };

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (customerId) query.customerId = customerId;

    // Handle search - search by order number or customer name/phone
    if (search) {
      const customers = await Customer.find({
        userId,
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const customerIds = customers.map((c) => c._id);

      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerId: { $in: customerIds } },
      ];
    }

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

  // Create new order. Line totals, subtotal and total are computed here
  // rather than trusted from the client.
  async createOrder(userId, orderData) {
    const { customerId, items, tax = 0, shipping = 0, paymentMethod, shippingAddress, notes } = orderData;

    const customer = await Customer.findOne({ _id: customerId, userId });
    if (!customer) {
      throw new Error("Customer not found");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Add at least one item");
    }

    const lines = items.map((item) => {
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      if (!item.name || !(quantity > 0) || !(price >= 0)) {
        throw new Error("Each item needs a name, a price and a quantity above 0");
      }
      const total = Math.round(price * quantity * 100) / 100;
      return { productId: item.productId || undefined, name: item.name, quantity, price, total };
    });

    const subtotal = Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100;
    const taxAmount = Math.max(0, Math.round(Number(tax) * 100) / 100 || 0);
    const shippingAmount = Math.max(0, Number(shipping) || 0);
    const total = Math.round((subtotal + taxAmount + shippingAmount) * 100) / 100;

    const order = await Order.create({
      userId,
      customerId,
      orderNumber: orderHelper.generateOrderNumber(),
      platform: orderData.platform || customer.platform,
      items: lines,
      subtotal,
      tax: taxAmount,
      shipping: shippingAmount,
      total,
      paymentMethod,
      shippingAddress,
      notes,
    });

    // Update customer stats
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { totalOrders: 1, totalSpent: total },
    });

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { "stats.totalOrders": 1, "stats.totalRevenue": total },
    });

    return order.populate("customerId", "name phone email platform");
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

    const { status, paymentStatus } = statusData;

    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    await order.save();
    return order.populate("customerId", "name phone email platform");
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
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
          },
          processing: {
            $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] },
          },
          shipped: {
            $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] },
          },
          delivered: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
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
        pending: 0,
        confirmed: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        paidOrders: 0,
        pendingPayments: 0,
      }
    );
  }
}

module.exports = new OrderService();
