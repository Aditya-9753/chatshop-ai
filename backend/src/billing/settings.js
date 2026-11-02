const PlatformSettings = require("../models/PlatformSettings.model");
const { BillingError, stateFromGstin } = require("./domain");

const GST_RATES = [0, 5, 12, 18, 28];

async function settingsDoc() {
  return (await PlatformSettings.findOne({ key: "platform" })) || (await PlatformSettings.create({ key: "platform" }));
}

// Effective billing settings (the supplier on every platform invoice)
async function getBillingSettings() {
  const doc = await settingsDoc();
  const billing = doc.billing?.toObject ? doc.billing.toObject() : doc.billing || {};
  return {
    ...billing,
    legalName: billing.legalName || doc.platformName || "ChatShop AI",
    email: billing.email || doc.supportEmail || "",
    phone: billing.phone || doc.contactPhone || "",
    gstRegistered: Boolean(billing.gstin),
  };
}

const supplierSnapshot = (s) => ({
  name: s.legalName,
  legalName: s.legalName,
  gstin: s.gstin || undefined,
  address: s.address,
  stateCode: s.stateCode || undefined,
  email: s.email,
  phone: s.phone,
});

const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

const CHECKS = {
  legalName: (v) => (typeof v === "string" && v.trim().length <= 160 ? null : "Legal name is too long"),
  gstin: (v) => (v === "" || /^\d{2}[A-Z0-9]{13}$/i.test(v) ? null : "GSTIN must be 15 characters, starting with the 2-digit state code"),
  stateCode: (v) => (v === "" || /^\d{2}$/.test(v) ? null : "State code is 2 digits (e.g. 23)"),
  address: (v) => (typeof v === "string" && v.length <= 400 ? null : "Address is too long"),
  email: (v) => (v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Email isn't valid"),
  phone: (v) => (typeof v === "string" && v.length <= 20 ? null : "Phone is too long"),
  invoicePrefix: (v) => (/^[A-Z0-9]{2,8}$/i.test(v) ? null : "Invoice prefix is 2–8 letters or digits"),
  sac: (v) => (v === "" || /^\d{4,8}$/.test(v) ? null : "SAC code is 4–8 digits"),
  gstRatePct: (v) => (GST_RATES.includes(v) ? null : `GST rate must be one of ${GST_RATES.join(", ")}`),
  pricesIncludeGst: (v) => (typeof v === "boolean" ? null : "Must be true or false"),
  graceDays: (v) => (intIn(v, 0, 30) ? null : "Grace period is 0–30 days"),
  reminderDays: (v) => (intIn(v, 0, 30) ? null : "Reminder is 0–30 days before"),
  paymentTermsDays: (v) => (intIn(v, 0, 90) ? null : "Payment terms are 0–90 days"),
};

async function saveBillingSettings(changes = {}) {
  const errors = [];
  for (const [key, value] of Object.entries(changes)) {
    if (!CHECKS[key]) errors.push(`Unknown setting "${key}"`);
    else {
      const problem = CHECKS[key](typeof value === "string" ? value.trim() : value);
      if (problem) errors.push(problem);
    }
  }
  if (errors.length) throw new BillingError(422, errors[0]);

  const doc = await settingsDoc();
  const before = doc.billing.toObject();
  for (const [key, value] of Object.entries(changes)) doc.billing[key] = typeof value === "string" ? value.trim() : value;

  // The state code must match the GSTIN (its first two digits)
  const fromGstin = stateFromGstin(doc.billing.gstin);
  if (fromGstin) {
    if (changes.stateCode && changes.stateCode !== fromGstin) throw new BillingError(422, `State code must be ${fromGstin} to match the GSTIN`);
    doc.billing.stateCode = fromGstin;
  }
  await doc.save();
  return { before, after: doc.billing.toObject() };
}

module.exports = { getBillingSettings, saveBillingSettings, supplierSnapshot, GST_RATES };
