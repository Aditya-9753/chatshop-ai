const express = require("express");
const Customer = require("../../models/Customer.model");
const User = require("../../models/User.model");
const { Store } = require("../models/platform");
const { Payment, Invoice } = require("../models/sales");
const { EmiContract, EmiInstallment, NbfcCase, NbfcPartner, Approval } = require("../models/finance");
const { unpaidOf, totalOf } = require("../domain/emi");
const { need, agentOnly } = require("../middleware/rbac");
const { ah, AppError, scoped, audit, isOid, today } = require("../utils/helpers");
const emiService = require("../services/emi.service");
const approvalService = require("../services/approval.service");
const opsService = require("../services/ops.service");
const s = require("./schemas");

const r = express.Router();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const checkId = (req, res, next) => (isOid(req.params.id) ? next() : next(new AppError(400, "ID galat hai")));

// Names for ids, in one query each
async function namesFor(rows) {
  const ids = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean).map(String))];
  const [customers, stores, agents] = await Promise.all([
    Customer.find({ _id: { $in: ids("customerId") } }).select("name phone kycStatus").lean(),
    Store.find({ _id: { $in: ids("storeId") } }).setOptions({ allTenants: true }).select("name").lean(),
    User.find({ _id: { $in: ids("assignedAgentId") } }).select("name").lean(),
  ]);
  const map = (list) => new Map(list.map((x) => [String(x._id), x]));
  return { customers: map(customers), stores: map(stores), agents: map(agents) };
}

/**
 * EMI views: ?view=today (due today) | overdue | bucket&bucket=1-30 |
 * closed | all (default: active). Agents only see their assigned contracts.
 */
r.get(
  "/emi",
  need("emi.read"),
  ah(async (req, res) => {
    const filter = scoped(req);
    if (agentOnly(req)) filter.assignedAgentId = req.user._id;
    else if (req.query.agentId && isOid(req.query.agentId)) filter.assignedAgentId = req.query.agentId;
    const view = req.query.view || "active";
    if (view === "today") Object.assign(filter, { status: "ACTIVE", nextDueDate: today() });
    else if (view === "overdue") Object.assign(filter, { status: "ACTIVE", currentDpd: { $gt: 0 } });
    else if (view === "bucket") Object.assign(filter, { status: "ACTIVE", bucket: req.query.bucket });
    else if (view === "pending") filter.status = "PENDING_APPROVAL";
    else if (view === "closed") filter.status = { $in: ["CLOSED", "FORECLOSED", "CANCELLED"] };
    else if (view === "active") filter.status = "ACTIVE";
    if (req.query.customerId && isOid(req.query.customerId)) filter.customerId = req.query.customerId;

    const contracts = await EmiContract.find(filter).select("-followUps").sort({ nextDueDate: 1, createdAt: -1 }).limit(500).lean();
    const due = await EmiInstallment.find({
      tenantId: req.emi.tenantId,
      contractId: { $in: contracts.map((c) => c._id) },
      status: { $in: ["DUE", "OVERDUE", "UPCOMING"] },
      dueDate: { $lte: today() },
    }).lean();
    const dueBy = new Map();
    for (const i of due) dueBy.set(String(i.contractId), (dueBy.get(String(i.contractId)) || 0) + totalOf(unpaidOf(i)));
    const names = await namesFor(contracts);
    ok(
      res,
      contracts.map((c) => ({
        ...c,
        customer: names.customers.get(String(c.customerId)) || null,
        storeName: names.stores.get(String(c.storeId))?.name,
        agentName: names.agents.get(String(c.assignedAgentId))?.name || null,
        dueNow: dueBy.get(String(c._id)) || 0,
        outstandingPrincipal: c.principal - c.paidPrincipal,
      }))
    );
  })
);

// Staff with the agent role, for the assign menu
r.get(
  "/agents",
  need("emi.read"),
  ah(async (req, res) => {
    ok(res, await User.find({ tenantId: req.emi.tenantId, role: "staff", staffActive: true, "emiRoles.role": "AGENT" }).select("name email emiRoles").lean());
  })
);

