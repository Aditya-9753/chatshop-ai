const { Invoice, Payment } = require("../models/sales");
const { EmiContract, EmiInstallment, NbfcCase, JournalEntry, Approval } = require("../models/finance");
const { trialBalance, ACC, ACCOUNT_NAMES } = require("../domain/ledger");
const { unpaidOf, totalOf, addMonths } = require("../domain/emi");
const { BUCKETS } = require("../domain/overdue");
const { scoped, today, AppError } = require("../utils/helpers");
const { agentOnly } = require("../middleware/rbac");

const LIVE_INVOICE = { status: { $ne: "CANCELLED" } };

const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

async function dashboard(req) {
  const base = scoped(req);
  const day = today();
  const from = addDays(day, -13);

  const [salesToday, collectionsToday, overdue, book, approvals, nbfcPending, series, buckets] = await Promise.all([
    Invoice.aggregate([{ $match: { ...base, ...LIVE_INVOICE, date: day } }, { $group: { _id: null, count: { $sum: 1 }, gross: { $sum: "$grossTotal" } } }]),
    Payment.aggregate([
      { $match: { ...base, date: day, purpose: { $in: ["EMI", "FORECLOSURE"] }, status: { $ne: "REVERSED" } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]),
    EmiInstallment.find({ ...base, status: "OVERDUE" }).lean(),
    EmiContract.aggregate([
      { $match: { ...base, status: "ACTIVE" } },
      { $group: { _id: null, count: { $sum: 1 }, outstanding: { $sum: { $subtract: ["$principal", "$paidPrincipal"] } } } },
    ]),
    Approval.countDocuments({ ...base, status: "PENDING" }),
    NbfcCase.aggregate([
      { $match: { ...base, status: { $in: ["LOGIN", "APPROVED", "DO_RECEIVED"] } } },
      { $group: { _id: null, count: { $sum: 1 }, payout: { $sum: "$expectedPayout" } } },
    ]),
    Invoice.aggregate([
      { $match: { ...base, ...LIVE_INVOICE, date: { $gte: from, $lte: day } } },
      { $group: { _id: "$date", gross: { $sum: "$grossTotal" }, count: { $sum: 1 } } },
    ]),
    EmiContract.aggregate([{ $match: { ...base, status: "ACTIVE" } }, { $group: { _id: "$bucket", count: { $sum: 1 } } }]),
  ]);

  const byDay = new Map(series.map((s) => [s._id, s]));
  return {
    date: day,
    salesToday: { count: salesToday[0]?.count || 0, gross: salesToday[0]?.gross || 0 },
    collectionsToday: { count: collectionsToday[0]?.count || 0, amount: collectionsToday[0]?.amount || 0 },
    overdue: { count: overdue.length, amount: overdue.reduce((s, i) => s + totalOf(unpaidOf(i)), 0) },
    emiBook: { contracts: book[0]?.count || 0, outstanding: book[0]?.outstanding || 0 },
    pendingApprovals: approvals,
    nbfcPending: { count: nbfcPending[0]?.count || 0, payout: nbfcPending[0]?.payout || 0 },
    sales14d: Array.from({ length: 14 }, (_, i) => {
      const date = addDays(from, i);
      return { date, gross: byDay.get(date)?.gross || 0, count: byDay.get(date)?.count || 0 };
    }),
    buckets: BUCKETS.map((b) => ({ bucket: b, count: buckets.find((x) => x._id === b)?.count || 0 })),
  };
}

// Active EMI book by DPD bucket: contracts, principal outstanding, overdue dues
async function emiAging(req) {
  const base = scoped(req);
  if (agentOnly(req)) base.assignedAgentId = req.user._id;
  const contracts = await EmiContract.find({ ...base, status: "ACTIVE" }).lean();
  const overdue = await EmiInstallment.find({ tenantId: base.tenantId, contractId: { $in: contracts.map((c) => c._id) }, status: "OVERDUE" }).lean();
  const overdueByContract = new Map();
  for (const i of overdue) overdueByContract.set(String(i.contractId), (overdueByContract.get(String(i.contractId)) || 0) + totalOf(unpaidOf(i)));

  return BUCKETS.map((b) => {
    const rows = contracts.filter((c) => c.bucket === b);
    return {
      bucket: b,
      contracts: rows.length,
      outstandingPrincipal: rows.reduce((s, c) => s + c.principal - c.paidPrincipal, 0),
      overdueAmount: rows.reduce((s, c) => s + (overdueByContract.get(String(c._id)) || 0), 0),
    };
  });
}

/**
 * GST for one month (YYYY-MM): output tax from the journals (sales, EMI
 * interest, foreclosure charges, minus reversals), input tax credit on card
 * fees and subvention, and a rate-wise table of the month's invoices.
 */
async function gstSummary(req, month) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) throw new AppError(400, "month=YYYY-MM do");
  const base = scoped(req);
  const from = `${month}-01`;
  const to = addMonths(from, 1);

  const [journals, invoices] = await Promise.all([
    JournalEntry.find({ ...base, date: { $gte: from, $lt: to } }).lean(),
    Invoice.find({ ...base, ...LIVE_INVOICE, date: { $gte: from, $lt: to } }).lean(),
  ]);

  const output = { cgst: 0, sgst: 0, igst: 0 };
  const byEvent = {};
  let inputGst = 0;
  for (const j of journals) {
    for (const l of j.lines) {
      const net = l.cr - l.dr;
      const key = l.account === ACC.OUTPUT_CGST ? "cgst" : l.account === ACC.OUTPUT_SGST ? "sgst" : l.account === ACC.OUTPUT_IGST ? "igst" : null;
      if (key) {
        output[key] += net;
        byEvent[j.event] = (byEvent[j.event] || 0) + net;
      }
      if (l.account === ACC.INPUT_GST) inputGst += l.dr - l.cr;
    }
  }

  const rates = {};
  for (const inv of invoices) {
    for (const l of inv.lines) {
      const r = (rates[l.gstRatePct] ||= { ratePct: l.gstRatePct, taxable: 0, cgst: 0, sgst: 0, igst: 0, invoices: new Set() });
      r.taxable += l.taxable;
      r.cgst += l.cgst;
      r.sgst += l.sgst;
      r.igst += l.igst;
      r.invoices.add(String(inv._id));
    }
  }

  const totalOutput = output.cgst + output.sgst + output.igst;
  return {
    month,
    output,
    totalOutput,
    inputGst,
    netPayable: totalOutput - inputGst,
    byEvent: Object.entries(byEvent).map(([event, amount]) => ({ event, amount })),
    rateWise: Object.values(rates)
      .map(({ invoices: set, ...r }) => ({ ...r, invoices: set.size }))
      .sort((a, b) => a.ratePct - b.ratePct),
    invoiceCount: invoices.length,
  };
}

async function trialBalanceReport(req, { asOf } = {}) {
  const filter = scoped(req);
  if (asOf) filter.date = { $lte: asOf };
  const journals = await JournalEntry.find(filter).select("lines").lean();
  return trialBalance(journals);
}

async function ledger(req, { account, from, to, refId, limit = 200 } = {}) {
  const filter = scoped(req);
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (account) filter["lines.account"] = account;
  if (refId) filter.refId = refId;
  const entries = await JournalEntry.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 200, 1000)).lean();
  return { entries, accounts: ACCOUNT_NAMES };
}

module.exports = { dashboard, emiAging, gstSummary, trialBalanceReport, ledger };
