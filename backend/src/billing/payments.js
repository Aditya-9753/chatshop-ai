const crypto = require("crypto");
const User = require("../models/User.model");
const { withTxn } = require("../emi/utils/helpers");
const { fmt } = require("../emi/domain/money");
const { PlatformInvoice, PlatformPayment, PaymentEvent, PlatformRefund } = require("./models");
const { currentPlan } = require("./plans");
const { getBillingSettings } = require("./settings");
const invoices = require("./invoices");
const subscriptions = require("./subscriptions");
const gateway = require("./gateway");
const { BillingError, computeInvoice, purchasePeriod, istDate } = require("./domain");

// PAY-261102-3F9A1C, REF-…: readable, unique (also enforced by an index)
const newRef = (prefix) => `${prefix}-${istDate().slice(2).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

const history = (status, source, note) => ({ status, at: new Date(), source, note });

const prefill = (merchant) => ({ name: merchant.businessInfo?.businessName || merchant.name, email: merchant.email, contact: merchant.phone });

// What the browser needs to open the gateway's checkout for a payment
function checkoutPayload(payment, merchant, extra = {}) {
  return {
    paymentRef: payment.paymentRef,
    status: payment.status,
    purpose: payment.purpose,
    amountPaise: payment.amountPaise,
    currency: payment.currency,
    orderId: payment.gatewayOrderId,
    gateway: gateway.publicConfig(),
    prefill: prefill(merchant),
    plan: payment.plan?.code ? payment.plan : undefined,
    ...extra,
  };
}

/**
 * Start paying for a plan: fix the plan version, the price with GST and the
 * period, then open a gateway order. Nothing changes for the shop until the
 * gateway confirms the money (webhook or a verified checkout).
 */
async function startCheckout(merchant, planCode, idempotencyKey) {
  if (idempotencyKey) {
    const existing = await PlatformPayment.findOne({ merchantId: merchant._id, idempotencyKey });
    if (existing) return checkoutPayload(existing, merchant, { duplicate: true });
  }
  const plan = await currentPlan(planCode);
  if (!plan || !plan.isActive) throw new BillingError(404, "This plan isn't available");

  const settings = await getBillingSettings();
  const customer = await invoices.customerSnapshot(merchant._id);
  const tax = { gstRegistered: settings.gstRegistered, gstRatePct: settings.gstRatePct, pricesIncludeGst: settings.pricesIncludeGst };
  const totals = computeInvoice([{ kind: "SUBSCRIPTION", description: plan.name, qty: 1, unitPricePaise: plan.pricePaise }], { ...tax, supplierState: settings.stateCode, customerState: customer.stateCode });
  if (totals.grandTotalPaise < 100) throw new BillingError(422, "This plan is free; ask the Super Admin to turn it on");

  const paymentRef = newRef("PAY");
  const order = await gateway.createOrder({ amountPaise: totals.grandTotalPaise, receipt: paymentRef, notes: { paymentRef, merchantId: String(merchant._id), planCode: plan.code } });
  const period = purchasePeriod(merchant.subscription || {}, plan);

  try {
    const payment = await PlatformPayment.create({
      paymentRef,
      merchantId: merchant._id,
      purpose: "SUBSCRIPTION_CHECKOUT",
      plan: { code: plan.code, version: plan.version, name: plan.name, interval: plan.interval, pricePaise: plan.pricePaise, tax },
      gateway: order.gateway,
      gatewayOrderId: order.id,
      amountPaise: totals.grandTotalPaise,
      history: [history("CREATED", "checkout")],
      idempotencyKey: idempotencyKey || undefined,
    });
    return checkoutPayload(payment, merchant, {
      breakdown: { taxablePaise: totals.taxablePaise, taxPaise: totals.taxTotalPaise, totalPaise: totals.grandTotalPaise, gstRatePct: tax.gstRegistered ? tax.gstRatePct : 0 },
      period: { start: period.start, end: period.end, kind: period.kind },
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const existing = await PlatformPayment.findOne({ merchantId: merchant._id, idempotencyKey });
      if (existing) return checkoutPayload(existing, merchant, { duplicate: true });
    }
    throw error;
  }
}

// Pay what is still due on an invoice (one the Super Admin issued)
async function startInvoicePayment(merchant, invoiceId, idempotencyKey) {
  if (idempotencyKey) {
    const existing = await PlatformPayment.findOne({ merchantId: merchant._id, idempotencyKey });
    if (existing) return checkoutPayload(existing, merchant, { duplicate: true });
  }
  if (!invoices.isId(invoiceId)) throw new BillingError(400, "Invalid invoice id");
  const invoice = await PlatformInvoice.findOne({ _id: invoiceId, merchantId: merchant._id, documentType: "INVOICE" });
  if (!invoice) throw new BillingError(404, "Invoice not found");
  if (invoice.status !== "ISSUED") throw new BillingError(409, "This invoice is void");
  if (invoice.balanceDuePaise <= 0) throw new BillingError(409, "Nothing is due on this invoice");

  const paymentRef = newRef("PAY");
  const order = await gateway.createOrder({ amountPaise: invoice.balanceDuePaise, receipt: paymentRef, notes: { paymentRef, merchantId: String(merchant._id), invoiceNo: invoice.invoiceNo } });
  const payment = await PlatformPayment.create({
    paymentRef,
    merchantId: merchant._id,
    purpose: "INVOICE_PAYMENT",
    invoiceId: invoice._id,
    gateway: order.gateway,
    gatewayOrderId: order.id,
    amountPaise: invoice.balanceDuePaise,
    history: [history("CREATED", "invoice")],
    idempotencyKey: idempotencyKey || undefined,
  });
  return checkoutPayload(payment, merchant, { invoiceNo: invoice.invoiceNo });
}

/**
 * After a capture: the checkout's invoice and plan, or the invoice payment
 * counted. Every step checks what is already done, so a retry (or the
 * reconciliation "Repair" button) finishes a half-done capture safely.
 */
async function finishCapture(paymentId) {
  const run = () =>
    withTxn(async (session) => {
      const s = session || null;
      const payment = await PlatformPayment.findById(paymentId).session(s);
      if (!payment || payment.status !== "CAPTURED") return payment;

      if (payment.purpose === "INVOICE_PAYMENT") {
        await invoices.applyPayment(payment.invoiceId, payment, session);
        return payment;
      }

      let invoice = await PlatformInvoice.findOne({ paymentId: payment._id, documentType: "INVOICE" }).session(s);
      if (!invoice) {
        const merchant = await User.findById(payment.merchantId).select("subscription").session(s);
        const plan = payment.plan;
        const period = purchasePeriod(merchant?.subscription || {}, plan, payment.capturedAt || new Date());
        const settings = await getBillingSettings();
        // The plan version paid for, even if the plan changed since
        const line = invoices.planLine(plan, { start: period.start, end: period.end, sac: settings.sac || undefined });
        invoice = await invoices.issueInvoice({ merchantId: payment.merchantId, lines: [line], source: "CHECKOUT", payment, tax: plan.tax, dueDate: istDate() }, session);
      }
      if (!payment.invoiceId) await PlatformPayment.updateOne({ _id: payment._id }, { invoiceId: invoice._id }, { session });
      await subscriptions.applyFromInvoice(invoice, { paymentId: payment._id }, session);
      return payment;
    });

  try {
    return await run();
  } catch (error) {
    // Two deliveries raced to create the same invoice: the other one won
    if (error.code === 11000) return run();
    throw error;
  }
}

/**
 * The gateway says money came in for one of our orders. Counts it exactly
 * once; an amount we didn't ask for is held for review instead.
 */
async function capture(payment, { gatewayPaymentId, amountPaise, currency = "INR", method, source }) {
  if (amountPaise !== payment.amountPaise || currency !== payment.currency) {
    const reason = `Gateway reported ${fmt(amountPaise)} ${currency}; expected ${fmt(payment.amountPaise)} ${payment.currency}`;
    await PlatformPayment.updateOne(
      { _id: payment._id, status: { $in: ["CREATED", "FAILED"] } },
      { status: "REVIEW", reviewReason: reason, gatewayPaymentId, method, $push: { history: history("REVIEW", source, reason) } }
    );
    return { status: "REVIEW", reason };
  }

  const captured = await PlatformPayment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ["CREATED", "FAILED"] } },
    { status: "CAPTURED", gatewayPaymentId, method, capturedAt: new Date(), failureReason: null, $push: { history: history("CAPTURED", source) } },
    { new: true }
  );
  if (!captured) {
    const current = await PlatformPayment.findById(payment._id);
    // A second, different payment for an order that is already paid: keep
    // it on record for a refund rather than lose it
    if (current.status === "CAPTURED" && current.gatewayPaymentId && current.gatewayPaymentId !== gatewayPaymentId) {
      const exists = await PlatformPayment.exists({ gateway: current.gateway, gatewayPaymentId });
      if (!exists) {
        await PlatformPayment.create({
          paymentRef: newRef("PAY"),
          merchantId: current.merchantId,
          purpose: current.purpose,
          invoiceId: current.invoiceId,
          plan: current.plan,
          gateway: current.gateway,
          gatewayOrderId: current.gatewayOrderId,
          gatewayPaymentId,
          method,
          amountPaise,
          status: "REVIEW",
          reviewReason: `Second payment for order ${current.gatewayOrderId}, already paid by ${current.gatewayPaymentId}; refund it`,
          history: [history("REVIEW", source, "Duplicate payment for a paid order")],
        });
      }
      return { status: "REVIEW", duplicateOrderPayment: true };
    }
    if (current.status === "CAPTURED") await finishCapture(current._id); // finish anything left half done
    return { status: current.status, alreadyProcessed: true };
  }

  await finishCapture(captured._id);
  return { status: "CAPTURED", paymentRef: captured.paymentRef };
}

async function markFailed(payment, reason, source) {
  const done = await PlatformPayment.updateOne(
    { _id: payment._id, status: "CREATED" },
    { status: "FAILED", failureReason: reason || "Payment failed", $push: { history: history("FAILED", source, reason) } }
  );
  return { status: done.modifiedCount ? "FAILED" : "UNCHANGED" };
}

// ---- Refunds ----

async function finalizeRefund(refundId, gatewayRefundId, actor) {
  return withTxn(async (session) => {
    const refund = await PlatformRefund.findOneAndUpdate(
      { _id: refundId, status: "PENDING" },
      { status: "PROCESSED", processedAt: new Date(), ...(gatewayRefundId && { gatewayRefundId }) },
      { new: true, session }
    );
    if (!refund) return PlatformRefund.findById(refundId).session(session || null);
    await PlatformPayment.updateOne({ _id: refund.paymentId }, { $inc: { refundedPaise: refund.amountPaise }, $push: { history: history("REFUNDED", "refund", `${fmt(refund.amountPaise)} (${refund.refundRef})`) } }, { session });
    if (refund.invoiceId) {
      const invoice = await PlatformInvoice.findById(refund.invoiceId).session(session || null);
      if (invoice) {
        const note = await invoices.issueCreditNote(invoice, refund, actor || refund.requestedBy, session);
        await PlatformRefund.updateOne({ _id: refund._id }, { creditNoteId: note._id }, { session });
        refund.creditNoteId = note._id;
      }
    }
    return refund;
  });
}

async function failRefund(refundId, reason) {
  const refund = await PlatformRefund.findOneAndUpdate({ _id: refundId, status: "PENDING" }, { status: "FAILED", failureReason: reason }, { new: true });
  if (refund) await PlatformPayment.updateOne({ _id: refund.paymentId }, { $inc: { refundReservedPaise: -refund.amountPaise } });
  return refund;
}

/**
 * Refund (part of) a captured payment. The amount is reserved first so two
 * refunds at once can't exceed what was paid. Gateway refunds stay PENDING
 * until the gateway confirms; money recorded by hand is refunded by hand, so
 * it is PROCESSED straight away. A processed refund issues a credit note.
 */
async function refundPayment(paymentId, { amountPaise, reason }, actor, idempotencyKey) {
  if (idempotencyKey) {
    const existing = await PlatformRefund.findOne({ idempotencyKey });
    if (existing) return existing;
  }
  if (!invoices.isId(paymentId)) throw new BillingError(400, "Invalid payment id");
  const payment = await PlatformPayment.findById(paymentId);
  if (!payment) throw new BillingError(404, "Payment not found");
  if (payment.status !== "CAPTURED" && payment.status !== "REVIEW") throw new BillingError(409, `A ${payment.status.toLowerCase()} payment can't be refunded`);
  if (payment.status === "REVIEW" && !payment.gatewayPaymentId) throw new BillingError(409, "Nothing was received on this payment");

  const reserved = await PlatformPayment.findOneAndUpdate(
    { _id: payment._id, status: payment.status, $expr: { $lte: [{ $add: ["$refundReservedPaise", amountPaise] }, "$amountPaise"] } },
    { $inc: { refundReservedPaise: amountPaise } },
    { new: true }
  );
  if (!reserved) {
    const left = payment.amountPaise - payment.refundReservedPaise;
    throw new BillingError(422, `Refund is more than the refundable balance (${fmt(Math.max(0, left))})`);
  }

  let refund;
  try {
    refund = await PlatformRefund.create({
      refundRef: newRef("REF"),
      paymentId: payment._id,
      invoiceId: payment.invoiceId || undefined,
      merchantId: payment.merchantId,
      amountPaise,
      reason,
      gateway: payment.gateway,
      requestedBy: actor,
      idempotencyKey: idempotencyKey || undefined,
    });
  } catch (error) {
    await PlatformPayment.updateOne({ _id: payment._id }, { $inc: { refundReservedPaise: -amountPaise } });
    if (error.code === 11000 && idempotencyKey) return PlatformRefund.findOne({ idempotencyKey });
    throw error;
  }

  if (payment.gateway === "MANUAL") return finalizeRefund(refund._id, null, actor);

  try {
    const result = await gateway.refund({ gateway: payment.gateway, gatewayPaymentId: payment.gatewayPaymentId, amountPaise, refundRef: refund.refundRef });
    await PlatformRefund.updateOne({ _id: refund._id }, { gatewayRefundId: result.id });
    if (result.status === "processed") return finalizeRefund(refund._id, result.id, actor);
    if (result.status === "failed") return failRefund(refund._id, "The gateway refused the refund");
    return PlatformRefund.findById(refund._id);
  } catch (error) {
    await failRefund(refund._id, error.message);
    throw error;
  }
}

