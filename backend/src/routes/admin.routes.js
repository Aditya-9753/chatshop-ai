const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { isAdmin, superAdminOnly, shopAdminGate } = require("../middleware/admin.middleware");
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
router.get("/orders", protect, isAdmin, shopAdminGate, getAllOrders);
router.get("/customers", protect, isAdmin, shopAdminGate, getAllCustomers);
router.get("/products", protect, isAdmin, shopAdminGate, getAllProducts);
router.get("/conversations", protect, isAdmin, shopAdminGate, getAllConversations);
router.get("/conversations/:id/messages", protect, isAdmin, shopAdminGate, getConversationMessages);

// @route   GET /api/admin/activity
// @desc    Platform activity per day and top shops
// @access  Private/Admin
router.get("/activity", protect, isAdmin, shopAdminGate, getDailyActivity);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private/Admin
router.get("/dashboard", protect, isAdmin, shopAdminGate, getDashboardStats);

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private/Admin
router.get("/users", protect, isAdmin, shopAdminGate, getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get single user
// @access  Private/Admin
router.get("/users/:id", protect, isAdmin, shopAdminGate, getUser);

// @route   PUT /api/admin/users/:id
// @desc    Update user (changing a role is Super Admin only)
// @access  Private/Admin
const roleChangeGuard = (req, res, next) => (req.body?.role ? superAdminOnly(req, res, next) : next());
router.put("/users/:id", protect, isAdmin, shopAdminGate, roleChangeGuard, updateUser);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/Super Admin
router.delete("/users/:id", protect, isAdmin, shopAdminGate, superAdminOnly, deleteUser);

// @route   GET /api/admin/stats
// @desc    Get system statistics
// @access  Private/Admin
router.get("/stats", protect, isAdmin, shopAdminGate, getSystemStats);

// Tools: system status, trends, settings, shops, broadcasts, data, audit.
// Settings changes, backup, cache, audit log and the Admin panel password
// are Super Admin only.
const tools = require("../controllers/adminTools.controller");
router.get("/system", protect, isAdmin, shopAdminGate, tools.systemStatus);
router.get("/trends", protect, isAdmin, shopAdminGate, tools.trends);
router.get("/settings", protect, isAdmin, shopAdminGate, tools.getSettings);
router.put("/settings", protect, isAdmin, shopAdminGate, superAdminOnly, tools.updateSettings);
router.post("/users", protect, isAdmin, shopAdminGate, tools.createShop);
router.post("/broadcast", protect, isAdmin, shopAdminGate, tools.broadcast);
router.get("/announcements", protect, isAdmin, shopAdminGate, tools.announcements);
router.get("/export/:kind", protect, isAdmin, shopAdminGate, tools.exportCsv);
router.get("/backup", protect, isAdmin, shopAdminGate, superAdminOnly, tools.backup);
router.post("/cache/clear", protect, isAdmin, shopAdminGate, superAdminOnly, tools.clearCache);
router.get("/audit", protect, isAdmin, shopAdminGate, superAdminOnly, tools.auditLog);
router.get("/admin-panel", protect, isAdmin, shopAdminGate, superAdminOnly, tools.adminPanelStatus);
router.put("/admin-panel", protect, isAdmin, shopAdminGate, superAdminOnly, tools.setAdminPanelPassword);

// Admins with their own login, name and the limited Admin panel
router.get("/admins", protect, isAdmin, shopAdminGate, superAdminOnly, tools.listAdmins);
router.post("/admins", protect, isAdmin, shopAdminGate, superAdminOnly, tools.createAdmin);
router.put("/admins/:id", protect, isAdmin, shopAdminGate, superAdminOnly, tools.updateAdmin);
router.delete("/admins/:id", protect, isAdmin, shopAdminGate, superAdminOnly, tools.removeAdmin);

// Super Admin only: billing & renewals, and opening a shop as its owner
const superAdmin = require("../controllers/superAdmin.controller");
router.get("/billing", protect, isAdmin, shopAdminGate, superAdminOnly, superAdmin.billing);
router.post("/users/:id/extend", protect, isAdmin, shopAdminGate, superAdminOnly, superAdmin.extendSubscription);
router.post("/users/:id/impersonate", protect, isAdmin, shopAdminGate, superAdminOnly, superAdmin.impersonate);

module.exports = router;
