const adminService = require("../services/admin.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Get admin dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    return ResponseHandler.success(res, stats);
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const result = await adminService.getAllUsers(req.query);
    return ResponseHandler.paginated(res, result.users, {
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      total: result.total,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await adminService.getUser(req.params.id);
    return ResponseHandler.success(res, user);
  } catch (error) {
    console.error("Get user error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Update user
exports.updateUser = async (req, res) => {
  try {
    const user = await adminService.updateUser(req.params.id, req.body);
    return ResponseHandler.success(res, user, "User updated successfully");
  } catch (error) {
    console.error("Update user error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete user
exports.deleteUser = async (req, res) => {
  try {
    await adminService.deleteUser(req.params.id);
    return ResponseHandler.success(
      res,
      null,
      "User and all associated data deleted successfully"
    );
  } catch (error) {
    console.error("Delete user error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Get system statistics
exports.getSystemStats = async (req, res) => {
  try {
    const stats = await adminService.getSystemStats();
    return ResponseHandler.success(res, stats);
  } catch (error) {
    console.error("Get system stats error:", error);
    return ResponseHandler.error(res, error.message);
  }
};
