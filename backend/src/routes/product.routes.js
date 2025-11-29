const express = require("express");
const router = express.Router();
const { protect, checkSubscription } = require("../middleware/auth.middleware");
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");

// @route   GET /api/products
// @desc    Get all products
// @access  Private
router.get("/", protect, checkSubscription, getProducts);

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Private
router.get("/:id", protect, checkSubscription, getProduct);

// @route   POST /api/products
// @desc    Create new product
// @access  Private
router.post("/", protect, checkSubscription, createProduct);

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private
router.put("/:id", protect, checkSubscription, updateProduct);

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private
router.delete("/:id", protect, checkSubscription, deleteProduct);

module.exports = router;
