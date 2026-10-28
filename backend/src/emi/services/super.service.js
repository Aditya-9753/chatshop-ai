const User = require("../../models/User.model");
const Customer = require("../../models/Customer.model");
const AuditLog = require("../../models/AuditLog.model");
const { Tenant, Store } = require("../models/platform");
const { Invoice, Payment } = require("../models/sales");
const { EmiContract, EmiInstallment, NbfcCase, NbfcPartner, Notification } = require("../models/finance");
const { unpaidOf, totalOf } = require("../domain/emi");
const { AppError, audit, today } = require("../utils/helpers");
const { phoneDigits } = require("./bridge.service");
const settingsService = require("./settings.service");

const ALL = { allTenants: true };
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

async function dashboard() {
  const from = addDays(today(), -29);
  const [tenants, stores, gmv, book, overdue, nbfc, failed] = await Promise.all([
    Tenant.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Store.countDocuments({}).setOptions(ALL),
    Invoice.aggregate([{ $match: { status: { $ne: "CANCELLED" }, date: { $gte: from } } }, { $group: { _id: null, gross: { $sum: "$grossTotal" }, count: { $sum: 1 } } }]).option(ALL),
    EmiContract.aggregate([{ $match: { status: "ACTIVE" } }, { $group: { _id: null, count: { $sum: 1 }, outstanding: { $sum: { $subtract: ["$principal", "$paidPrincipal"] } } } }]).option(ALL),
    EmiContract.countDocuments({ status: "ACTIVE", currentDpd: { $gt: 0 } }).setOptions(ALL),
    NbfcCase.aggregate([{ $match: { status: { $in: ["LOGIN", "APPROVED", "DO_RECEIVED"] } } }, { $group: { _id: null, count: { $sum: 1 }, payout: { $sum: "$expectedPayout" } } }]).option(ALL),
    Notification.countDocuments({ status: "FAILED" }).setOptions(ALL),
  ]);
  const count = (s) => tenants.find((t) => t._id === s)?.count || 0;
  const active = book[0]?.count || 0;
  return {
    tenants: { active: count("ACTIVE"), suspended: count("SUSPENDED") },
    stores,
    gmv30d: { gross: gmv[0]?.gross || 0, invoices: gmv[0]?.count || 0 },
    emiBook: { contracts: active, outstanding: book[0]?.outstanding || 0, overdueContracts: overdue, overduePct: active ? Math.round((overdue / active) * 1000) / 10 : 0 },
    nbfcPending: { count: nbfc[0]?.count || 0, payout: nbfc[0]?.payout || 0 },
    failedReminders: failed,
  };
}

async function tenants() {
  const list = await Tenant.find().sort({ createdAt: -1 }).lean();
  const ids = list.map((t) => t._id);
  const [owners, stores, sales, emi] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("name email subscription").lean(),
    Store.aggregate([{ $match: { tenantId: { $in: ids } } }, { $group: { _id: "$tenantId", count: { $sum: 1 } } }]).option(ALL),
    Invoice.aggregate([{ $match: { tenantId: { $in: ids }, status: { $ne: "CANCELLED" } } }, { $group: { _id: "$tenantId", count: { $sum: 1 }, gross: { $sum: "$grossTotal" } } }]).option(ALL),
    EmiContract.aggregate([
      { $match: { tenantId: { $in: ids }, status: "ACTIVE" } },
      { $group: { _id: "$tenantId", count: { $sum: 1 }, outstanding: { $sum: { $subtract: ["$principal", "$paidPrincipal"] } }, overdue: { $sum: { $cond: [{ $gt: ["$currentDpd", 0] }, 1, 0] } } } },
    ]).option(ALL),
  ]);
  const by = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const [o, s, i, e] = [by(owners), by(stores), by(sales), by(emi)];
  return list.map((t) => {
    const k = String(t._id);
    return {
      ...t,
      owner: o.get(k) ? { name: o.get(k).name, email: o.get(k).email, subscription: o.get(k).subscription?.status } : null,
      stores: s.get(k)?.count || 0,
      invoices: i.get(k)?.count || 0,
      gross: i.get(k)?.gross || 0,
      activeContracts: e.get(k)?.count || 0,
      outstanding: e.get(k)?.outstanding || 0,
      overdueContracts: e.get(k)?.overdue || 0,
    };
  });
}