// ---- Gateway events (webhook, and the test gateway) ----

const entityOf = (event, kind) => event?.payload?.[kind]?.entity || null;

async function handleEvent(type, event, source) {
  if (type === "payment.captured" || type === "order.paid") {
    const p = entityOf(event, "payment");
    if (!p?.order_id) return { ignored: "no payment in event" };
    const payment = await PlatformPayment.findOne({ gatewayOrderId: p.order_id });
    if (!payment) return { ignored: "not a ChatShop plan payment" };
    return capture(payment, { gatewayPaymentId: p.id, amountPaise: p.amount, currency: p.currency, method: p.method, source });
  }
  if (type === "payment.failed") {
    const p = entityOf(event, "payment");
    const payment = p?.order_id && (await PlatformPayment.findOne({ gatewayOrderId: p.order_id }));
    if (!payment) return { ignored: "not a ChatShop plan payment" };
    return markFailed(payment, p.error_description || p.error_reason, source);
  }
  if (type === "refund.processed" || type === "refund.failed") {
    const r = entityOf(event, "refund");
    if (!r) return { ignored: "no refund in event" };
    const refund = await PlatformRefund.findOne({ $or: [{ gatewayRefundId: r.id }, ...(r.notes?.refundRef ? [{ refundRef: r.notes.refundRef }] : [])] });
    if (!refund) return { ignored: "not a ChatShop refund" };
    if (type === "refund.processed") return { status: (await finalizeRefund(refund._id, r.id))?.status };
    return { status: (await failRefund(refund._id, r.error_description || "Refund failed at the gateway"))?.status || refund.status };
  }
  return { ignored: `event ${type} not used` };
}

