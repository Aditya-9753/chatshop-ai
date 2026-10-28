const { pct } = require("./money");
const { gstOf } = require("./gst");

const PAYMENT_METHODS = ["CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "BANK"];

// Settings keys for each method's fee percentage
const MDR_KEYS = { CASH: "cash", UPI: "upi", CREDIT_CARD: "credit", DEBIT_CARD: "debit", BANK: "bank" };

// Methods that land in the gateway first and settle to the bank later
const GATEWAY_METHODS = ["UPI", "CREDIT_CARD", "DEBIT_CARD"];

// Card/UPI fee (MDR) and 18% GST on that fee; the rest is what the bank gets
const computeMdr = (method, amount, mdrPct = {}) => {
  const rate = Number(mdrPct[MDR_KEYS[method]] || 0);
  const mdr = pct(amount, rate);
  const gstOnMdr = gstOf(mdr, 18);
  return { ratePct: rate, mdr, gstOnMdr, netSettled: amount - mdr - gstOnMdr };
};

module.exports = { PAYMENT_METHODS, GATEWAY_METHODS, computeMdr };