async function setTenantStatus(req, tenantId, { status, reason }) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new AppError(404, "Tenant nahi mila");
  if (status === "SUSPENDED" && !reason) throw new AppError(422, "Suspend karne ka kaaran likho");
  const before = { status: tenant.status };
  tenant.status = status;
  tenant.suspendedReason = status === "SUSPENDED" ? reason : undefined;
  await tenant.save();
  await audit(req, `tenant.${status.toLowerCase()}`, { tenantId: tenant._id, entity: "Tenant", entityId: tenant._id, before, after: { status }, reason });
  return tenant;
}

async function getSettings() {
  return { effective: await settingsService.platformSettings(), override: await settingsService.valueOf("PLATFORM"), tenantEditable: settingsService.TENANT_EDITABLE };
}

async function saveSettings(req, patch) {
  const result = await settingsService.savePlatform(patch, req.user._id);
  await audit(req, "settings.platform", { entity: "Setting", after: settingsService.flatten(patch) });
  return result;
}

const partners = () => NbfcPartner.find().sort({ name: 1 }).lean();

async function savePartner(req, id, body) {
  const fields = ["name", "subventionPct", "settlementDays", "contact", "active"];
  const data = Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
  const partner = id ? await NbfcPartner.findByIdAndUpdate(id, data, { new: true, runValidators: true }) : await NbfcPartner.create(data);
  if (!partner) throw new AppError(404, "NBFC partner nahi mila");
  await audit(req, id ? "nbfc_partner.update" : "nbfc_partner.create", { entity: "NbfcPartner", entityId: partner._id, after: data });
  return partner;
}

/**
 * Borrowers with live EMIs in more than one store (same shop or different
 * shops), matched on PAN or mobile number: the same person stacking loans.
 */
async function multiStoreCustomers() {
  const contracts = await EmiContract.find({ status: "ACTIVE" }).setOptions(ALL).select("tenantId storeId customerId principal paidPrincipal currentDpd contractNo").lean();
  const customers = await Customer.find({ _id: { $in: contracts.map((c) => c.customerId) } }).select("name phone pan userId").lean();
  const byCustomer = new Map(customers.map((c) => [String(c._id), c]));
  const [tenantRows, storeRows] = await Promise.all([
    Tenant.find({ _id: { $in: [...new Set(contracts.map((c) => String(c.tenantId)))] } }).select("name").lean(),
    Store.find({ _id: { $in: [...new Set(contracts.map((c) => String(c.storeId)))] } }).setOptions(ALL).select("name").lean(),
  ]);
  const tenantName = new Map(tenantRows.map((t) => [String(t._id), t.name]));
  const storeName = new Map(storeRows.map((s) => [String(s._id), s.name]));

  const groups = new Map();
  for (const c of contracts) {
    const cust = byCustomer.get(String(c.customerId));
    if (!cust) continue;
    const keys = [cust.pan && `PAN ${cust.pan}`, phoneDigits(cust.phone).length === 10 && `Mobile ${phoneDigits(cust.phone)}`].filter(Boolean);
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({
        tenant: tenantName.get(String(c.tenantId)),
        store: storeName.get(String(c.storeId)),
        storeId: String(c.storeId),
        customer: cust.name,
        contractNo: c.contractNo,
        outstanding: c.principal - c.paidPrincipal,
        dpd: c.currentDpd,
      });
    }
  }
  return [...groups.entries()]
    .filter(([, rows]) => new Set(rows.map((r) => r.storeId)).size > 1)
    .map(([key, rows]) => ({ key, stores: new Set(rows.map((r) => r.storeId)).size, outstanding: rows.reduce((s, r) => s + r.outstanding, 0), maxDpd: Math.max(...rows.map((r) => r.dpd)), contracts: rows }))
    .sort((a, b) => b.outstanding - a.outstanding);
}

// ---- Every shop's records (read only), newest first, ?tenantId= to narrow ----

const isId = (id) => /^[a-f\d]{24}$/i.test(String(id || ""));
const cap = (limit, max = 500) => Math.min(Number(limit) || 200, max);

// Shop, store and customer names for a page of rows
async function withNames(rows) {
  const ids = (key) => [...new Set(rows.map((r) => r[key]).filter(Boolean).map(String))];
  const [tenantRows, storeRows, customerRows] = await Promise.all([
    Tenant.find({ _id: { $in: ids("tenantId") } }).select("name").lean(),
    Store.find({ _id: { $in: ids("storeId") } }).setOptions(ALL).select("name invoicePrefix").lean(),
    Customer.find({ _id: { $in: ids("customerId") } }).select("name phone").lean(),
  ]);
  const map = (list) => new Map(list.map((x) => [String(x._id), x]));
  const [t, s, c] = [map(tenantRows), map(storeRows), map(customerRows)];
  return rows.map((r) => ({
    ...r,
    tenantName: t.get(String(r.tenantId))?.name || "—",
    storeName: s.get(String(r.storeId))?.name || "—",
    customer: c.get(String(r.customerId)) || null,
  }));
}

