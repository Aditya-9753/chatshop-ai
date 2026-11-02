const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const authService = require("./auth.service");
const { listPlans } = require("../billing/plans");
const revenue = require("../billing/revenue");
const { logEvent } = require("../billing/subscriptions");
const cache = require("../utils/cache");

const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_DAYS = 7;
const IMPERSONATION_TTL = "1h";

const daysLeft = (endDate, now) => Math.ceil((new Date(endDate).getTime() - now) / DAY_MS);

const row = (shop, now) => ({
  _id: shop._id,
  name: shop.name,
  email: shop.email,
  businessName: shop.businessInfo?.businessName,
  plan: shop.subscription?.plan || null,
  status: shop.subscription?.status,
  trial: Boolean(shop.subscription?.trial),
  endDate: shop.subscription?.endDate || null,
  daysLeft: shop.subscription?.endDate ? daysLeft(shop.subscription.endDate, now) : null,
});

/**
 * Tools only the Super Admin has: billing & renewals, and opening a shop's
 * dashboard as its owner.
 */
class SuperAdminService {
  // Revenue by plan, plans running out soon and plans that have ended.
  // Money is in rupees here; MRR counts paid plans only (as Billing → Overview).
  async billing() {
    const [plans, recurring] = await Promise.all([listPlans({ includeInactive: true }), revenue.recurring()]);
    const now = Date.now();
    const shops = await User.find({ role: "user" })
      .select("name email businessInfo.businessName subscription")
      .lean();

    const active = shops.filter((s) => s.subscription?.status === "active" && s.subscription?.plan);
    const lapsed = (s) => s.subscription?.endDate && new Date(s.subscription.endDate).getTime() < now;

    const paid = new Map(recurring.byPlan.map((p) => [p.plan, p]));
    const byPlan = plans.map((p) => ({
      plan: p.code,
      name: p.name,
      price: p.pricePaise / 100,
      interval: p.interval,
      shops: paid.get(p.code)?.shops || 0,
      trials: active.filter((s) => s.subscription.plan === p.code && s.subscription.trial).length,
      mrr: (paid.get(p.code)?.mrrPaise || 0) / 100,
    }));
    const mrr = recurring.mrrPaise / 100;

    const expiringSoon = active
      .filter((s) => s.subscription.endDate && !lapsed(s) && daysLeft(s.subscription.endDate, now) <= SOON_DAYS)
      .map((s) => row(s, now))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // Had a plan, but it is no longer running (or ran past its end date)
    const ended = shops
      .filter((s) => s.subscription?.plan && (s.subscription.status !== "active" || lapsed(s)))
      .map((s) => row(s, now))
      .sort((a, b) => new Date(b.endDate || 0) - new Date(a.endDate || 0));

    return {
      totals: {
        mrr,
        arr: mrr * 12,
        payingShops: recurring.paying,
        trials: active.filter((s) => s.subscription.trial).length,
        expiringSoon: expiringSoon.length,
        ended: ended.length,
      },
      byPlan,
      expiringSoon,
      ended,
      soonDays: SOON_DAYS,
    };
  }

  // Add days to a shop's plan (from today if it already ended) and turn it on
  async extendSubscription(shopId, days, actor) {
    const add = Number(days);
    if (!Number.isInteger(add) || add < 1 || add > 365) throw new Error("Pick between 1 and 365 days");

    const shop = await User.findById(shopId);
    if (!shop || shop.role === "admin") throw new Error("Shop not found");
    if (!shop.subscription?.plan) throw new Error("Give this shop a plan first (Shops → details)");

    const end = shop.subscription.endDate ? new Date(shop.subscription.endDate).getTime() : 0;
    shop.subscription.endDate = new Date(Math.max(end, Date.now()) + add * DAY_MS);
    shop.subscription.status = "active";
    await shop.save();
    await logEvent({ merchantId: shop._id, type: "EXTENDED", planCode: shop.subscription.plan, periodEnd: shop.subscription.endDate, actor, note: `+${add} days by Super Admin` });
    cache.clear();
    return row(shop.toObject(), Date.now());
  }

  // A short session for a shop's dashboard, opened by the Super Admin.
  // The token names the admin, so the server can tell and log it.
  async impersonate(shopId, admin) {
    const shop = await User.findById(shopId);
    if (!shop || shop.role === "admin") throw new Error("Shop not found");

    const token = jwt.sign({ id: shop._id, actingAdmin: admin._id }, process.env.JWT_SECRET, {
      expiresIn: IMPERSONATION_TTL,
    });
    return {
      token,
      user: { ...authService.toSessionUser(shop), actingAdmin: { name: admin.name, email: admin.email } },
    };
  }
}

module.exports = new SuperAdminService();