/**
 * Process one gateway event exactly once (by gateway + event id). A failure
 * is recorded and rethrown, so the gateway retries; a retry of an event that
 * already went through is answered without doing anything.
 */
async function processGatewayEvent(event, { gateway: kind, eventId, signatureVerified }) {
  if (!eventId) throw new BillingError(400, "Missing event id");
  const p = entityOf(event, "payment");
  const r = entityOf(event, "refund");
  const record = () =>
    PaymentEvent.findOneAndUpdate(
      { gateway: kind, eventId },
      {
        $setOnInsert: { type: event?.event, receivedAt: new Date(), summary: { orderId: p?.order_id, paymentId: p?.id || r?.payment_id, refundId: r?.id, amount: (p || r)?.amount, status: (p || r)?.status } },
        $set: { signatureVerified },
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true }
    );
  // Two deliveries of one event at the same moment: the second upsert loses the insert race
  const row = await record().catch((error) => (error.code === 11000 ? record() : Promise.reject(error)));
  if (row.processedAt) return { duplicate: true, result: row.result };

  try {
    const result = await handleEvent(event?.event, event, kind === "MOCK" ? "test gateway" : "webhook");
    await PaymentEvent.updateOne({ _id: row._id }, { processedAt: new Date(), result, error: null });
    return result;
  } catch (error) {
    await PaymentEvent.updateOne({ _id: row._id }, { error: error.message });
    throw error;
  }
}