r.get(
  "/emi/:id",
  need("emi.read"),
  checkId,
  ah(async (req, res) => {
    const contract = await emiService.findContract(req, req.params.id);
    const tenantId = req.emi.tenantId;
    const [installments, payments, approvals, names] = await Promise.all([
      EmiInstallment.find({ tenantId, contractId: contract._id }).sort({ no: 1 }).lean(),
      Payment.find({ tenantId, emiContractId: contract._id }).sort({ createdAt: -1 }).lean(),
      Approval.find({ tenantId, refId: { $in: [contract._id, contract.invoiceId] } }).sort({ createdAt: -1 }).lean(),
      namesFor([contract]),
    ]);
    const customer = await Customer.findOne({ _id: contract.customerId, userId: tenantId }).select("name phone pan kycStatus address riskGrade").lean();
    ok(res, {
      contract: contract.toObject(),
      installments: installments.map((i) => ({ ...i, unpaid: totalOf(unpaidOf(i)), unpaidParts: unpaidOf(i) })),
      payments,
      approvals,
      customer,
      storeName: names.stores.get(String(contract.storeId))?.name,
      agentName: names.agents.get(String(contract.assignedAgentId))?.name || null,
    });
  })
);

r.post(
  "/emi/:id/payments",
  need("payment.collect"),
  checkId,
  s.validate(s.PaymentIn),
  ah(async (req, res) => {
    const key = req.get("Idempotency-Key");
    if (!key) throw new AppError(400, "Idempotency-Key header chahiye");
    const result = await emiService.collectEmi(req, req.params.id, req.body, key);
    ok(res, result, result.duplicate ? 200 : 201);
  })
);

r.get(
  "/emi/:id/foreclosure-quote",
  need("emi.read"),
  checkId,
  ah(async (req, res) => ok(res, await emiService.quoteForeclosure(req, req.params.id)))
);

// Foreclosure goes through approval; the money is taken when it is approved
r.post(
  "/emi/:id/foreclose",
  need("emi.create"),
  checkId,
  s.validate(s.ForecloseIn),
  ah(async (req, res) => ok(res, await approvalService.requestForeclosure(req, req.params.id, req.body), 201))
);

r.post(
  "/emi/installments/:id/waiver-request",
  need("approval.create"),
  checkId,
  s.validate(s.ReasonIn),
  ah(async (req, res) => ok(res, await approvalService.requestWaiver(req, req.params.id, req.body.reason), 201))
);

r.post(
  "/emi/:id/followups",
  need("emi.followup"),
  checkId,
  s.validate(s.FollowUpIn),
  ah(async (req, res) => {
    const contract = await emiService.findContract(req, req.params.id);
    contract.followUps.push({ ...req.body, by: req.user._id, byName: req.user.name });
    await contract.save();
    ok(res, contract.followUps.at(-1), 201);
  })
);

r.post(
  "/emi/:id/assign",
  need("emi.approve"),
  checkId,
  s.validate(s.AssignIn),
  ah(async (req, res) => {
    const contract = await emiService.findContract(req, req.params.id);
    if (req.body.agentId) {
      const agent = await User.findOne({ _id: req.body.agentId, tenantId: req.emi.tenantId, role: "staff", staffActive: true, "emiRoles.role": "AGENT" });
      if (!agent) throw new AppError(404, "Agent nahi mila");
      const covers = agent.emiRoles.some((role) => role.role === "AGENT" && (!role.storeId || String(role.storeId) === String(contract.storeId)));
      if (!covers) throw new AppError(422, `${agent.name} is store ke agent nahi hain`);
    }
    const before = { assignedAgentId: contract.assignedAgentId };
    contract.assignedAgentId = req.body.agentId || null;
    await contract.save();
    await audit(req, "emi.assign", { entity: "EmiContract", entityId: contract._id, before, after: { assignedAgentId: contract.assignedAgentId } });
    ok(res, { assignedAgentId: contract.assignedAgentId });
  })
);

// ---- NBFC ----

r.get(
  "/nbfc-partners",
  need("nbfc.read"),
  ah(async (req, res) => ok(res, await NbfcPartner.find({ active: true }).sort({ name: 1 }).lean()))
);

r.get(
  "/nbfc",
  need("nbfc.read"),
  ah(async (req, res) => {
    const filter = scoped(req);
    if (req.query.status) filter.status = req.query.status;
    const cases = await NbfcCase.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    const names = await namesFor(cases);
    const invoices = await Invoice.find({ tenantId: req.emi.tenantId, _id: { $in: cases.map((c) => c.invoiceId) } }).select("invoiceNo").lean();
    const invoiceNo = new Map(invoices.map((i) => [String(i._id), i.invoiceNo]));
    ok(res, cases.map((c) => ({ ...c, customer: names.customers.get(String(c.customerId)) || null, storeName: names.stores.get(String(c.storeId))?.name, invoiceNo: invoiceNo.get(String(c.invoiceId)) })));
  })
);

r.post(
  "/nbfc/:id/status",
  need("nbfc.update"),
  checkId,
  s.validate(s.NbfcStatusIn),
  ah(async (req, res) => ok(res, await opsService.moveNbfcCase(req, req.params.id, req.body)))
);

module.exports = r;
