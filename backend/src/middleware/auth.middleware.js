const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

// What a staff account may reach: EMI & billing, and its own profile
const STAFF_PATHS = ["/api/emi", "/api/users/profile", "/api/users/password", "/api/users/announcements"];

exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. No token provided.",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // A two-factor challenge token is not a session
      if (decoded.purpose) throw new Error("Not a session token");

      // Get user from token
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Sessions started before the last password change are logged out
      if (req.user.changedPasswordAfter(decoded.iat)) {
        return res.status(401).json({
          success: false,
          message: "Password was changed. Please log in again.",
        });
      }

      // Shop staff (cashier, accountant, agent…) only use EMI & billing
      if (req.user.role === "staff" && !STAFF_PATHS.some((path) => req.originalUrl.startsWith(path))) {
        return res.status(403).json({
          success: false,
          message: "Staff accounts can only use EMI & billing.",
        });
      }

      // A shop opened by the Super Admin ("Open as shop"): the admin must
      // still be an admin and not have changed password since
      if (decoded.actingAdmin) {
        const admin = await User.findById(decoded.actingAdmin).select("role passwordChangedAt");
        if (!admin || admin.role !== "admin" || admin.changedPasswordAfter(decoded.iat)) {
          return res.status(401).json({
            success: false,
            message: "This shop view has ended. Please open it again from the Super Admin panel.",
          });
        }
        req.actingAdmin = admin._id;
      }

      // Admins: "super" (Super Admin) or "admin" (limited admin panel)
      if (req.user.role === "admin") {
        req.adminLevel = decoded.adminLevel === "admin" ? "admin" : "super";
        if (req.adminLevel === "admin" && req.user.changedAdminPanelPasswordAfter(decoded.iat)) {
          return res.status(401).json({
            success: false,
            message: "Password was changed. Please log in again.",
          });
        }
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Invalid token.",
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

// Admin authorization
exports.authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required.",
    });
  }
};

// The owner's own account settings stay with the owner, even when the
// Super Admin has their shop open
exports.ownerOnly = (req, res, next) => {
  if (req.actingAdmin) {
    return res.status(403).json({
      success: false,
      message: "Only the shop owner can change this.",
    });
  }
  next();
};

// Check subscription
exports.checkSubscription = (req, res, next) => {
  // Platform admins can open every page without a plan of their own
  if (req.user.role === "admin") return next();

  if (!req.user.subscription || req.user.subscription.status !== "active") {
    return res.status(403).json({
      success: false,
      message: "Active subscription required to access this feature",
    });
  }
  next();
};
