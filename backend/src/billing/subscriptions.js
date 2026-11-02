const User = require("../models/User.model");
const Product = require("../models/Product.model");
const cache = require("../utils/cache");
const sendEmail = require("../utils/sendEmail");
const { SubscriptionEvent } = require("./models");
const { currentPlan } = require("./plans");
const { getBillingSettings } = require("./settings");
const { BillingError, DAY_MS, istDate } = require("./domain");

const daysLeft = (end, now = Date.now()) => (end ? Math.ceil((new Date(end).getTime() - now) / DAY_MS) : null);

// A shop's plan as screens show it, grace period included
function describe(subscription = {}, graceDays = 0, now = Date.now()) {
  const end = subscription.endDate ? new Date(subscription.endDate).getTime() : null;
  const ended = end !== null && end < now;
  const inGrace = subscription.status === "active" && ended && !subscription.trial && !subscription.cancelAtPeriodEnd;
  return {
    plan: subscription.plan || null,
    status: subscription.status || "inactive",
    trial: Boolean(subscription.trial),
    interval: subscription.interval || null,
    pricePaise: subscription.pricePaise || 0,
    startDate: subscription.startDate || null,
    endDate: subscription.endDate || null,
    daysLeft: daysLeft(subscription.endDate, now),
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    inGrace,
    graceEndsAt: inGrace ? new Date(end + graceDays * DAY_MS) : null,
  };
}

async function logEvent(event, session) {
  if (event.dedupeKey && (await SubscriptionEvent.exists({ dedupeKey: event.dedupeKey }).session(session || null))) return null;
  const [row] = await SubscriptionEvent.create([event], { session });
  return row;
}

/**
 * Turn on (or extend) the plan an invoice paid for. Safe to run twice for the
 * same invoice: the period is fixed on the invoice line, so a second run
 * changes nothing.
 */
async function applyFromInvoice(invoice, { paymentId, actor } = {}, session) {
  const line = [...invoice.lines].filter((l) => l.kind === "SUBSCRIPTION" && l.planCode).sort((a, b) => new Date(b.periodEnd) - new Date(a.periodEnd))[0];
  if (!line) return null;

  // Already applied (a repeat of the same invoice)
  const dedupeKey = `apply:${invoice._id}`;
  if (await SubscriptionEvent.exists({ dedupeKey }).session(session || null)) return null;

  const merchant = await User.findById(invoice.merchantId).select("subscription").session(session || null);
  if (!merchant) return null;
  const sub = merchant.subscription || {};
  const periodStart = new Date(line.periodStart);
  const periodEnd = new Date(line.periodEnd);
  const running = sub.status === "active" && !sub.trial && sub.endDate && new Date(sub.endDate) > new Date();
  const samePlan = sub.plan === line.planCode;

  const type = !sub.plan || sub.trial || sub.status !== "active" ? "ACTIVATED" : samePlan ? "RENEWED" : "PLAN_CHANGED";
  const keepStart = samePlan && running;
  const endDate = samePlan && running && new Date(sub.endDate) > periodEnd ? new Date(sub.endDate) : periodEnd;

  await User.updateOne(
    { _id: merchant._id },
    {
      $set: {
        "subscription.plan": line.planCode,
        "subscription.status": "active",
        "subscription.trial": false,
        "subscription.interval": line.interval,
        "subscription.planVersion": line.planVersion,
        "subscription.pricePaise": Math.round(line.taxablePaise / (line.qty || 1)),
        "subscription.startDate": keepStart ? sub.startDate : periodStart,
        "subscription.endDate": endDate,
        "subscription.cancelAtPeriodEnd": false,
        "subscription.cancelledAt": null,
        "subscription.lastInvoiceId": invoice._id,
      },
    },
    { session }
  );
  await logEvent({ merchantId: merchant._id, type, planCode: line.planCode, periodStart, periodEnd: endDate, invoiceId: invoice._id, paymentId, actor, dedupeKey }, session);
  cache.clear();
  return { type, periodStart, periodEnd: endDate };
}

// Stop at the end of the paid period (access continues until then)
async function cancelAtPeriodEnd(userId, actor) {
  const user = await User.findById(userId).select("subscription");
  const sub = user?.subscription || {};
  if (sub.status !== "active" || !sub.plan) throw new BillingError(409, "There is no active plan to cancel");
  if (sub.interval === "ONE_TIME") throw new BillingError(409, "A one-time plan has nothing to renew or cancel");
  if (sub.cancelAtPeriodEnd) throw new BillingError(409, "The plan is already set to end");
  await User.updateOne({ _id: userId }, { "subscription.cancelAtPeriodEnd": true, "subscription.cancelledAt": new Date() });
  await logEvent({ merchantId: userId, type: "CANCEL_REQUESTED", planCode: sub.plan, periodEnd: sub.endDate, actor });
  cache.clear();
}

async function resume(userId, actor) {
  const user = await User.findById(userId).select("subscription");
  const sub = user?.subscription || {};
  if (sub.status !== "active" || !sub.cancelAtPeriodEnd) throw new BillingError(409, "The plan isn't set to end");
  await User.updateOne({ _id: userId }, { "subscription.cancelAtPeriodEnd": false, "subscription.cancelledAt": null });
  await logEvent({ merchantId: userId, type: "RESUMED", planCode: sub.plan, actor });
  cache.clear();
}

