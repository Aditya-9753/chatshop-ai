const express = require("express");
const Customer = require("../../models/Customer.model");
const { Store } = require("../models/platform");
const { Payment } = require("../models/sales");
const { Approval, Notification } = require("../models/finance");
const { need, can } = require("../middleware/rbac");
const { ah, AppError, scoped, audit, isOid } = require("../utils/helpers");
const approvalService = require("../services/approval.service");
const opsService = require("../services/ops.service");
const reports = require("../services/reports.service");
const settingsService = require("../services/settings.service");
const team = require("../services/team.service");
const s = require("./schemas");

const r = express.Router();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const checkId = (key) => (req, res, next) => (isOid(req.params[key]) ? next() : next(new AppError(400, "ID galat hai")));

// ---- Approvals (maker-checker) ----

r.get(
  "/approvals",
  need("approval.read"),
  ah(async (req, res) => {
    const filter = scoped(req);
    filter.status = req.query.status || "PENDING";
    if (filter.status === "ALL") delete filter.status;
    const approvals = await Approval.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    ok(res, approvals.map((a) => ({ ...a, canDecide: a.status === "PENDING" && can(req, "approval.decide", a.storeId) && (String(a.requestedBy) !== String(req.user._id) || req.emi.isOwner) })));
  })
);

r.post(
  "/approvals/:id/decide",
  need("approval.decide"),
  checkId("id"),
  s.validate(s.DecideIn),
  ah(async (req, res) => ok(res, await approvalService.decideApproval(req, req.params.id, req.body)))
);

// ---- Payments and settlement ----

r.get(
  "/payments",
  need("payment.read"),
  ah(async (req, res) => {
    const filter = scoped(req);
    for (const key of ["status", "purpose", "method"]) if (req.query[key]) filter[key] = req.query[key];
    if (req.query.from || req.query.to) filter.date = { ...(req.query.from && { $gte: req.query.from }), ...(req.query.to && { $lte: req.query.to }) };
    const payments = await Payment.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 300, 1000)).lean();
    const customers = await Customer.find({ _id: { $in: payments.map((p) => p.customerId) } }).select("name").lean();
    const names = new Map(customers.map((c) => [String(c._id), c.name]));
    ok(res, payments.map((p) => ({ ...p, customerName: names.get(String(p.customerId)) })));
  })
);

r.post(
  "/payments/:id/settle",
  need("payment.reconcile"),
  checkId("id"),
  ah(async (req, res) => ok(res, await opsService.settlePayment(req, req.params.id)))
);

// ---- Reports ----

r.get("/reports/dashboard", need("report.store"), ah(async (req, res) => ok(res, await reports.dashboard(req))));
r.get("/reports/emi-aging", need("emi.read"), ah(async (req, res) => ok(res, await reports.emiAging(req))));
r.get("/reports/gst", need("report.store"), ah(async (req, res) => ok(res, await reports.gstSummary(req, req.query.month))));
r.get("/reports/trial-balance", need("ledger.read"), ah(async (req, res) => ok(res, await reports.trialBalanceReport(req, req.query))));
r.get("/ledger", need("ledger.read"), ah(async (req, res) => ok(res, await reports.ledger(req, req.query))));

// Reminder log (queued, sent, failed)
r.get(
  "/notifications",
  need("report.store"),
  ah(async (req, res) => {
    const filter = scoped(req);
    if (req.query.status) filter.status = req.query.status;
    const rows = await Notification.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    const customers = await Customer.find({ _id: { $in: rows.map((n) => n.customerId) } }).select("name phone").lean();
    const names = new Map(customers.map((c) => [String(c._id), c]));
    ok(res, rows.map((n) => ({ ...n, customer: names.get(String(n.customerId)) || null })));
  })
);

// ---- Settings ----

r.get(
  "/settings/effective",
  need("settings.read"),
  ah(async (req, res) => {
    const storeId = req.query.storeId && isOid(req.query.storeId) ? req.query.storeId : null;
    if (storeId && !(await Store.exists({ tenantId: req.emi.tenantId, _id: storeId }))) throw new AppError(404, "Store nahi mila");
    const [effective, platform, tenantOverride, storeOverride] = await Promise.all([
      settingsService.resolveSettings(req.emi.tenantId, storeId),
      settingsService.platformSettings(),
      settingsService.valueOf("TENANT", req.emi.tenantId),
      storeId ? settingsService.valueOf("STORE", storeId) : {},
    ]);
    ok(res, { effective, platform, tenantOverride, storeOverride, tenantEditable: settingsService.TENANT_EDITABLE });
  })
);

r.put(
  "/settings/tenant",
  need("settings.tenant"),
  s.validate(s.SettingsIn),
  ah(async (req, res) => {
    const result = await settingsService.saveOverride("TENANT", req.emi.tenantId, req.body, req.user._id, req.emi.tenantId);
    await audit(req, "settings.tenant", { entity: "Setting", after: settingsService.flatten(req.body) });
    ok(res, result);
  })
);

r.put(
  "/settings/store/:storeId",
  need("settings.store"),
  checkId("storeId"),
  s.validate(s.SettingsIn),
  ah(async (req, res) => {
    if (!(await Store.exists({ tenantId: req.emi.tenantId, _id: req.params.storeId }))) throw new AppError(404, "Store nahi mila");
    const result = await settingsService.saveOverride("STORE", req.params.storeId, req.body, req.user._id, req.emi.tenantId);
    await audit(req, "settings.store", { entity: "Store", entityId: req.params.storeId, after: settingsService.flatten(req.body) });
    ok(res, result);
  })
);

r.delete(
  "/settings/store/:storeId",
  need("settings.store"),
  checkId("storeId"),
  ah(async (req, res) => {
    if (!(await Store.exists({ tenantId: req.emi.tenantId, _id: req.params.storeId }))) throw new AppError(404, "Store nahi mila");
    await settingsService.clearOverride("STORE", req.params.storeId);
    await audit(req, "settings.store_reset", { entity: "Store", entityId: req.params.storeId });
    ok(res, { reset: true });
  })
);

// ---- Shop, stores and staff ----

r.put("/tenant", need("settings.tenant"), s.validate(s.TenantIn), ah(async (req, res) => ok(res, await team.updateTenant(req, req.body))));

r.get("/stores", need("store.read"), ah(async (req, res) => ok(res, await team.listStores(req))));
r.post("/stores", need("store.manage"), s.validate(s.StoreIn), ah(async (req, res) => ok(res, await team.createStore(req, req.body), 201)));
r.patch("/stores/:storeId", need("store.manage"), checkId("storeId"), s.validate(s.StorePatch), ah(async (req, res) => ok(res, await team.updateStore(req, req.params.storeId, req.body))));

r.get("/users", need("user.read"), ah(async (req, res) => ok(res, await team.listStaff(req))));
r.post("/users", need("user.manage"), s.validate(s.StaffIn), ah(async (req, res) => ok(res, await team.createStaff(req, req.body), 201)));
r.patch("/users/:id", need("user.manage"), checkId("id"), s.validate(s.StaffPatch), ah(async (req, res) => ok(res, await team.updateStaff(req, req.params.id, req.body))));

module.exports = r;
