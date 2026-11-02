const { Store, Tenant } = require("../models/platform");
const { Invoice, Payment } = require("../models/sales");
const { Notification } = require("../models/finance");
const { computeMdr, GATEWAY_METHODS } = require("../domain/mdr");
const { ACC, dr, cr, journal, accountForMethod } = require("../domain/ledger");
const { fmt, sum } = require("../domain/money");
const { AppError, withTxn, nextSeq, pad, saveJournals, audit, today, scoped } = require("../utils/helpers");
const { resolveSettings } = require("./settings.service");
const bridge = require("./bridge.service");

// Pay-later (udhaar) sales: money that comes in after the sale, against the
// invoice's balance. The sale already booked the customer receivable, so a
// receipt just moves it to cash / bank / gateway.

const OPEN = ["UNPAID", "PARTIALLY_PAID"];

const isOverdue = (invoice, day = today()) => OPEN.includes(invoice.status) && invoice.balanceDue > 0 && invoice.dueDate && invoice.dueDate < day;

/**
 * Take a payment against a pay-later invoice. The balance is reduced with a
 * guarded update, so two cashiers can't both collect the last rupee. Cash on
 * one invoice stays under the Income Tax 269ST limit across all its payments.
 */
async function collectDue(req, invoiceId, { method, amount, txnRef }, idempotencyKey) {
  const tenantId = req.emi.tenantId;
  if (idempotencyKey) {
    const existing = await Payment.findOne({ tenantId, idempotencyKey });
    if (existing) return { duplicate: true, payment: existing };
  }
  const found = await Invoice.findOne({ ...scoped(req), _id: invoiceId });
  if (!found) throw new AppError(404, "Invoice nahi mila");
  if (!OPEN.includes(found.status)) throw new AppError(409, `Invoice ${found.status === "PAID" ? "poora paid" : found.status} hai; is par baaki payment nahi le sakte`);
  if (amount > found.balanceDue) throw new AppError(422, `Sirf ${fmt(found.balanceDue)} baaki hai`);

  const settings = await resolveSettings(tenantId, found.storeId);
  if (method === "CASH") {
    const cashSoFar = await Payment.aggregate([
      { $match: { tenantId, invoiceId: found._id, method: "CASH", status: { $ne: "REVERSED" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    if ((cashSoFar[0]?.total || 0) + amount >= settings.cashLimitPerTxn) {
      throw new AppError(422, `Ek invoice par kul cash ${fmt(settings.cashLimitPerTxn)} se kam hi le sakte hain (Income Tax 269ST)`);
    }
  }

  try {
    return await withTxn(async (session) => {
      const invoice = await Invoice.findOneAndUpdate(
        { tenantId, _id: found._id, status: { $in: OPEN }, balanceDue: { $gte: amount } },
        { $inc: { balanceDue: -amount, amountPaid: amount } },
        { new: true, session }
      );
      if (!invoice) throw new AppError(409, "Invoice abhi badla hai; dobara khol kar try karo");
      invoice.status = invoice.balanceDue === 0 ? "PAID" : "PARTIALLY_PAID";
      await invoice.save({ session });

      const store = await Store.findOne({ tenantId, _id: invoice.storeId }).session(session || null);
      const fee = computeMdr(method, amount, settings.mdrPct);
      const gateway = GATEWAY_METHODS.includes(method);
      const [payment] = await Payment.create(
        [
          {
            tenantId,
            storeId: invoice.storeId,
            receiptNo: `${store.invoicePrefix}-R${pad(await nextSeq(tenantId, `RCPT:${invoice.storeId}`, session))}`,
            date: today(),
            purpose: "DUE",
            invoiceId: invoice._id,
            customerId: invoice.customerId,
            method,
            amount,
            mdrRatePct: fee.ratePct,
            mdr: fee.mdr,
            gstOnMdr: fee.gstOnMdr,
            netSettled: fee.netSettled,
            txnRef,
            idempotencyKey: idempotencyKey || undefined,
            status: gateway ? "CAPTURED" : "SETTLED",
            settledAt: gateway ? undefined : new Date(),
            receivedBy: req.user._id,
          },
        ],
        { session }
      );
      await saveJournals(
        [journal("PAYMENT_RECEIVED", [dr(accountForMethod(method), amount), cr(ACC.CUSTOMER_RECEIVABLE, amount)], { method })],
        { tenantId, storeId: invoice.storeId, refType: "Payment", refId: payment._id, date: payment.date, createdBy: req.user._id },
        session
      );
      if (invoice.status === "PAID") await bridge.syncOrder(invoice, session);
      await audit(req, "invoice.collect", { entity: "Invoice", entityId: invoice._id, after: { receiptNo: payment.receiptNo, amount, method, balanceDue: invoice.balanceDue } }, session);
      return { payment, invoice: { _id: invoice._id, invoiceNo: invoice.invoiceNo, status: invoice.status, amountPaid: invoice.amountPaid, balanceDue: invoice.balanceDue } };
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey && error.keyPattern?.idempotencyKey) {
      const existing = await Payment.findOne({ tenantId, idempotencyKey });
      if (existing) return { duplicate: true, payment: existing };
    }
    throw error;
  }
}

// Pay-later invoices with money still owed, oldest due date first
async function listDues(req, { overdue, storeId } = {}) {
  const day = today();
  const filter = { ...scoped(req), status: { $in: OPEN }, balanceDue: { $gt: 0 } };
  if (storeId) filter.storeId = storeId;
  if (overdue === "true") filter.dueDate = { $lt: day };
  const rows = await Invoice.find(filter).sort({ dueDate: 1 }).limit(500).select("invoiceNo date dueDate customer customerId grossTotal amountPaid balanceDue status storeId financeType").lean();
  const withFlags = rows.map((r) => ({ ...r, overdue: isOverdue(r, day), daysOverdue: isOverdue(r, day) ? Math.round((Date.parse(day) - Date.parse(r.dueDate)) / 86400000) : 0 }));
  return {
    rows: withFlags,
    totals: {
      count: rows.length,
      balanceDue: sum(rows.map((r) => r.balanceDue)),
      overdueCount: withFlags.filter((r) => r.overdue).length,
      overdueAmount: sum(withFlags.filter((r) => r.overdue).map((r) => r.balanceDue)),
    },
  };
}

// Queue a WhatsApp reminder for what is owed (at most one a day per invoice)
async function remindDue(req, invoiceId) {
  const invoice = await Invoice.findOne({ ...scoped(req), _id: invoiceId });
  if (!invoice) throw new AppError(404, "Invoice nahi mila");
  if (!OPEN.includes(invoice.status) || invoice.balanceDue <= 0) throw new AppError(409, "Is invoice par kuch baaki nahi hai");
  const tenant = await Tenant.findById(invoice.tenantId).lean();
  const settings = await resolveSettings(invoice.tenantId, invoice.storeId);
  const dedupeKey = `${invoice._id}:DUE_REMINDER:${today()}`;
  const result = await Notification.updateOne(
    { tenantId: invoice.tenantId, dedupeKey },
    {
      $setOnInsert: {
        tenantId: invoice.tenantId,
        storeId: invoice.storeId,
        customerId: invoice.customerId,
        channel: settings.reminders.channel,
        template: "DUE_REMINDER",
        payload: { customerName: invoice.customer?.name || "Customer", invoiceNo: invoice.invoiceNo, amount: fmt(invoice.balanceDue), dueDate: invoice.dueDate, shopName: tenant?.name || "" },
        status: "QUEUED",
      },
    },
    { upsert: true }
  );
  if (!result.upsertedCount) throw new AppError(409, "Aaj is invoice ka reminder pehle hi bhej diya hai");
  await audit(req, "invoice.remind", { entity: "Invoice", entityId: invoice._id, after: { balanceDue: invoice.balanceDue } });
  return { queued: true };
}

module.exports = { collectDue, listDues, remindDue, isOverdue, OPEN };
