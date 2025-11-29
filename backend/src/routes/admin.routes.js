const express = require("express");
const router = express.Router();
const { protect, authorizeAdmin } = require("../middleware/auth.middleware");
const {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  getSystemStats,
} = require("../controllers/admin.controller");

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private/Admin
router.get("/users", protect, authorizeAdmin, getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get single user
// @access  Private/Admin
router.get("/users/:id", protect, authorizeAdmin, getUser);

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private/Admin
router.put("/users/:id", protect, authorizeAdmin, updateUser);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete("/users/:id", protect, authorizeAdmin, deleteUser);

// @route   GET /api/admin/stats
// @desc    Get system statistics
// @access  Private/Admin
router.get("/stats", protect, authorizeAdmin, getSystemStats);

module.exports = router;