const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function invoices({ tenantId, status, financeType, q, limit }) {
  const filter = {};
  if (isId(tenantId)) filter.tenantId = tenantId;
  if (status) filter.status = status;
  if (financeType) filter.financeType = financeType;
  if (q) filter.$or = [{ invoiceNo: new RegExp(escape(q), "i") }, { "customer.name": new RegExp(escape(q), "i") }, { "customer.phone": new RegExp(escape(q)) }, { "lines.imei": new RegExp(escape(q)) }];
  const rows = await Invoice.find(filter).setOptions(ALL).sort({ createdAt: -1 }).limit(cap(limit)).lean();
  return withNames(rows);
}

async function invoiceDetail(id) {
  if (!isId(id)) throw new AppError(400, "ID galat hai");
  const invoice = await Invoice.findOne({ _id: id }).setOptions(ALL).lean();
  if (!invoice) throw new AppError(404, "Invoice nahi mila");
  const scope = { tenantId: invoice.tenantId };
  const [payments, contract, nbfcCase] = await Promise.all([
    Payment.find({ ...scope, invoiceId: invoice._id }).sort({ createdAt: 1 }).lean(),
    invoice.emiContractId ? EmiContract.findOne({ ...scope, _id: invoice.emiContractId }).select("-followUps").lean() : null,
    invoice.nbfcCaseId ? NbfcCase.findOne({ ...scope, _id: invoice.nbfcCaseId }).lean() : null,
  ]);
  const [named] = await withNames([invoice]);
  return { invoice: named, payments, contract, nbfcCase };
}

const CONTRACT_VIEWS = {
  active: { status: "ACTIVE" },
  overdue: { status: "ACTIVE", currentDpd: { $gt: 0 } },
  pending: { status: "PENDING_APPROVAL" },
  closed: { status: { $in: ["CLOSED", "FORECLOSED", "CANCELLED"] } },
  all: {},
};

async function contracts({ tenantId, view = "active", q, limit }) {
  const filter = { ...(CONTRACT_VIEWS[view] || CONTRACT_VIEWS.active) };
  if (isId(tenantId)) filter.tenantId = tenantId;
  if (q) filter.contractNo = new RegExp(escape(q), "i");
  const rows = await EmiContract.find(filter).setOptions(ALL).select("-followUps").sort({ currentDpd: -1, nextDueDate: 1 }).limit(cap(limit)).lean();
  return (await withNames(rows)).map((c) => ({ ...c, outstandingPrincipal: c.principal - c.paidPrincipal }));
}

async function contractDetail(id) {
  if (!isId(id)) throw new AppError(400, "ID galat hai");
  const contract = await EmiContract.findOne({ _id: id }).setOptions(ALL).lean();
  if (!contract) throw new AppError(404, "EMI contract nahi mila");
  const scope = { tenantId: contract.tenantId };
  const [installments, payments] = await Promise.all([
    EmiInstallment.find({ ...scope, contractId: contract._id }).sort({ no: 1 }).lean(),
    Payment.find({ ...scope, emiContractId: contract._id }).sort({ createdAt: -1 }).lean(),
  ]);
  const [named] = await withNames([contract]);
  return {
    contract: named,
    installments: installments.map((i) => ({ ...i, unpaid: totalOf(unpaidOf(i)) })),
    payments,
  };
}

async function nbfcCases({ tenantId, status, limit }) {
  const filter = {};
  if (isId(tenantId)) filter.tenantId = tenantId;
  if (status) filter.status = status;
  return withNames(await NbfcCase.find(filter).setOptions(ALL).sort({ createdAt: -1 }).limit(cap(limit)).lean());
}

async function payments({ tenantId, status, purpose, limit }) {
  const filter = {};
  if (isId(tenantId)) filter.tenantId = tenantId;
  if (status) filter.status = status;
  if (purpose) filter.purpose = purpose;
  return withNames(await Payment.find(filter).setOptions(ALL).select("-allocations").sort({ createdAt: -1 }).limit(cap(limit)).lean());
}

const auditLog = (limit = 200) => AuditLog.find({ tenantId: { $ne: null } }).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 200, 1000)).lean();

module.exports = {
  dashboard,
  tenants,
  setTenantStatus,
  getSettings,
  saveSettings,
  partners,
  savePartner,
  multiStoreCustomers,
  auditLog,
  invoices,
  invoiceDetail,
  contracts,
  contractDetail,
  nbfcCases,
  payments,
};
