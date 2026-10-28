// Platform defaults for the EMI module. Effective settings are these, then
// the PLATFORM override (Super Admin), then TENANT, then STORE (later wins).
// Money values are paise.
const DEFAULT_SETTINGS = {
  gst: {
    interestMode: "TAXABLE_INCLUSIVE", // TAXABLE_INCLUSIVE | TAXABLE_EXCLUSIVE | EXEMPT
    interestTiming: "PER_INSTALLMENT", // PER_INSTALLMENT | UPFRONT
  },
  cashLimitPerTxn: 20000000, // cash must stay below ₹2,00,000 per sale (Income Tax 269ST)
  kycRequiredAbove: 20000000, // ₹2,00,000
  emi: {
    minRatePct: 0,
    maxRatePct: 24,
    defaultRatePct: 18,
    allowedTenures: [3, 6, 9, 12],
    maxPrincipal: 150000000, // ₹15,00,000
    approvalAbove: 50000000, // ₹5,00,000
    minDownPaymentPct: 0,
    foreclosureChargePct: 2,
  },
  lateFee: {
    graceDays: 3,
    type: "FLAT", // FLAT | PERCENT
    flat: 50000, // ₹500
    pct: 2,
    cap: 100000, // ₹1,000
  },
  mdrPct: { credit: 1.5, debit: 0.9, upi: 0, cash: 0, bank: 0 },
  reminders: { enabled: true, daysBefore: 3, channel: "WHATSAPP" },
};

// Keys a shop (tenant or store override) may change. Everything else is
// Super Admin only.
const TENANT_EDITABLE = [
  "emi.defaultRatePct",
  "emi.allowedTenures",
  "emi.maxPrincipal",
  "emi.approvalAbove",
  "emi.minDownPaymentPct",
  "lateFee.graceDays",
  "lateFee.type",
  "lateFee.flat",
  "lateFee.pct",
  "lateFee.cap",
  "mdrPct.credit",
  "mdrPct.debit",
  "mdrPct.upi",
  "mdrPct.cash",
  "mdrPct.bank",
  "reminders.enabled",
  "reminders.daysBefore",
  "reminders.channel",
];

const isInt = (v) => Number.isInteger(v);
const between = (v, lo, hi) => typeof v === "number" && v >= lo && v <= hi;

// Range checks. Each returns an error message or null. `platform` is the
// effective platform-level settings, so a shop stays inside the Super Admin's range.
// `next` is the effective settings after the change (for checks across keys).
const LIMITS = {
  "gst.interestMode": (v) => (["TAXABLE_INCLUSIVE", "TAXABLE_EXCLUSIVE", "EXEMPT"].includes(v) ? null : "GST mode galat hai"),
  "gst.interestTiming": (v) => (["PER_INSTALLMENT", "UPFRONT"].includes(v) ? null : "GST timing galat hai"),
  cashLimitPerTxn: (v) => (isInt(v) && v > 0 ? null : "Cash limit paise me positive hona chahiye"),
  kycRequiredAbove: (v) => (isInt(v) && v >= 0 ? null : "KYC limit galat hai"),
  "emi.minRatePct": (v) => (between(v, 0, 60) ? null : "Min rate 0–60% ke beech"),
  "emi.maxRatePct": (v, platform, next) => (between(v, next.emi.minRatePct, 60) ? null : "Max rate, min rate se kam nahi ho sakta (60% tak)"),
  "emi.defaultRatePct": (v, platform) =>
    between(v, platform.emi.minRatePct, platform.emi.maxRatePct)
      ? null
      : `Default rate ${platform.emi.minRatePct}%–${platform.emi.maxRatePct}% ke beech hona chahiye`,
  "emi.allowedTenures": (v, platform, next, level) =>
    Array.isArray(v) && v.length > 0 && v.every((t) => isInt(t) && t >= 1 && t <= 60) &&
    (level === "PLATFORM" || v.every((t) => platform.emi.allowedTenures.includes(t)))
      ? null
      : `Tenure sirf in me se: ${platform.emi.allowedTenures.join(", ")}`,
  "emi.maxPrincipal": (v, platform, next, level) =>
    isInt(v) && v > 0 && (level === "PLATFORM" || v <= platform.emi.maxPrincipal) ? null : "Max EMI amount platform limit se zyada nahi ho sakta",
  "emi.approvalAbove": (v) => (isInt(v) && v >= 0 ? null : "Approval limit galat hai"),
  "emi.minDownPaymentPct": (v) => (between(v, 0, 90) ? null : "Down payment 0–90% ke beech"),
  "emi.foreclosureChargePct": (v) => (between(v, 0, 10) ? null : "Foreclosure charge 0–10% ke beech"),
  "lateFee.graceDays": (v) => (isInt(v) && between(v, 0, 30) ? null : "Grace days 0–30"),
  "lateFee.type": (v) => (["FLAT", "PERCENT"].includes(v) ? null : "Late fee type FLAT ya PERCENT"),
  "lateFee.flat": (v, platform, next) => (isInt(v) && v >= 0 && v <= next.lateFee.cap ? null : "Late fee, cap se zyada nahi ho sakti"),
  "lateFee.pct": (v) => (between(v, 0, 10) ? null : "Late fee % 0–10 ke beech"),
  "lateFee.cap": (v) => (isInt(v) && v >= 0 && v <= 1000000 ? null : "Late fee cap ₹10,000 tak"),
  "mdrPct.credit": (v) => (between(v, 0, 5) ? null : "MDR 0–5%"),
  "mdrPct.debit": (v) => (between(v, 0, 5) ? null : "MDR 0–5%"),
  "mdrPct.upi": (v) => (between(v, 0, 5) ? null : "MDR 0–5%"),
  "mdrPct.cash": (v) => (between(v, 0, 5) ? null : "MDR 0–5%"),
  "mdrPct.bank": (v) => (between(v, 0, 5) ? null : "MDR 0–5%"),
  "reminders.enabled": (v) => (typeof v === "boolean" ? null : "true/false"),
  "reminders.daysBefore": (v) => (isInt(v) && between(v, 0, 15) ? null : "Reminder 0–15 din pehle"),
  "reminders.channel": (v) => (["WHATSAPP", "SMS"].includes(v) ? null : "Channel WHATSAPP ya SMS"),
};

module.exports = { DEFAULT_SETTINGS, TENANT_EDITABLE, LIMITS };
