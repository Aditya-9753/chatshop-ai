const express = require("express");
const { need } = require("../middleware/rbac");
const { ah, AppError, audit, isOid } = require("../utils/helpers");
const superService = require("../services/super.service");
const { runOverdueJob } = require("../services/emi.service");
const { processNotifications } = require("../services/notify.service");
const s = require("./schemas");

// Platform screens for the EMI module (every shop). Both admin panels can
// look; changing anything (suspend, rules, partners, jobs) and the audit
// log are Super Admin only, as in the rest of the admin panel.
const r = express.Router();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const checkId = (req, res, next) => (isOid(req.params.id) ? next() : next(new AppError(400, "ID galat hai")));
const manage = need("super.manage");

r.use(need("super.read"));

r.get("/dashboard", ah(async (req, res) => ok(res, await superService.dashboard())));
r.get("/tenants", ah(async (req, res) => ok(res, await superService.tenants())));
r.patch("/tenants/:id", manage, checkId, s.validate(s.TenantStatusIn), ah(async (req, res) => ok(res, await superService.setTenantStatus(req, req.params.id, req.body))));

// Every shop's records
r.get("/invoices", ah(async (req, res) => ok(res, await superService.invoices(req.query))));
r.get("/invoices/:id", checkId, ah(async (req, res) => ok(res, await superService.invoiceDetail(req.params.id))));
r.get("/emi", ah(async (req, res) => ok(res, await superService.contracts(req.query))));
r.get("/emi/:id", checkId, ah(async (req, res) => ok(res, await superService.contractDetail(req.params.id))));
r.get("/nbfc", ah(async (req, res) => ok(res, await superService.nbfcCases(req.query))));
r.get("/payments", ah(async (req, res) => ok(res, await superService.payments(req.query))));

r.get("/settings", ah(async (req, res) => ok(res, await superService.getSettings())));
r.put("/settings", manage, s.validate(s.SettingsIn), ah(async (req, res) => ok(res, await superService.saveSettings(req, req.body))));

r.get("/nbfc-partners", ah(async (req, res) => ok(res, await superService.partners())));
r.post("/nbfc-partners", manage, s.validate(s.PartnerIn), ah(async (req, res) => ok(res, await superService.savePartner(req, null, req.body), 201)));
r.put("/nbfc-partners/:id", manage, checkId, s.validate(s.PartnerPatch), ah(async (req, res) => ok(res, await superService.savePartner(req, req.params.id, req.body))));

r.get("/risk/multi-store-customers", ah(async (req, res) => ok(res, await superService.multiStoreCustomers())));
r.get("/audit", manage, ah(async (req, res) => ok(res, await superService.auditLog(req.query.limit))));

r.post(
  "/jobs/overdue/run",
  manage,
  s.validate(s.JobIn),
  ah(async (req, res) => {
    const summary = await runOverdueJob(req.body.asOf, req.user._id);
    await audit(req, "job.overdue", { details: JSON.stringify(summary) });
    ok(res, summary);
  })
);

r.post(
  "/jobs/notifications/run",
  manage,
  ah(async (req, res) => ok(res, await processNotifications(200)))
);

module.exports = r;