// Test gateway: the shop presses "Succeed" or "Fail" instead of paying
async function mockPay(merchant, paymentRef, outcome) {
  if (gateway.mode() !== "MOCK") throw new BillingError(404, "The test gateway is off");
  const payment = await PlatformPayment.findOne({ paymentRef, merchantId: merchant._id });
  if (!payment) throw new BillingError(404, "Payment not found");
  if (payment.gateway !== "MOCK") throw new BillingError(409, "This is a real gateway payment");
  const success = outcome === "success";
  const event = {
    event: success ? "payment.captured" : "payment.failed",
    payload: {
      payment: {
        entity: {
          id: gateway.randomId("pay_mock"),
          order_id: payment.gatewayOrderId,
          amount: payment.amountPaise,
          currency: payment.currency,
          status: success ? "captured" : "failed",
          method: "upi",
          ...(success ? {} : { error_description: "Test payment failed" }),
        },
      },
    },
  };
  await processGatewayEvent(event, { gateway: "MOCK", eventId: gateway.randomId("evt_mock"), signatureVerified: true });
  return paymentView(merchant._id, paymentRef);
}

/**
 * The browser came back from Razorpay Checkout. Its signature proves the
 * ids came from Razorpay, and the payment is then fetched from Razorpay
 * itself; only a captured payment counts. Otherwise the screen shows
 * "processing" and the webhook finishes the job.
 */