/**
 * Daily: plans set to end stop at their end date; other plans expire once
 * the grace period after the end date is over (trials have no grace); and
 * shops get an email a few days before their plan ends. Only the status
 * changes: a shop's data is never deleted because a payment didn't come.
 */
async function runExpiryJob(now = new Date()) {
  const settings = await getBillingSettings();
  const graceCutoff = new Date(now.getTime() - (settings.graceDays || 0) * DAY_MS);
  const summary = { cancelled: 0, expired: 0, reminded: 0 };

  const ending = await User.find({ role: "user", "subscription.status": "active", "subscription.endDate": { $lt: now }, "subscription.cancelAtPeriodEnd": true }).select("subscription");
  for (const u of ending) {
    const done = await User.updateOne({ _id: u._id, "subscription.status": "active" }, { "subscription.status": "cancelled" });
    if (done.modifiedCount) {
      summary.cancelled += 1;
      await logEvent({ merchantId: u._id, type: "CANCELLED", planCode: u.subscription.plan, periodEnd: u.subscription.endDate, note: "Ended at period end" });
    }
  }

  const lapsed = await User.find({
    role: "user",
    "subscription.status": "active",
    $or: [
      { "subscription.trial": true, "subscription.endDate": { $lt: now } },
      { "subscription.trial": { $ne: true }, "subscription.endDate": { $lt: graceCutoff } },
    ],
  }).select("subscription");
  for (const u of lapsed) {
    const done = await User.updateOne({ _id: u._id, "subscription.status": "active" }, { "subscription.status": "expired" });
    if (done.modifiedCount) {
      summary.expired += 1;
      await logEvent({ merchantId: u._id, type: "EXPIRED", planCode: u.subscription.plan, periodEnd: u.subscription.endDate, note: u.subscription.trial ? "Trial ended" : `Not renewed within ${settings.graceDays} grace days` });
    }
  }

  if (settings.reminderDays > 0) {
    const soon = await User.find({
      role: "user",
      "subscription.status": "active",
      "subscription.cancelAtPeriodEnd": { $ne: true },
      "subscription.interval": { $ne: "ONE_TIME" },
      "subscription.endDate": { $gte: now, $lte: new Date(now.getTime() + settings.reminderDays * DAY_MS) },
    }).select("name email subscription");
    for (const u of soon) {
      const dedupeKey = `reminder:${u._id}:${istDate(u.subscription.endDate)}`;
      if (await SubscriptionEvent.exists({ dedupeKey })) continue;
      const left = daysLeft(u.subscription.endDate, now.getTime());
      await sendEmail({
        to: u.email,
        subject: `Your ChatShop ${u.subscription.trial ? "trial" : "plan"} ends in ${left} day${left === 1 ? "" : "s"}`,
        text: `Hi ${u.name},\n\nYour ChatShop ${u.subscription.trial ? "free trial" : `${u.subscription.plan} plan`} ends on ${istDate(u.subscription.endDate)}. Renew from Settings → Billing to keep your inbox, orders and billing running.\n\nYour data stays safe either way.\n\n— ChatShop AI`,
      });
      await logEvent({ merchantId: u._id, type: "REMINDER_SENT", planCode: u.subscription.plan, periodEnd: u.subscription.endDate, dedupeKey });
      summary.reminded += 1;
    }
  }

  if (summary.cancelled || summary.expired) cache.clear();
  return summary;
}

// ---- Plan limits (null = unlimited) ----

const LIMIT_LABELS = { products: "products", staff: "staff accounts", invoicesPerMonth: "invoices a month" };

async function usageOf(ownerId, kind) {
  if (kind === "products") return Product.countDocuments({ userId: ownerId });
  if (kind === "staff") return User.countDocuments({ tenantId: ownerId, role: "staff" });
  if (kind === "invoicesPerMonth") {
    const { Invoice } = require("../emi/models/sales");
    const monthStart = `${istDate().slice(0, 7)}-01`;
    return Invoice.countDocuments({ tenantId: ownerId, date: { $gte: monthStart }, status: { $ne: "CANCELLED" } });
  }
  return 0;
}

// Throws when adding one more `kind` would go over the shop's plan
async function assertWithinLimit(ownerId, kind) {
  const owner = await User.findById(ownerId).select("subscription.plan");
  const plan = owner?.subscription?.plan ? await currentPlan(owner.subscription.plan) : null;
  const limit = plan?.limits?.[kind];
  if (limit === null || limit === undefined) return;
  const used = await usageOf(ownerId, kind);
  if (used >= limit) {
    throw new BillingError(403, `Your ${plan.name} plan allows ${limit} ${LIMIT_LABELS[kind]}. Upgrade your plan in Settings → Billing to add more.`, "PLAN_LIMIT");
  }
}

module.exports = { describe, applyFromInvoice, cancelAtPeriodEnd, resume, runExpiryJob, assertWithinLimit, usageOf, logEvent, daysLeft };
