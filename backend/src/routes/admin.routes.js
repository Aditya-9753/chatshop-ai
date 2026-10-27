const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { isAdmin, superAdminOnly } = require("../middleware/admin.middleware");
const {
  getDashboardStats,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  getSystemStats,
  getDailyActivity,
  getAllOrders,
  getAllCustomers,
  getAllProducts,
  getAllConversations,
  getConversationMessages,
} = require("../controllers/admin.controller");

// @route   GET /api/admin/{orders,customers,products,conversations}
// @desc    Every shop's records, newest first (?shop=<userId>&limit=)
// @access  Private/Admin
router.get("/orders", protect, isAdmin, getAllOrders);
router.get("/customers", protect, isAdmin, getAllCustomers);
router.get("/products", protect, isAdmin, getAllProducts);
router.get("/conversations", protect, isAdmin, getAllConversations);
router.get("/conversations/:id/messages", protect, isAdmin, getConversationMessages);

// @route   GET /api/admin/activity
// @desc    Platform activity per day and top shops
// @access  Private/Admin
router.get("/activity", protect, isAdmin, getDailyActivity);

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
// @desc    Update user (changing a role is Super Admin only)
// @access  Private/Admin
const roleChangeGuard = (req, res, next) => (req.body?.role ? superAdminOnly(req, res, next) : next());
router.put("/users/:id", protect, isAdmin, roleChangeGuard, updateUser);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/Super Admin
router.delete("/users/:id", protect, isAdmin, superAdminOnly, deleteUser);

// @route   GET /api/admin/stats
// @desc    Get system statistics
// @access  Private/Admin
router.get("/stats", protect, isAdmin, getSystemStats);

// Tools: system status, trends, settings, shops, broadcasts, data, audit.
// Settings changes, backup, cache, audit log and the Admin panel password
// are Super Admin only.
const tools = require("../controllers/adminTools.controller");
router.get("/system", protect, isAdmin, tools.systemStatus);
router.get("/trends", protect, isAdmin, tools.trends);
router.get("/settings", protect, isAdmin, tools.getSettings);
router.put("/settings", protect, isAdmin, superAdminOnly, tools.updateSettings);
router.post("/users", protect, isAdmin, tools.createShop);
router.post("/broadcast", protect, isAdmin, tools.broadcast);
router.get("/announcements", protect, isAdmin, tools.announcements);
router.get("/export/:kind", protect, isAdmin, tools.exportCsv);
router.get("/backup", protect, isAdmin, superAdminOnly, tools.backup);
router.post("/cache/clear", protect, isAdmin, superAdminOnly, tools.clearCache);
router.get("/audit", protect, isAdmin, superAdminOnly, tools.auditLog);
router.get("/admin-panel", protect, isAdmin, superAdminOnly, tools.adminPanelStatus);
router.put("/admin-panel", protect, isAdmin, superAdminOnly, tools.setAdminPanelPassword);

module.exports = router;
