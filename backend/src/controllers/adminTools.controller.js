const adminTools = require("../services/adminTools.service");
const twoFactorService = require("../services/twoFactor.service");
const ResponseHandler = require("../utils/response.handler");
const audit = require("../utils/audit");

// Wrap a handler so errors become a 400 with the message
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error(`Admin tools error (${req.method} ${req.originalUrl}):`, error.message);
    return ResponseHandler.badRequest(res, error.message);
  }
};

exports.systemStatus = handle(async (req, res) => ResponseHandler.success(res, await adminTools.systemStatus()));

exports.trends = handle(async (req, res) => ResponseHandler.success(res, await adminTools.trends()));

exports.getSettings = handle(async (req, res) => ResponseHandler.success(res, await adminTools.getSettings()));

exports.updateSettings = handle(async (req, res) => {
  const settings = await adminTools.updateSettings(req.body);
  await audit(req, "settings.update", { details: "Platform settings changed" });
  return ResponseHandler.success(res, settings, "Settings saved");
});

exports.publicSettings = handle(async (req, res) => ResponseHandler.success(res, await adminTools.publicSettings()));

exports.createShop = handle(async (req, res) => {
  const user = await adminTools.createShop(req.body);
  await audit(req, "shop.create", { target: user.email, details: `Plan: ${user.subscription?.plan || "none"}` });
  return ResponseHandler.created(res, user, "Shop created");
});

exports.broadcast = handle(async (req, res) => {
  const result = await adminTools.broadcast(req.body, req.user);
  await audit(req, "broadcast.send", {
    target: req.body.recipients?.length ? `${req.body.recipients.length} shop(s)` : "all shops",
    details: req.body.title,
  });
  return ResponseHandler.created(res, result, "Message sent");
});

exports.announcements = handle(async (req, res) => ResponseHandler.success(res, await adminTools.announcements()));

// Shop side: banners addressed to the logged-in shop
exports.myAnnouncements = handle(async (req, res) => ResponseHandler.success(res, await adminTools.announcementsFor(req.user._id)));

exports.exportCsv = handle(async (req, res) => {
  const csv = await adminTools.exportCsv(req.params.kind);
  await audit(req, "data.export", { target: req.params.kind });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
});

exports.backup = handle(async (req, res) => {
  const data = await adminTools.backup();
  await audit(req, "data.backup", { details: `${data.counts.users} users, ${data.counts.orders} orders` });
  res.setHeader("Content-Disposition", `attachment; filename="chatshop-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  return res.json(data);
});

exports.clearCache = handle(async (req, res) => {
  const cleared = adminTools.clearCache();
  await audit(req, "cache.clear", { details: `${cleared} entries` });
  return ResponseHandler.success(res, { cleared }, "Cache cleared");
});

exports.auditLog = handle(async (req, res) => ResponseHandler.success(res, await adminTools.auditLog(req.query.limit)));

// ---------- Admin panel password (Super Admin only) ----------
exports.adminPanelStatus = handle(async (req, res) => ResponseHandler.success(res, await adminTools.adminPanelStatus(req.user._id)));

exports.setAdminPanelPassword = handle(async (req, res) => {
  const status = await adminTools.setAdminPanelPassword(req.user._id, req.body.password);
  await audit(req, "admin_panel.password", { details: "Admin panel password changed" });
  return ResponseHandler.success(res, status, "Admin panel password saved");
});

// ---------- Two-factor login (any signed-in user) ----------
exports.twoFactorSetup = handle(async (req, res) => {
  const { platformName } = await adminTools.publicSettings();
  return ResponseHandler.success(res, await twoFactorService.start(req.user._id, platformName));
});

exports.twoFactorEnable = handle(async (req, res) => {
  await twoFactorService.enable(req.user._id, req.body.code);
  await audit(req, "2fa.enable");
  return ResponseHandler.success(res, { enabled: true }, "Two-factor login is on");
});

exports.twoFactorDisable = handle(async (req, res) => {
  await twoFactorService.disable(req.user._id, req.body.code);
  await audit(req, "2fa.disable");
  return ResponseHandler.success(res, { enabled: false }, "Two-factor login is off");
});
