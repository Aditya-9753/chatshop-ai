const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const authService = require("./auth.service");
const subscriptionService = require("./subscription.service");
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
  endDate: shop.subscription?.endDate || null,
  daysLeft: shop.subscription?.endDate ? daysLeft(shop.subscription.endDate, now) : null,
});

/**
 * Tools only the Super Admin has: billing & renewals, and opening a shop's
 * dashboard as its owner.
 */
class SuperAdminService {
  // Revenue by plan, plans running out soon and plans that have ended
  async billing() {
    const plans = subscriptionService.getPlans();
    const now = Date.now();
    const shops = await User.find({ role: "user" })
      .select("name email businessInfo.businessName subscription")
      .lean();

    // Same definition as the Overview MRR: active plans, one-time excluded
    const active = shops.filter((s) => s.subscription?.status === "active" && s.subscription?.plan);
    const lapsed = (s) => s.subscription?.endDate && new Date(s.subscription.endDate).getTime() < now;

    const byPlan = Object.entries(plans).map(([plan, info]) => {
      const count = active.filter((s) => s.subscription.plan === plan).length;
      return { plan, name: info.name, price: info.price, shops: count, mrr: plan === "one-time" ? 0 : count * info.price };
    });
    const mrr = byPlan.reduce((sum, p) => sum + p.mrr, 0);

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
        payingShops: active.length,
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
  async extendSubscription(shopId, days) {
    const add = Number(days);
    if (!Number.isInteger(add) || add < 1 || add > 365) throw new Error("Pick between 1 and 365 days");

    const shop = await User.findById(shopId);
    if (!shop || shop.role === "admin") throw new Error("Shop not found");
    if (!shop.subscription?.plan) throw new Error("Give this shop a plan first (Shops → details)");

    const end = shop.subscription.endDate ? new Date(shop.subscription.endDate).getTime() : 0;
    shop.subscription.endDate = new Date(Math.max(end, Date.now()) + add * DAY_MS);
    shop.subscription.status = "active";
    await shop.save();
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
