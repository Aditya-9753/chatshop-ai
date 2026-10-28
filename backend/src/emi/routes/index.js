const express = require("express");
const crypto = require("crypto");
const { protect } = require("../../middleware/auth.middleware");
const { emiContext, ROLE_LABELS, permissionsOf } = require("../middleware/rbac");
const { AppError, ah } = require("../utils/helpers");
const { DomainError } = require("../domain/emi");
const { listStores } = require("../services/team.service");
const { gatewayWebhook } = require("../services/ops.service");

// EMI & billing API, mounted at /api/emi
const router = express.Router();

// Payment gateway webhook: HMAC-SHA256 of the raw body in x-signature
router.post(
  "/webhooks/gateway",
  ah(async (req, res) => {
    const secret = process.env.EMI_WEBHOOK_SECRET;
    if (!secret) throw new AppError(503, "EMI_WEBHOOK_SECRET set nahi hai");
    const expected = crypto.createHmac("sha256", secret).update(req.rawBody || "").digest("hex");
    const given = String(req.get("x-signature") || "");
    const valid = given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!valid) throw new AppError(401, "Signature galat hai");
    res.json({ success: true, data: await gatewayWebhook(req.body) });
  })
);

router.use(protect);
router.use("/super", require("./super.routes"));

router.use(emiContext);

// Who am I here: shop, roles, stores and permissions (drives the menu)
router.get(
  "/me",
  ah(async (req, res) => {
    const stores = await listStores(req);
    res.json({
      success: true,
      data: {
        user: { _id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
        tenant: req.emi.tenant,
        isOwner: req.emi.isOwner,
        roles: req.emi.roles.map((r) => ({ ...r, label: ROLE_LABELS[r.role] })),
        permissions: permissionsOf(req.emi.roles),
        stores,
      },
    });
  })
);

router.use(require("./sales.routes"));
router.use(require("./emi.routes"));
router.use(require("./admin.routes"));

// One error shape for the module: { success: false, message, errors[] }
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  let status = 500;
  let message = err.message || "Kuch galat ho gaya";
  let errors = [message];
  if (err instanceof AppError) {
    status = err.status;
    errors = err.errors;
  } else if (err instanceof DomainError) {
    status = 422;
  } else if (err.code === 11000) {
    status = 409;
    message = "Ye record pehle se hai";
    errors = [message];
  } else if (err.name === "ValidationError") {
    status = 400;
    errors = Object.values(err.errors).map((e) => e.message);
    message = errors[0];
  } else if (err.name === "CastError") {
    status = 400;
    message = "ID galat hai";
    errors = [message];
  } else {
    console.error("EMI error:", err);
    message = "Server me galti hui; dobara koshish karo";
    errors = [message];
  }
  res.status(status).json({ success: false, message, errors });
});

module.exports = router;
