const express = require("express");
const { need } = require("../middleware/rbac");
const { ah, AppError, audit, isOid } = require("../utils/helpers");
const superService = require("../services/super.service");
const { runOverdueJob } = require("../services/emi.service");
const { processNotifications } = require("../services/notify.service");
const s = require("./schemas");

// Super Admin screens for the EMI module (every shop)
const r = express.Router();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const checkId = (req, res, next) => (isOid(req.params.id) ? next() : next(new AppError(400, "ID galat hai")));

r.use(need("super.read"));

r.get("/dashboard", ah(async (req, res) => ok(res, await superService.dashboard())));
r.get("/tenants", ah(async (req, res) => ok(res, await superService.tenants())));
r.patch("/tenants/:id", checkId, s.validate(s.TenantStatusIn), ah(async (req, res) => ok(res, await superService.setTenantStatus(req, req.params.id, req.body))));

r.get("/settings", ah(async (req, res) => ok(res, await superService.getSettings())));
r.put("/settings", s.validate(s.SettingsIn), ah(async (req, res) => ok(res, await superService.saveSettings(req, req.body))));

r.get("/nbfc-partners", ah(async (req, res) => ok(res, await superService.partners())));
r.post("/nbfc-partners", s.validate(s.PartnerIn), ah(async (req, res) => ok(res, await superService.savePartner(req, null, req.body), 201)));
r.put("/nbfc-partners/:id", checkId, s.validate(s.PartnerPatch), ah(async (req, res) => ok(res, await superService.savePartner(req, req.params.id, req.body))));

r.get("/risk/multi-store-customers", ah(async (req, res) => ok(res, await superService.multiStoreCustomers())));
r.get("/audit", ah(async (req, res) => ok(res, await superService.auditLog(req.query.limit))));

r.post(
  "/jobs/overdue/run",
  s.validate(s.JobIn),
  ah(async (req, res) => {
    const summary = await runOverdueJob(req.body.asOf, req.user._id);
    await audit(req, "job.overdue", { details: JSON.stringify(summary) });
    ok(res, summary);
  })
);

r.post(
  "/jobs/notifications/run",
  ah(async (req, res) => ok(res, await processNotifications(200)))
);

module.exports = r;
