const adminService = require("../services/admin.service");
const ResponseHandler = require("../utils/response.handler");
const audit = require("../utils/audit");
const cache = require("../utils/cache");
const User = require("../models/User.model");

// @desc    Get admin dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    return ResponseHandler.success(res, stats);
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const result = await adminService.getAllUsers(req.query);
    return ResponseHandler.paginated(res, result.users, {
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      total: result.total,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await adminService.getUser(req.params.id);
    return ResponseHandler.success(res, user);
  } catch (error) {
    console.error("Get user error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Update user
exports.updateUser = async (req, res) => {
  try {
    const user = await adminService.updateUser(req.params.id, req.body);
    cache.clear();
    await audit(req, "shop.update", {
      target: user.email,
      details: req.body.subscription ? `Plan ${user.subscription?.plan || "none"}, ${user.subscription?.status}` : undefined,
    });
    return ResponseHandler.success(res, user, "User updated successfully");
  } catch (error) {
    console.error("Update user error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete user
exports.deleteUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id).select("email");
    await adminService.deleteUser(req.params.id);
    cache.clear();
    await audit(req, "shop.delete", { target: target?.email || req.params.id });
    return ResponseHandler.success(
      res,
      null,
      "User and all associated data deleted successfully"
    );
  } catch (error) {
    console.error("Delete user error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Get system statistics
exports.getSystemStats = async (req, res) => {
  try {
    const stats = await adminService.getSystemStats();
    return ResponseHandler.success(res, stats);
  } catch (error) {
    console.error("Get system stats error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Platform activity per day (signups, orders, revenue, messages)
// @route   GET /api/admin/activity?days=30&tz=Asia/Kolkata
exports.getDailyActivity = async (req, res) => {
  try {
    const data = await adminService.getDailyActivity(req.query);
    return ResponseHandler.success(res, data);
  } catch (error) {
    console.error("Get daily activity error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

const adminDataService = require("../services/adminData.service");

// Platform-wide lists: GET /api/admin/{orders,customers,products,conversations}?shop=&limit=
const listHandler = (method) => async (req, res) => {
  try {
    const rows = await adminDataService[method](req.query);
    return ResponseHandler.success(res, rows);
  } catch (error) {
    console.error(`Admin ${method} error:`, error);
    return ResponseHandler.error(res, error.message);
  }
};

exports.getAllOrders = listHandler("orders");
exports.getAllCustomers = listHandler("customers");
exports.getAllProducts = listHandler("products");
exports.getAllConversations = listHandler("conversations");

// @desc    One conversation's messages (read-only)
// @route   GET /api/admin/conversations/:id/messages
exports.getConversationMessages = async (req, res) => {
  try {
    const data = await adminDataService.conversationMessages(req.params.id);
    return ResponseHandler.success(res, data);
  } catch (error) {
    console.error("Admin conversation messages error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};
