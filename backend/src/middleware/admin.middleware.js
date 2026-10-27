const ResponseHandler = require("../utils/response.handler");

// Check if user is admin
exports.isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return ResponseHandler.unauthorized(res, "Authentication required");
    }

    if (req.user.role !== "admin") {
      return ResponseHandler.forbidden(
        res,
        "Access denied. Admin privileges required."
      );
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return ResponseHandler.error(res, "Authorization failed");
  }
};

// Block the limited Admin panel (admin-panel password) from Super Admin
// actions. Shop owners pass straight through, so it also fits /users routes.
exports.superAdminOnly = (req, res, next) => {
  if (req.user?.role === "admin" && req.adminLevel === "admin") {
    return ResponseHandler.forbidden(res, "Only the Super Admin can do this.");
  }
  next();
};
