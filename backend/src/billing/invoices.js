const mongoose = require("mongoose");
const User = require("../models/User.model");
const { Tenant } = require("../emi/models/platform");
const { fmt } = require("../emi/domain/money");
const { PlatformInvoice, BillingCounter } = require("./models");
const { currentPlan } = require("./plans");
const { getBillingSettings, supplierSnapshot } = require("./settings");
const subscriptions = require("./subscriptions");
const { BillingError, computeInvoice, creditNoteSplit, documentNumber, financialYear, istDate, paymentStatusOf, stateFromGstin, DAY_MS } = require("./domain");

const INTERVAL_LABELS = { MONTHLY: "monthly", YEARLY: "yearly", ONE_TIME: "one-time" };
const shortDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

// Next number in the issuer's series for this financial year
async function nextNumber(prefix, documentType, session) {
  const fy = financialYear();
  const key = `${documentType}:${prefix}:${fy}`;
  const counter = await BillingCounter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true, session, setDefaultsOnInsert: true });
  return documentNumber(prefix, fy, counter.seq, documentType);
}

// The shop as the customer on a platform invoice, frozen at issue time
async function customerSnapshot(merchantId, session) {
  const merchant = await User.findById(merchantId).select("name email phone businessInfo role").session(session || null);
  if (!merchant || merchant.role !== "user") throw new BillingError(404, "Shop not found");
  const tenant = await Tenant.findById(merchantId).select("legalName gstin stateCode address").session(session || null).lean();
  const info = merchant.businessInfo || {};
  const gstin = info.gstNumber || tenant?.gstin || undefined;
  return {
    name: merchant.name,
    businessName: info.businessName || undefined,
    legalName: tenant?.legalName || info.businessName || merchant.name,
    email: info.businessEmail || merchant.email,
    phone: info.businessPhone || merchant.phone,
    gstin,
    address: info.address || tenant?.address || undefined,
    // Place of supply: the shop's state from its GSTIN, else its billing profile
    stateCode: stateFromGstin(gstin) || tenant?.stateCode || undefined,
  };
}

const taxOf = (settings, customer) => ({
  gstRegistered: settings.gstRegistered,
  gstRatePct: settings.gstRatePct,
  pricesIncludeGst: settings.pricesIncludeGst,
  supplierState: settings.stateCode,
  customerState: customer.stateCode,
});

const typeOf = (lines) => {
  const kinds = [...new Set(lines.map((l) => l.kind))];
  return kinds.length === 1 ? kinds[0] : "MIXED";
};

/**
 * Lines for a subscription: the plan's current version and the period it
 * covers. `unitPricePaise` may override the plan price (a negotiated rate).
 */
async function subscriptionLine({ planCode, periodStart, periodEnd, unitPricePaise, discountPaise, description }, sac) {
  const plan = await currentPlan(planCode);
  if (!plan) throw new BillingError(422, `Plan "${planCode}" doesn't exist`);
  if (!periodStart || !periodEnd || new Date(periodEnd) <= new Date(periodStart)) throw new BillingError(422, "Subscription lines need a period that ends after it starts");
  return planLine(plan, { start: periodStart, end: periodEnd, unitPricePaise, discountPaise, description, sac });
}

// Invoice line for a plan (a version snapshot works too) over a period
const planLine = (plan, { start, end, unitPricePaise, discountPaise, description, sac }) => ({
  kind: "SUBSCRIPTION",
  description: description || `${plan.name} plan, ${INTERVAL_LABELS[plan.interval]} (${shortDate(start)} – ${plan.interval === "ONE_TIME" ? "lifetime" : shortDate(end)})`,
  sac,
  planCode: plan.code,
  planVersion: plan.version,
  interval: plan.interval,
  periodStart: new Date(start),
  periodEnd: new Date(end),
  qty: 1,
  unitPricePaise: unitPricePaise ?? plan.pricePaise,
  discountPaise: discountPaise || 0,
});

async function buildLines(rawLines, settings) {
  const out = [];
  for (const line of rawLines) {
    if (line.kind === "SUBSCRIPTION") out.push(await subscriptionLine(line, settings.sac || undefined));
    else out.push({ kind: line.kind, description: line.description, sac: settings.sac || undefined, qty: line.qty ?? 1, unitPricePaise: line.unitPricePaise, discountPaise: line.discountPaise || 0 });
  }
  return out;
}

