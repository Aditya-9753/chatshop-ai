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

// What an Admin who looks after one shop may open in /api/admin: reading
// that shop's own records. Everything else (plans, new shops, broadcasts to
// every shop, platform exports, settings, system status) is the platform's.
const SHOP_ADMIN_ROUTES = [
  /^\/dashboard$/,
  /^\/users$/,
  /^\/users\/[a-f\d]{24}$/i,
  /^\/(orders|customers|products|conversations)$/,
  /^\/conversations\/[a-f\d]{24}\/messages$/i,
  /^\/activity$/,
  /^\/export\/(shops|orders|customers|products)$/,
];

exports.shopAdminGate = (req, res, next) => {
  if (!req.shopScope) return next();
  if (req.method === "GET" && SHOP_ADMIN_ROUTES.some((re) => re.test(req.path))) return next();
  return ResponseHandler.forbidden(res, "You look after one shop: this is only for the Super Admin.");
};

// Mongo filter for records owned by a shop (userId), limited to the
// admin's shop when they look after one
exports.shopFilter = (req, field = "userId") => (req.shopScope ? { [field]: req.shopScope } : {});

// Block the limited Admin panel (admin-panel password) from Super Admin
// actions. Shop owners pass straight through, so it also fits /users routes.
exports.superAdminOnly = (req, res, next) => {
  if (req.user?.role === "admin" && req.adminLevel === "admin") {
    return ResponseHandler.forbidden(res, "Only the Super Admin can do this.");
  }
  next();
};