async function verifyCheckout(merchant, { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }) {
  const payment = await PlatformPayment.findOne({ merchantId: merchant._id, gatewayOrderId: orderId });
  if (!payment) throw new BillingError(404, "Payment not found");
  if (payment.status === "CAPTURED") return paymentView(merchant._id, payment.paymentRef);
  if (!gateway.verifyCheckoutSignature(orderId, paymentId, signature)) throw new BillingError(400, "Payment signature didn't match; nothing was changed");

  let remote;
  try {
    remote = await gateway.fetchPayment(paymentId);
  } catch {
    return { ...(await paymentView(merchant._id, payment.paymentRef)), processing: true };
  }
  if (remote.order_id !== orderId) throw new BillingError(400, "Payment doesn't belong to this order");
  if (remote.status === "captured") await capture(payment, { gatewayPaymentId: remote.id, amountPaise: remote.amount, currency: remote.currency, method: remote.method, source: "checkout return" });
  else if (remote.status === "failed") await markFailed(payment, remote.error_description, "checkout return");
  return { ...(await paymentView(merchant._id, payment.paymentRef)), processing: remote.status === "authorized" || remote.status === "created" };
}

// A payment as the shop sees it (status page polls this)
async function paymentView(merchantId, paymentRef) {
  const payment = await PlatformPayment.findOne({ paymentRef, merchantId }).lean();
  if (!payment) throw new BillingError(404, "Payment not found");
  const invoice = payment.invoiceId ? await PlatformInvoice.findById(payment.invoiceId).select("invoiceNo grandTotalPaise paymentStatus").lean() : null;
  const merchant = await User.findById(merchantId).select("subscription").lean();
  const settings = await getBillingSettings();
  return {
    paymentRef: payment.paymentRef,
    status: payment.status,
    amountPaise: payment.amountPaise,
    failureReason: payment.failureReason,
    invoice,
    subscription: subscriptions.describe(merchant?.subscription, settings.graceDays),
  };
}