/**
 * Issue a platform tax invoice. `tax` overrides the settings used for GST
 * (a checkout uses the rules fixed when the shop started paying).
 * `payment` marks it paid by that payment at issue.
 */
async function issueInvoice({ merchantId, lines, source, dueDate, notes, payment, createdBy, idempotencyKey, tax }, session) {
  const settings = await getBillingSettings();
  const customer = await customerSnapshot(merchantId, session);
  const rules = { ...taxOf(settings, customer), ...(tax || {}), customerState: customer.stateCode, supplierState: settings.stateCode };
  const totals = computeInvoice(lines, rules);
  const invoiceNo = await nextNumber(settings.invoicePrefix || "CSA", "INVOICE", session);
  const paid = payment ? payment.amountPaise : 0;

  const [invoice] = await PlatformInvoice.create(
    [
      {
        documentType: "INVOICE",
        invoiceNo,
        merchantId,
        invoiceType: typeOf(lines),
        source,
        status: "ISSUED",
        paymentStatus: paymentStatusOf(totals.grandTotalPaise, paid),
        invoiceDate: istDate(),
        issuedAt: new Date(),
        dueDate: dueDate || istDate(Date.now() + (settings.paymentTermsDays || 0) * DAY_MS),
        ...totals,
        amountPaidPaise: paid,
        balanceDuePaise: Math.max(0, totals.grandTotalPaise - paid),
        allocations: payment ? [{ paymentId: payment._id, amountPaise: paid }] : [],
        gstRegistered: rules.gstRegistered,
        pricesIncludeGst: rules.pricesIncludeGst,
        placeOfSupply: customer.stateCode || settings.stateCode || undefined,
        supplierSnapshot: supplierSnapshot(settings),
        customerSnapshot: customer,
        notes,
        paymentId: payment && source === "CHECKOUT" ? payment._id : undefined,
        createdBy,
        idempotencyKey: idempotencyKey || undefined,
      },
    ],
    { session }
  );
  return invoice;
}

// A manual invoice as it would be issued, without saving it
async function previewManual({ merchantId, lines, dueDate, notes }) {
  const settings = await getBillingSettings();
  const customer = await customerSnapshot(merchantId);
  const built = await buildLines(lines, settings);
  const totals = computeInvoice(built, taxOf(settings, customer));
  return {
    invoiceNo: "PREVIEW",
    documentType: "INVOICE",
    invoiceDate: istDate(),
    dueDate: dueDate || istDate(Date.now() + (settings.paymentTermsDays || 0) * DAY_MS),
    ...totals,
    amountPaidPaise: 0,
    balanceDuePaise: totals.grandTotalPaise,
    gstRegistered: settings.gstRegistered,
    pricesIncludeGst: settings.pricesIncludeGst,
    supplierSnapshot: supplierSnapshot(settings),
    customerSnapshot: customer,
    notes,
  };
}

async function createManual({ merchantId, lines, dueDate, notes }, actor, idempotencyKey) {
  if (idempotencyKey) {
    const existing = await PlatformInvoice.findOne({ idempotencyKey });
    if (existing) return existing;
  }
  const settings = await getBillingSettings();
  const built = await buildLines(lines, settings);
  try {
    return await issueInvoice({ merchantId, lines: built, source: "MANUAL", dueDate, notes, createdBy: actor, idempotencyKey });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey && error.keyPattern?.idempotencyKey) return PlatformInvoice.findOne({ idempotencyKey });
    throw error;
  }
}

/**
 * Count a captured payment against an invoice, once. When that settles the
 * invoice and it holds a subscription, the plan turns on or extends.
 */
