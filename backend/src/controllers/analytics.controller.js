const analyticsService = require("../services/analytics.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await analyticsService.getDashboardStats(req.user._id);
    return ResponseHandler.success(res, stats);
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get revenue analytics
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { period } = req.query;
    const analytics = await analyticsService.getRevenueAnalytics(
      req.user._id,
      period
    );
    return ResponseHandler.success(res, analytics);
  } catch (error) {
    console.error("Get revenue analytics error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get customer analytics
exports.getCustomerAnalytics = async (req, res) => {
  try {
    const analytics = await analyticsService.getCustomerAnalytics(req.user._id);
    return ResponseHandler.success(res, analytics);
  } catch (error) {
    console.error("Get customer analytics error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get message analytics
exports.getMessageAnalytics = async (req, res) => {
  try {
    const { period } = req.query;
    const analytics = await analyticsService.getMessageAnalytics(
      req.user._id,
      period
    );
    return ResponseHandler.success(res, analytics);
  } catch (error) {
    console.error("Get message analytics error:", error);
    return ResponseHandler.error(res, error.message);
  }
};
