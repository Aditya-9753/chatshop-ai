const { Plan } = require("./models");
const { BillingError } = require("./domain");

// The plans ChatShop started with (rupee prices from the old price list)
const DEFAULT_PLANS = [
  {
    code: "starter",
    name: "Starter",
    pricePaise: 49900,
    compareAtPaise: 99900,
    interval: "MONTHLY",
    sortOrder: 1,
    description: "For a shop getting started on WhatsApp.",
    features: ["One inbox for WhatsApp, Instagram & Facebook", "Customers and product catalog", "Orders and printable invoices", "Email support"],
  },
  {
    code: "business",
    name: "Business",
    pricePaise: 124900,
    compareAtPaise: 249900,
    interval: "MONTHLY",
    sortOrder: 2,
    description: "For shops selling every day in chat.",
    features: ["Everything in Starter", "Broadcast messages", "Analytics with period comparison", "Quick replies and internal notes", "AI replies when they launch"],
  },
  {
    code: "premium",
    name: "Premium",
    pricePaise: 400000,
    compareAtPaise: 800000,
    interval: "MONTHLY",
    sortOrder: 3,
    description: "For growing teams with high volume.",
    features: ["Everything in Business", "Low-stock alerts on the dashboard", "Priority support", "Help setting up the WhatsApp Cloud API"],
  },
  {
    code: "one-time",
    name: "Done for you",
    pricePaise: 1000000,
    compareAtPaise: 2000000,
    interval: "ONE_TIME",
    sortOrder: 4,
    description: "We set everything up for you. Paid once, no renewal.",
    features: ["Channels connected and tested", "Your catalog imported", "Training for your team", "30 days of support"],
  },
];

// First use on a fresh database: create the default plans
async function ensureDefaultPlans() {
  if ((await Plan.estimatedDocumentCount()) > 0) return;
  try {
    await Plan.insertMany(DEFAULT_PLANS.map((p) => ({ ...p, version: 1, isCurrent: true })), { ordered: false });
  } catch (error) {
    if (error.code !== 11000 && !error.writeErrors) throw error; // a parallel request seeded them
  }
}

const publicPlan = (p) => ({
  code: p.code,
  version: p.version,
  name: p.name,
  description: p.description,
  pricePaise: p.pricePaise,
  compareAtPaise: p.compareAtPaise,
  interval: p.interval,
  features: p.features,
  limits: p.limits,
  isActive: p.isActive,
  sortOrder: p.sortOrder,
});

async function listPlans({ includeInactive = false } = {}) {
  await ensureDefaultPlans();
  const filter = { isCurrent: true, ...(includeInactive ? {} : { isActive: true }) };
  return Plan.find(filter).sort({ sortOrder: 1, pricePaise: 1 }).lean();
}

async function currentPlan(code) {
  await ensureDefaultPlans();
  return Plan.findOne({ code: String(code || "").toLowerCase(), isCurrent: true }).lean();
}

async function planHistory(code) {
  return Plan.find({ code }).sort({ version: -1 }).lean();
}

async function createPlan(data, actor) {
  await ensureDefaultPlans();
  if (await Plan.exists({ code: data.code })) throw new BillingError(409, `A plan with code "${data.code}" already exists`);
  return Plan.create({ ...data, version: 1, isCurrent: true, createdBy: actor });
}

// What a shop pays or gets: changing any of these makes a new version
const VERSIONED = ["name", "description", "pricePaise", "compareAtPaise", "interval", "features", "limits"];

/**
 * Edit a plan. Price, interval, limits, features or name start a new version
 * (old invoices keep their snapshot; shops already on the plan keep what they
 * paid until they renew). Showing/hiding and order change in place.
 */
async function updatePlan(code, changes, actor) {
  const current = await Plan.findOne({ code, isCurrent: true });
  if (!current) throw new BillingError(404, "Plan not found");

  const commercial = VERSIONED.filter((k) => changes[k] !== undefined && JSON.stringify(changes[k]) !== JSON.stringify(current.toObject()[k]));
  const inPlace = {};
  for (const k of ["isActive", "sortOrder"]) if (changes[k] !== undefined) inPlace[k] = changes[k];

  if (!commercial.length) {
    if (Object.keys(inPlace).length) await Plan.updateOne({ _id: current._id }, inPlace);
    return Plan.findById(current._id).lean();
  }

  const base = current.toObject();
  delete base._id;
  delete base.createdAt;
  delete base.updatedAt;
  const next = { ...base, ...Object.fromEntries(VERSIONED.filter((k) => changes[k] !== undefined).map((k) => [k, changes[k]])), ...inPlace, version: current.version + 1, isCurrent: true, createdBy: actor };

  // Only one current version per code: retire the old one, then add the new
  await Plan.updateOne({ _id: current._id }, { isCurrent: false });
  try {
    return (await Plan.create(next)).toObject();
  } catch (error) {
    await Plan.updateOne({ _id: current._id }, { isCurrent: true });
    throw error;
  }
}

module.exports = { DEFAULT_PLANS, ensureDefaultPlans, listPlans, currentPlan, planHistory, createPlan, updatePlan, publicPlan };
