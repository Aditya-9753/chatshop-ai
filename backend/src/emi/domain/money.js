// Every amount in the EMI module is an integer number of paise. Rupees typed
// in a form become paise at the edge (rupees()) and only turn back into ₹ text
// for display (fmt()), so no float rounding ever reaches the books.

const rupees = (value) => Math.round(Number(value) * 100);

const toRupees = (paise) => paise / 100;

// 1234567 -> "₹12,345.67" (Indian digit grouping)
const fmt = (paise) => {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paise));
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}₹${new Intl.NumberFormat("en-IN").format(whole)}.${fraction}`;
};

// Nearest whole rupee, still in paise
const roundToRupee = (paise) => Math.round(paise / 100) * 100;

// Percentage of an amount, rounded half up to the paisa
const pct = (amount, ratePct) => Math.round((amount * ratePct) / 100);

const sum = (values) => values.reduce((total, value) => total + (value || 0), 0);

const isPaise = (value) => Number.isInteger(value);

module.exports = { rupees, toRupees, fmt, roundToRupee, pct, sum, isPaise };
