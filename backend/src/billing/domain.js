const { splitInclusive, addGst, isInterState } = require("../emi/domain/gst");
const { AppError } = require("../emi/utils/helpers");

// Pure money rules for platform billing, with no database. Amounts in paise.

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LIFETIME_END = new Date("2099-12-31T23:59:59.000Z");

// An AppError, so the EMI module's error handler shows it as it is (plan
// limits are hit from EMI routes too)
class BillingError extends AppError {
  constructor(status, message, code) {
    super(status, message, undefined, code);
  }
}

// Calendar date in India for a moment, as YYYY-MM-DD
const istDate = (at = new Date()) => new Date(new Date(at).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

// Start of an India calendar day (YYYY-MM-DD) as a UTC Date
const istDayStart = (date) => new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS);

// Indian financial year (April–March) of a date: 2026-11-02 -> "26-27"
function financialYear(at = new Date()) {
  const [year, month] = istDate(at).split("-").map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// CSA-26-27-000001; credit notes CN-CSA-26-27-000001
const documentNumber = (prefix, fy, seq, documentType = "INVOICE") =>
  `${documentType === "CREDIT_NOTE" ? "CN-" : ""}${prefix}-${fy}-${String(seq).padStart(6, "0")}`;

// Same day next month (or year), clamped to the month's last day
function addInterval(from, interval) {
  if (interval === "ONE_TIME") return new Date(LIFETIME_END);
  const d = new Date(from);
  const day = d.getUTCDate();
  const months = interval === "YEARLY" ? 12 : 1;
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/**
 * The period a plan purchase covers. Buying the plan a shop already pays for
 * renews it from the current end date; a trial, an ended plan or a switch to
 * a different plan starts a new period now (unused days of the old plan are
 * not carried over; the checkout screen says so).
 */
function purchasePeriod(subscription = {}, plan, now = new Date()) {
  const end = subscription.endDate ? new Date(subscription.endDate) : null;
  const renewing =
    subscription.plan === plan.code &&
    subscription.status === "active" &&
    !subscription.trial &&
    plan.interval !== "ONE_TIME" &&
    end &&
    end > now;
  const start = renewing ? end : new Date(now);
  return { start, end: addInterval(start, plan.interval), kind: renewing ? "RENEWED" : subscription.plan && subscription.plan !== plan.code ? "PLAN_CHANGED" : "ACTIVATED" };
}

/**
 * Lines and totals of a platform invoice.
 *  lines: [{ kind, description, qty, unitPricePaise, discountPaise, ... }]
 *  tax: { gstRegistered, gstRatePct, pricesIncludeGst, supplierState, customerState }
 * Without a GSTIN ChatShop is not registered for GST and charges none.
 */
function computeInvoice(lines, tax) {
  if (!Array.isArray(lines) || lines.length === 0) throw new BillingError(422, "Add at least one line");
  const interState = isInterState(tax.supplierState, tax.customerState);
  const rate = tax.gstRegistered ? Number(tax.gstRatePct) : 0;
  if (!(rate >= 0 && rate <= 28)) throw new BillingError(422, "GST rate must be between 0 and 28%");

  const out = lines.map((line, i) => {
    const qty = Number(line.qty ?? 1);
    const unit = line.unitPricePaise;
    const discount = line.discountPaise || 0;
    const label = line.description || `Line ${i + 1}`;
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new BillingError(422, `${label}: quantity must be a whole number from 1 to 1000`);
    if (!Number.isInteger(unit) || unit < 0) throw new BillingError(422, `${label}: price must be whole paise`);
    if (!Number.isInteger(discount) || discount < 0) throw new BillingError(422, `${label}: discount must be whole paise`);
    const gross = qty * unit;
    if (discount > gross) throw new BillingError(422, `${label}: discount is more than the line amount`);
    const amount = gross - discount;
    const split = rate === 0 ? { taxable: amount, cgst: 0, sgst: 0, igst: 0, gross: amount } : tax.pricesIncludeGst ? splitInclusive(amount, rate, interState) : addGst(amount, rate, interState);
    return {
      ...line,
      qty,
      unitPricePaise: unit,
      discountPaise: discount,
      taxablePaise: split.taxable,
      taxRateBps: Math.round(rate * 100),
      cgstPaise: split.cgst,
      sgstPaise: split.sgst,
      igstPaise: split.igst,
      totalPaise: split.gross,
    };
  });

  const total = (key) => out.reduce((s, l) => s + l[key], 0);
  const cgst = total("cgstPaise");
  const sgst = total("sgstPaise");
  const igst = total("igstPaise");
  return {
    lines: out,
    interState,
    subtotalPaise: out.reduce((s, l) => s + l.qty * l.unitPricePaise, 0),
    discountPaise: total("discountPaise"),
    taxablePaise: total("taxablePaise"),
    cgstPaise: cgst,
    sgstPaise: sgst,
    igstPaise: igst,
    taxTotalPaise: cgst + sgst + igst,
    grandTotalPaise: total("totalPaise"),
  };
}

/**
 * Credit note for `amount` (tax included) against an invoice: the same GST
 * share as the invoice, so the credit reverses tax in proportion.
 */
function creditNoteSplit(invoice, amount) {
  if (!invoice.grandTotalPaise) return { taxablePaise: amount, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, grandTotalPaise: amount };
  const tax = Math.round((invoice.taxTotalPaise * amount) / invoice.grandTotalPaise);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (invoice.igstPaise > 0) igst = tax;
  else {
    sgst = Math.floor(tax / 2);
    cgst = tax - sgst;
  }
  return { taxablePaise: amount - tax, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst, grandTotalPaise: amount };
}

// Payment status of an invoice from what has been paid
const paymentStatusOf = (grandTotal, paid) => (paid <= 0 ? "UNPAID" : paid >= grandTotal ? "PAID" : "PARTIALLY_PAID");

// Monthly value of a subscription: yearly ÷ 12, one-time plans none
const monthlyValue = (pricePaise, interval) => (interval === "YEARLY" ? Math.round(pricePaise / 12) : interval === "MONTHLY" ? pricePaise : 0);

// GST state code from a GSTIN ("23ABCDE1234F1Z5" -> "23")
const stateFromGstin = (gstin) => (/^\d{2}[A-Z0-9]{13}$/i.test(gstin || "") ? String(gstin).slice(0, 2) : null);

module.exports = {
  DAY_MS,
  LIFETIME_END,
  BillingError,
  istDate,
  istDayStart,
  financialYear,
  documentNumber,
  addInterval,
  purchasePeriod,
  computeInvoice,
  creditNoteSplit,
  paymentStatusOf,
  monthlyValue,
  stateFromGstin,
};
