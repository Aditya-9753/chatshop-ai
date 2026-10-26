const express = require("express");
const router = express.Router();
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const {
  getDashboardStats,
  getRevenueAnalytics,
  getCustomerAnalytics,
  getMessageAnalytics,
} = require("../controllers/analytics.controller");

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
