const analyticsService = require("../services/analytics.service");
const reportService = require("../services/report.service");
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

// @desc    Dashboard overview: last 7 days vs the 7 before, plus what needs attention
// @route   GET /api/analytics/overview?tz=Asia/Kolkata
exports.getOverview = async (req, res) => {
  try {
    const overview = await reportService.overview(req.user._id, { tz: req.query.tz });
    return ResponseHandler.success(res, overview);
  } catch (error) {
    console.error("Get overview error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Report for any date range, compared with the period before it
// @route   GET /api/analytics/report?start=ISO&end=ISO&tz=Asia/Kolkata
exports.getReport = async (req, res) => {
  try {
    const { start, end, tz } = req.query;
    const report = await reportService.report(req.user._id, { start, end, tz });
    return ResponseHandler.success(res, report);
  } catch (error) {
    console.error("Get report error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};
