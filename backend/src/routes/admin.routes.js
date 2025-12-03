const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { isAdmin } = require("../middleware/admin.middleware");
const {
  getDashboardStats,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  getSystemStats,
} = require("../controllers/admin.controller");

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private/Admin
router.get("/dashboard", protect, isAdmin, getDashboardStats);

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private/Admin
router.get("/users", protect, isAdmin, getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get single user
// @access  Private/Admin
router.get("/users/:id", protect, isAdmin, getUser);

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private/Admin
router.put("/users/:id", protect, isAdmin, updateUser);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete("/users/:id", protect, isAdmin, deleteUser);

// @route   GET /api/admin/stats
// @desc    Get system statistics
// @access  Private/Admin
router.get("/stats", protect, isAdmin, getSystemStats);

module.exports = router;