async function applyPayment(invoiceId, payment, session) {
  const s = session || null;
  const updated = await PlatformInvoice.findOneAndUpdate(
    {
      _id: invoiceId,
      documentType: "INVOICE",
      status: "ISSUED",
      merchantId: payment.merchantId,
      "allocations.paymentId": { $ne: payment._id },
      balanceDuePaise: { $gte: payment.amountPaise },
    },
    { $inc: { amountPaidPaise: payment.amountPaise, balanceDuePaise: -payment.amountPaise }, $push: { allocations: { paymentId: payment._id, amountPaise: payment.amountPaise } } },
    { new: true, session }
  );

  let invoice = updated;
  if (!invoice) {
    invoice = await PlatformInvoice.findOne({ _id: invoiceId, merchantId: payment.merchantId }).session(s);
    if (!invoice) throw new BillingError(404, "Invoice not found");
    if (!invoice.allocations.some((a) => String(a.paymentId) === String(payment._id))) {
      if (invoice.status !== "ISSUED") throw new BillingError(409, "This invoice is void");
      throw new BillingError(422, `Only ${fmt(invoice.balanceDuePaise)} is due on this invoice`);
    }
  }

  const status = paymentStatusOf(invoice.grandTotalPaise, invoice.amountPaidPaise);
  if (status !== invoice.paymentStatus) {
    await PlatformInvoice.updateOne({ _id: invoice._id }, { paymentStatus: status }, { session });
    invoice.paymentStatus = status;
  }
  if (status === "PAID") await subscriptions.applyFromInvoice(invoice, { paymentId: payment._id, actor: payment.recordedBy }, session);
  return invoice;
}

async function voidInvoice(id, reason, actor) {
  const invoice = await PlatformInvoice.findById(id);
  if (!invoice || invoice.documentType !== "INVOICE") throw new BillingError(404, "Invoice not found");
  if (invoice.status === "VOID") throw new BillingError(409, "The invoice is already void");
  if (invoice.amountPaidPaise > 0) throw new BillingError(409, "Money has been received on this invoice; refund it instead (that issues a credit note)");
  const done = await PlatformInvoice.findOneAndUpdate(
    { _id: id, status: "ISSUED", amountPaidPaise: 0 },
    { status: "VOID", balanceDuePaise: 0, voidedAt: new Date(), voidedBy: actor, voidReason: reason },
    { new: true }
  );
  if (!done) throw new BillingError(409, "The invoice changed; reload and try again");
  return done;
}

/**
 * Credit note for a processed refund, linked to the invoice it reduces.
 * Same GST share as the invoice, its own number series.
 */
async function issueCreditNote(invoice, refund, actor, session) {
  const settings = await getBillingSettings();
  const split = creditNoteSplit(invoice, refund.amountPaise);
  const number = await nextNumber(settings.invoicePrefix || "CSA", "CREDIT_NOTE", session);
  const rateBps = invoice.lines[0]?.taxRateBps || 0;
  const [note] = await PlatformInvoice.create(
    [
      {
        documentType: "CREDIT_NOTE",
        invoiceNo: number,
        merchantId: invoice.merchantId,
        invoiceType: invoice.invoiceType,
        source: "REFUND",
        status: "ISSUED",
        paymentStatus: "NOT_APPLICABLE",
        invoiceDate: istDate(),
        lines: [
          {
            kind: "CUSTOM",
            description: `Refund against invoice ${invoice.invoiceNo}: ${refund.reason}`,
            sac: invoice.lines[0]?.sac,
            qty: 1,
            unitPricePaise: split.taxablePaise,
            taxablePaise: split.taxablePaise,
            taxRateBps: rateBps,
            cgstPaise: split.cgstPaise,
            sgstPaise: split.sgstPaise,
            igstPaise: split.igstPaise,
            totalPaise: split.grandTotalPaise,
          },
        ],
        subtotalPaise: split.taxablePaise,
        taxablePaise: split.taxablePaise,
        cgstPaise: split.cgstPaise,
        sgstPaise: split.sgstPaise,
        igstPaise: split.igstPaise,
        taxTotalPaise: split.cgstPaise + split.sgstPaise + split.igstPaise,
        grandTotalPaise: split.grandTotalPaise,
        gstRegistered: invoice.gstRegistered,
        pricesIncludeGst: invoice.pricesIncludeGst,
        interState: invoice.interState,
        placeOfSupply: invoice.placeOfSupply,
        // Same parties as the original invoice
        supplierSnapshot: invoice.supplierSnapshot,
        customerSnapshot: invoice.customerSnapshot,
        originalInvoiceId: invoice._id,
        refundId: refund._id,
        reason: refund.reason,
        createdBy: actor,
      },
    ],
    { session }
  );
  await PlatformInvoice.updateOne({ _id: invoice._id }, { $inc: { creditedPaise: refund.amountPaise } }, { session });
  return note;
}

const isId = (id) => mongoose.isValidObjectId(id);

module.exports = { nextNumber, customerSnapshot, subscriptionLine, planLine, buildLines, issueInvoice, previewManual, createManual, applyPayment, voidInvoice, issueCreditNote, isId, INTERVAL_LABELS };
