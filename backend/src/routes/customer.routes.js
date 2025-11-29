const express = require("express");
const router = express.Router();
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  blockCustomer,
} = require("../controllers/customer.controller");

// @route   GET /api/customers
// @desc    Get all customers
// @access  Private
router.get("/", protect, checkSubscription, getCustomers);

// @route   GET /api/customers/:id
// @desc    Get single customer
// @access  Private
router.get("/:id", protect, checkSubscription, getCustomer);

// @route   POST /api/customers
// @desc    Create new customer
// @access  Private
router.post("/", protect, checkSubscription, createCustomer);

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private
router.put("/:id", protect, checkSubscription, updateCustomer);

// @route   DELETE /api/customers/:id
// @desc    Delete customer
// @access  Private
router.delete("/:id", protect, checkSubscription, deleteCustomer);

// @route   PUT /api/customers/:id/block
// @desc    Block/unblock customer
// @access  Private
router.put("/:id/block", protect, checkSubscription, blockCustomer);

module.exports = router;
