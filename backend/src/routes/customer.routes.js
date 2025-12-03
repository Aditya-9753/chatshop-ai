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
  addTag,
  removeTag,
  addInternalNote,
  getInternalNotes,
  deleteInternalNote,
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

// @route   POST /api/customers/:id/tags
// @desc    Add tag to customer
// @access  Private
router.post("/:id/tags", protect, checkSubscription, addTag);

// @route   DELETE /api/customers/:id/tags
// @desc    Remove tag from customer
// @access  Private
router.delete("/:id/tags", protect, checkSubscription, removeTag);

// @route   POST /api/customers/:id/notes
// @desc    Add internal note
// @access  Private
router.post("/:id/notes", protect, checkSubscription, addInternalNote);

// @route   GET /api/customers/:id/notes
// @desc    Get internal notes
// @access  Private
router.get("/:id/notes", protect, checkSubscription, getInternalNotes);

// @route   DELETE /api/customers/notes/:noteId
// @desc    Delete internal note
// @access  Private
router.delete("/notes/:noteId", protect, checkSubscription, deleteInternalNote);

module.exports = router;
