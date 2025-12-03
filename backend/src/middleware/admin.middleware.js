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
