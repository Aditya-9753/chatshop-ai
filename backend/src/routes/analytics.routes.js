const express = require("express");
const router = express.Router();
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const {
  getDashboardStats,
  getRevenueAnalytics,
  getCustomerAnalytics,
  getMessageAnalytics,
  getOverview,
  getReport,
} = require("../controllers/analytics.controller");

// @route   GET /api/analytics/overview
// @desc    Dashboard KPIs (7 days vs previous 7), needs-attention lists, channels
// @access  Private
router.get("/overview", protect, checkSubscription, getOverview);

// @route   GET /api/analytics/report
// @desc    KPIs, daily series, channel split and top products for a date range
// @access  Private
router.get("/report", protect, checkSubscription, getReport);

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get("/dashboard", protect, checkSubscription, getDashboardStats);

// @route   GET /api/analytics/revenue
// @desc    Get revenue analytics
// @access  Private
router.get("/revenue", protect, checkSubscription, getRevenueAnalytics);

// @route   GET /api/analytics/customers
// @desc    Get customer analytics
// @access  Private
router.get("/customers", protect, checkSubscription, getCustomerAnalytics);

// @route   GET /api/analytics/messages
// @desc    Get message analytics
// @access  Private
router.get("/messages", protect, checkSubscription, getMessageAnalytics);

module.exports = router;
