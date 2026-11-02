const User = require("../models/User.model");
const { PlatformInvoice, PlatformPayment, PlatformRefund, PaymentEvent, SubscriptionEvent } = require("./models");
const { listPlans } = require("./plans");
const { getBillingSettings } = require("./settings");
const subscriptions = require("./subscriptions");
const { BillingError, DAY_MS, istDate, istDayStart, monthlyValue } = require("./domain");

// Every figure here comes from platform invoices, payments and refunds only:
// a shop's own sales to its customers are never ChatShop revenue.
// Dates are India calendar days (Asia/Kolkata).

const TIMEZONE = "Asia/Kolkata";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const nextDay = (date) => istDate(istDayStart(date).getTime() + DAY_MS + 3600 * 1000);

function range({ from, to } = {}) {
  const today = istDate();
  const start = DATE_RE.test(from || "") ? from : `${today.slice(0, 7)}-01`;
  const end = DATE_RE.test(to || "") ? to : today;
  if (start > end) throw new BillingError(400, "'from' must be on or before 'to'");
  return { from: start, to: end, fromAt: istDayStart(start), toAt: istDayStart(nextDay(end)) };
}

const sumOf = async (Model, match, field) => (await Model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` }, count: { $sum: 1 } } }]))[0] || { total: 0, count: 0 };

/**
 * Paying shops and their monthly recurring value. "Paying" = an active plan
 * that a payment or paid invoice turned on (trials and plans granted for free
 * have no price). Yearly plans count as price ÷ 12; one-time plans add none.
 * Values are before GST.
 */
async function recurring() {
  const shops = await User.find({ role: "user", "subscription.status": "active", "subscription.trial": { $ne: true } })
    .select("subscription")
    .lean();
  const plans = await listPlans({ includeInactive: true });
  const names = new Map(plans.map((p) => [p.code, p.name]));
  const byPlan = new Map();
  let mrr = 0;
  let paying = 0;
  for (const s of shops) {
    const value = monthlyValue(s.subscription.pricePaise || 0, s.subscription.interval);
    if (!value) continue;
    paying += 1;
    mrr += value;
    const row = byPlan.get(s.subscription.plan) || { plan: s.subscription.plan, name: names.get(s.subscription.plan) || s.subscription.plan, shops: 0, mrrPaise: 0 };
    row.shops += 1;
    row.mrrPaise += value;
    byPlan.set(s.subscription.plan, row);
  }
  return { mrrPaise: mrr, paying, byPlan: [...byPlan.values()].sort((a, b) => b.mrrPaise - a.mrrPaise) };
}

async function overview(query) {
  const r = range(query);
  const inDays = { invoiceDate: { $gte: r.from, $lte: r.to } };
  const [billed, credited, collected, refunded, outstanding, overdue, rec, trials, churnRows, activations, series] = await Promise.all([
    sumOf(PlatformInvoice, { documentType: "INVOICE", status: "ISSUED", ...inDays }, "grandTotalPaise"),
    sumOf(PlatformInvoice, { documentType: "CREDIT_NOTE", status: "ISSUED", ...inDays }, "grandTotalPaise"),
    sumOf(PlatformPayment, { status: "CAPTURED", capturedAt: { $gte: r.fromAt, $lt: r.toAt } }, "amountPaise"),
    sumOf(PlatformRefund, { status: "PROCESSED", processedAt: { $gte: r.fromAt, $lt: r.toAt } }, "amountPaise"),
    sumOf(PlatformInvoice, { documentType: "INVOICE", status: "ISSUED", balanceDuePaise: { $gt: 0 } }, "balanceDuePaise"),
    sumOf(PlatformInvoice, { documentType: "INVOICE", status: "ISSUED", balanceDuePaise: { $gt: 0 }, dueDate: { $lt: istDate() } }, "balanceDuePaise"),
    recurring(),
    User.countDocuments({ role: "user", "subscription.status": "active", "subscription.trial": true }),
    SubscriptionEvent.distinct("merchantId", { type: { $in: ["EXPIRED", "CANCELLED"] }, createdAt: { $gte: r.fromAt, $lt: r.toAt } }),
    SubscriptionEvent.distinct("merchantId", { type: "ACTIVATED", createdAt: { $gte: r.fromAt, $lt: r.toAt } }),
    PlatformPayment.aggregate([
      { $match: { status: "CAPTURED", capturedAt: { $gte: r.fromAt, $lt: r.toAt } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$capturedAt", timezone: TIMEZONE } }, amountPaise: { $sum: "$amountPaise" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Logo churn: shops whose paid plan ended in the period ÷ shops paying at
  // its start (paying now + those that ended − those that started)
  const churned = churnRows.length;
  const startBase = Math.max(rec.paying + churned - activations.length, churned);
  return {
    range: { from: r.from, to: r.to, timezone: TIMEZONE },
    grossBilledPaise: billed.total,
    invoicesIssued: billed.count,
    creditNotesPaise: credited.total,
    netBilledPaise: billed.total - credited.total,
    collectedPaise: collected.total,
    paymentsCaptured: collected.count,
    refundsPaise: refunded.total,
    netCollectionsPaise: collected.total - refunded.total,
    outstandingPaise: outstanding.total,
    outstandingInvoices: outstanding.count,
    overduePaise: overdue.total,
    overdueInvoices: overdue.count,
    mrrPaise: rec.mrrPaise,
    arrPaise: rec.mrrPaise * 12,
    payingShops: rec.paying,
    arpuPaise: rec.paying ? Math.round(rec.mrrPaise / rec.paying) : 0,
    trials,
    churnedShops: churned,
    churnPct: startBase ? Math.round((churned / startBase) * 1000) / 10 : 0,
    byPlan: rec.byPlan,
    collectionsByDay: series.map((s) => ({ date: s._id, amountPaise: s.amountPaise, count: s.count })),
    definitions: {
      grossBilled: "Platform tax invoices issued in the period (void ones excluded)",
      netBilled: "Gross billed minus credit notes issued in the period",
      collected: "Payments captured in the period (gateway or recorded by hand)",
      netCollections: "Collected minus refunds processed in the period",
      outstanding: "Unpaid balance on issued invoices today",
      mrr: "Monthly value of active paid plans, before GST; yearly ÷ 12; trials, free grants and one-time plans excluded",
      arpu: "MRR ÷ paying shops",
      churn: "Paid plans that expired or were cancelled in the period ÷ paying shops at the period start",
    },
  };
}

const merchantNames = async (ids) => {
  const users = await User.find({ _id: { $in: [...new Set(ids.map(String))] } }).select("name email businessInfo.businessName").lean();
  return new Map(users.map((u) => [String(u._id), { _id: u._id, name: u.businessInfo?.businessName || u.name, email: u.email }]));
};

const page = (query) => {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  const pageNo = Math.max(Number(query.page) || 1, 1);
  return { limit, pageNo, skip: (pageNo - 1) * limit };
};

async function listInvoices(query = {}) {
  const filter = {};
  if (["INVOICE", "CREDIT_NOTE"].includes(query.documentType)) filter.documentType = query.documentType;
  if (["UNPAID", "PARTIALLY_PAID", "PAID"].includes(query.paymentStatus)) filter.paymentStatus = query.paymentStatus;
  if (query.status === "VOID" || query.status === "ISSUED") filter.status = query.status;
  if (query.overdue === "true") Object.assign(filter, { documentType: "INVOICE", status: "ISSUED", balanceDuePaise: { $gt: 0 }, dueDate: { $lt: istDate() } });
  if (query.merchantId && /^[a-f\d]{24}$/i.test(query.merchantId)) filter.merchantId = query.merchantId;
  if (DATE_RE.test(query.from || "") || DATE_RE.test(query.to || "")) filter.invoiceDate = { ...(DATE_RE.test(query.from || "") && { $gte: query.from }), ...(DATE_RE.test(query.to || "") && { $lte: query.to }) };
  if (query.q) filter.invoiceNo = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const { limit, pageNo, skip } = page(query);
  const [rows, total] = await Promise.all([
    PlatformInvoice.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(limit).select("-allocations").lean(),
    PlatformInvoice.countDocuments(filter),
  ]);
  return { rows, total, page: pageNo, limit };
}

async function invoiceDetail(id, merchantId) {
  const filter = { _id: id, ...(merchantId && { merchantId }) };
  const invoice = await PlatformInvoice.findOne(filter).lean();
  if (!invoice) throw new BillingError(404, "Invoice not found");
  const [payments, refunds, creditNotes, original] = await Promise.all([
    PlatformPayment.find({ _id: { $in: invoice.allocations.map((a) => a.paymentId) } }).select("paymentRef gateway method amountPaise status capturedAt reference refundedPaise").lean(),
    PlatformRefund.find({ invoiceId: invoice._id }).sort({ createdAt: -1 }).lean(),
    PlatformInvoice.find({ originalInvoiceId: invoice._id }).select("invoiceNo grandTotalPaise invoiceDate reason").lean(),
    invoice.originalInvoiceId ? PlatformInvoice.findById(invoice.originalInvoiceId).select("invoiceNo invoiceDate").lean() : null,
  ]);
  return { invoice, payments, refunds, creditNotes, original };
}

async function transactions(query = {}) {
  const filter = {};
  if (["CREATED", "CAPTURED", "FAILED", "REVIEW"].includes(query.status)) filter.status = query.status;
  if (["RAZORPAY", "MOCK", "MANUAL"].includes(query.gateway)) filter.gateway = query.gateway;
  if (query.merchantId && /^[a-f\d]{24}$/i.test(query.merchantId)) filter.merchantId = query.merchantId;
  if (DATE_RE.test(query.from || "") || DATE_RE.test(query.to || "")) {
    const r = range(query);
    filter.createdAt = { $gte: r.fromAt, $lt: r.toAt };
  }
  if (query.q) {
    const q = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ paymentRef: q }, { gatewayOrderId: q }, { gatewayPaymentId: q }, { reference: q }];
  }
  const { limit, pageNo, skip } = page(query);
  const [rows, total] = await Promise.all([PlatformPayment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), PlatformPayment.countDocuments(filter)]);
  const names = await merchantNames(rows.map((p) => p.merchantId));
  const invoiceNos = new Map((await PlatformInvoice.find({ _id: { $in: rows.map((p) => p.invoiceId).filter(Boolean) } }).select("invoiceNo").lean()).map((i) => [String(i._id), i.invoiceNo]));
  const refunds = await PlatformRefund.find({ paymentId: { $in: rows.map((p) => p._id) } }).sort({ createdAt: -1 }).lean();
  return {
    rows: rows.map((p) => ({
      ...p,
      merchant: names.get(String(p.merchantId)) || null,
      invoiceNo: invoiceNos.get(String(p.invoiceId)) || null,
      refundablePaise: ["CAPTURED", "REVIEW"].includes(p.status) && (p.status === "CAPTURED" || p.gatewayPaymentId) ? p.amountPaise - p.refundReservedPaise : 0,
      refunds: refunds.filter((r) => String(r.paymentId) === String(p._id)),
    })),
    total,
    page: pageNo,
    limit,
  };
}

/**
 * Things that don't add up, each with what to do: orders with no answer from
 * the gateway, amounts that didn't match, captures that stopped half way,
 * webhooks that failed, refunds stuck at the gateway, invoices whose paid
 * amount differs from their payments.
 */
async function reconciliation() {
  const now = Date.now();
  const [stuck, review, captured, failedEvents, pendingRefunds, invoicesPaid] = await Promise.all([
    PlatformPayment.find({ status: "CREATED", gateway: { $ne: "MANUAL" }, createdAt: { $lt: new Date(now - 30 * 60 * 1000), $gt: new Date(now - 30 * DAY_MS) } }).sort({ createdAt: -1 }).limit(100).lean(),
    PlatformPayment.find({ status: "REVIEW" }).sort({ createdAt: -1 }).limit(100).lean(),
    PlatformPayment.find({ status: "CAPTURED" }).select("paymentRef merchantId purpose invoiceId amountPaise capturedAt gateway").lean(),
    PaymentEvent.find({ processedAt: null, error: { $ne: null } }).sort({ receivedAt: -1 }).limit(100).lean(),
    PlatformRefund.find({ status: "PENDING", createdAt: { $lt: new Date(now - DAY_MS) } }).sort({ createdAt: -1 }).limit(100).lean(),
    PlatformInvoice.find({ documentType: "INVOICE", status: "ISSUED", amountPaidPaise: { $gt: 0 } }).select("invoiceNo merchantId amountPaidPaise grandTotalPaise allocations").lean(),
  ]);

  const invoicedIds = new Set(invoicesPaid.flatMap((i) => i.allocations.map((a) => String(a.paymentId))));
  const unfinished = captured.filter((p) => !invoicedIds.has(String(p._id)));

  const capturedById = new Map(captured.map((p) => [String(p._id), p]));
  const mismatched = invoicesPaid
    .map((i) => {
      const fromPayments = i.allocations.reduce((s, a) => s + (capturedById.has(String(a.paymentId)) ? a.amountPaise : 0), 0);
      return fromPayments === i.amountPaidPaise && i.amountPaidPaise <= i.grandTotalPaise ? null : { _id: i._id, invoiceNo: i.invoiceNo, merchantId: i.merchantId, amountPaidPaise: i.amountPaidPaise, fromPaymentsPaise: fromPayments, grandTotalPaise: i.grandTotalPaise };
    })
    .filter(Boolean);

  const names = await merchantNames([...stuck, ...review, ...unfinished, ...pendingRefunds, ...mismatched].map((x) => x.merchantId));
  const withName = (rows) => rows.map((x) => ({ ...x, merchant: names.get(String(x.merchantId)) || null }));
  const sections = {
    stuckPayments: withName(stuck),
    reviewPayments: withName(review),
    unfinishedCaptures: withName(unfinished),
    failedWebhooks: failedEvents,
    pendingRefunds: withName(pendingRefunds),
    invoiceMismatches: withName(mismatched),
  };
  return { ...sections, issues: Object.values(sections).reduce((n, rows) => n + rows.length, 0), checkedAt: new Date() };
}

// One shop's platform billing for the Super Admin
async function merchantBilling(merchantId) {
  const merchant = await User.findOne({ _id: merchantId, role: "user" }).select("name email phone businessInfo subscription createdAt").lean();
  if (!merchant) throw new BillingError(404, "Shop not found");
  const settings = await getBillingSettings();
  const [invoiceRows, payments, events] = await Promise.all([
    PlatformInvoice.find({ merchantId }).sort({ issuedAt: -1 }).limit(100).select("-allocations").lean(),
    PlatformPayment.find({ merchantId }).sort({ createdAt: -1 }).limit(100).lean(),
    SubscriptionEvent.find({ merchantId }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  return {
    merchant: { _id: merchant._id, name: merchant.name, businessName: merchant.businessInfo?.businessName, email: merchant.email, phone: merchant.phone, gstin: merchant.businessInfo?.gstNumber, createdAt: merchant.createdAt },
    subscription: subscriptions.describe(merchant.subscription, settings.graceDays),
    outstandingPaise: invoiceRows.filter((i) => i.documentType === "INVOICE" && i.status === "ISSUED").reduce((s, i) => s + i.balanceDuePaise, 0),
    invoices: invoiceRows,
    payments,
    events,
  };
}

// ---- CSV export ----

const csvCell = (v) => {
  const text = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(text) || /^[=+\-@]/.test(text) ? `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"` : text;
};
const rupees = (paise) => ((paise || 0) / 100).toFixed(2);

