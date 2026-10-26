const express = require("express");
const router = express.Router();
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
} = require("../controllers/order.controller");

// @route   GET /api/orders
// @desc    Get all orders
// @access  Private
router.get("/", protect, checkSubscription, getOrders);

// @route   GET /api/orders/stats
// @desc    Get order statistics
// @access  Private
router.get("/stats", protect, checkSubscription, getOrderStats);

// @route   GET /api/orders/:id
// @desc    Get single order
// @access  Private
router.get("/:id", protect, checkSubscription, getOrder);

// @route   POST /api/orders
// @desc    Create new order
// @access  Private
router.post("/", protect, checkSubscription, createOrder);

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.put("/:id/status", protect, checkSubscription, updateOrderStatus);

// @route   DELETE /api/orders/:id
// @desc    Delete order
// @access  Private
router.delete("/:id", protect, checkSubscription, deleteOrder);

module.exports = router;