// Money received outside the gateway (bank transfer, cheque, cash), recorded by the Super Admin
async function recordManualPayment(invoiceId, { method, amountPaise, reference, receivedOn, note }, actor, idempotencyKey) {
  if (!invoices.isId(invoiceId)) throw new BillingError(400, "Invalid invoice id");
  const invoice = await PlatformInvoice.findOne({ _id: invoiceId, documentType: "INVOICE" });
  if (!invoice) throw new BillingError(404, "Invoice not found");
  if (idempotencyKey) {
    const existing = await PlatformPayment.findOne({ merchantId: invoice.merchantId, idempotencyKey });
    if (existing) return existing;
  }
  if (invoice.status !== "ISSUED") throw new BillingError(409, "This invoice is void");
  if (amountPaise > invoice.balanceDuePaise) throw new BillingError(422, `Only ${fmt(invoice.balanceDuePaise)} is due on this invoice`);

  const payment = await PlatformPayment.create({
    paymentRef: newRef("PAY"),
    merchantId: invoice.merchantId,
    purpose: "INVOICE_PAYMENT",
    invoiceId: invoice._id,
    gateway: "MANUAL",
    method,
    amountPaise,
    status: "CAPTURED",
    capturedAt: new Date(),
    reference,
    receivedOn: receivedOn || istDate(),
    note,
    recordedBy: actor,
    history: [history("CAPTURED", "recorded by Super Admin", reference)],
    idempotencyKey: idempotencyKey || undefined,
  });
  try {
    await finishCapture(payment._id);
  } catch (error) {
    // The invoice could not take it (e.g. paid meanwhile): don't keep a stray receipt
    await PlatformPayment.deleteOne({ _id: payment._id, status: "CAPTURED" });
    throw error;
  }
  return PlatformPayment.findById(payment._id);
}

/**
 * Reconciliation action for one payment: finish a capture that stopped half
 * way, or ask Razorpay what happened to an order that never got a webhook.
 */
async function syncPayment(paymentId) {
  if (!invoices.isId(paymentId)) throw new BillingError(400, "Invalid payment id");
  const payment = await PlatformPayment.findById(paymentId);
  if (!payment) throw new BillingError(404, "Payment not found");
  await PlatformPayment.updateOne({ _id: payment._id }, { lastSyncedAt: new Date() });

  if (payment.status === "CAPTURED") {
    await finishCapture(payment._id);
    return { action: "repaired", payment: await PlatformPayment.findById(payment._id) };
  }
  if (payment.status === "REVIEW") return { action: "needs-review", payment };
  if (payment.gateway !== "RAZORPAY") return { action: "nothing-to-check", payment };

  const items = await gateway.fetchOrderPayments(payment.gatewayOrderId);
  const captured = items.find((i) => i.status === "captured");
  if (captured) {
    await capture(payment, { gatewayPaymentId: captured.id, amountPaise: captured.amount, currency: captured.currency, method: captured.method, source: "reconciliation" });
    return { action: "captured", payment: await PlatformPayment.findById(payment._id) };
  }
  const failed = items.find((i) => i.status === "failed");
  if (failed && payment.status === "CREATED") await markFailed(payment, failed.error_description, "reconciliation");
  return { action: items.length ? "no-capture-yet" : "no-attempt-at-gateway", payment: await PlatformPayment.findById(payment._id) };
}

module.exports = {
  newRef,
  startCheckout,
  startInvoicePayment,
  finishCapture,
  capture,
  markFailed,
  refundPayment,
  finalizeRefund,
  failRefund,
  processGatewayEvent,
  mockPay,
  verifyCheckout,
  paymentView,
  recordManualPayment,
  syncPayment,
};
