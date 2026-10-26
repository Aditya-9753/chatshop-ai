const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const {
  getPlans,
  createSubscription,
  verifyPayment,
  getSubscriptionDetails,
  cancelSubscription,
} = require("../controllers/subscription.controller");

// @route   GET /api/subscriptions/plans
// @desc    Get all subscription plans
// @access  Public
router.get("/plans", getPlans);

// @route   POST /api/subscriptions/create
// @desc    Create Razorpay subscription
// @access  Private
router.post("/create", protect, createSubscription);

// @route   POST /api/subscriptions/verify
// @desc    Verify payment and activate subscription
// @access  Private
router.post("/verify", protect, verifyPayment);

// @route   GET /api/subscriptions/details
// @desc    Get current subscription details
// @access  Private
router.get("/details", protect, getSubscriptionDetails);

// @route   POST /api/subscriptions/cancel
// @desc    Cancel subscription
// @access  Private
router.post("/cancel", protect, cancelSubscription);

module.exports = router;