async function exportCsv(kind, query = {}) {
  const r = range(query);
  let header;
  let rows;
  if (kind === "invoices") {
    const docs = await PlatformInvoice.find({ invoiceDate: { $gte: r.from, $lte: r.to } }).sort({ invoiceDate: 1, invoiceNo: 1 }).lean();
    header = ["Document", "Number", "Date", "Shop", "Shop GSTIN", "Place of supply", "Taxable (INR)", "CGST", "SGST", "IGST", "Total", "Paid", "Balance", "Status", "Payment status", "Against invoice"];
    const originals = new Map((await PlatformInvoice.find({ _id: { $in: docs.map((d) => d.originalInvoiceId).filter(Boolean) } }).select("invoiceNo").lean()).map((d) => [String(d._id), d.invoiceNo]));
    rows = docs.map((d) => [
      d.documentType === "CREDIT_NOTE" ? "Credit note" : "Tax invoice",
      d.invoiceNo,
      d.invoiceDate,
      d.customerSnapshot?.businessName || d.customerSnapshot?.name,
      d.customerSnapshot?.gstin,
      d.placeOfSupply,
      rupees(d.taxablePaise),
      rupees(d.cgstPaise),
      rupees(d.sgstPaise),
      rupees(d.igstPaise),
      rupees(d.grandTotalPaise),
      rupees(d.amountPaidPaise),
      rupees(d.balanceDuePaise),
      d.status,
      d.paymentStatus,
      originals.get(String(d.originalInvoiceId)) || "",
    ]);
  } else if (kind === "payments") {
    const docs = await PlatformPayment.find({ createdAt: { $gte: r.fromAt, $lt: r.toAt } }).sort({ createdAt: 1 }).lean();
    const names = await merchantNames(docs.map((d) => d.merchantId));
    header = ["Reference", "Created (IST)", "Captured (IST)", "Shop", "Purpose", "Gateway", "Method", "Gateway order", "Gateway payment", "Amount (INR)", "Refunded", "Status", "Note"];
    const ist = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19) : "");
    rows = docs.map((d) => [d.paymentRef, ist(d.createdAt), ist(d.capturedAt), names.get(String(d.merchantId))?.name, d.purpose, d.gateway, d.method, d.gatewayOrderId, d.gatewayPaymentId, rupees(d.amountPaise), rupees(d.refundedPaise), d.status, d.failureReason || d.reviewReason || d.reference || ""]);
  } else {
    throw new BillingError(400, "Export 'invoices' or 'payments'");
  }
  const meta = [`# ChatShop AI platform ${kind}`, `# Generated ${new Date().toISOString()}`, `# Filters: from ${r.from} to ${r.to} (${TIMEZONE})`];
  return [...meta, header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

module.exports = { range, recurring, overview, listInvoices, invoiceDetail, transactions, reconciliation, merchantBilling, exportCsv, TIMEZONE };
