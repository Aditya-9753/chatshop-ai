const { roundToRupee, pct } = require("./money");
const { gstOf, gstInside } = require("./gst");

// GST on EMI interest: TAXABLE_INCLUSIVE (the interest already contains 18%
// GST), TAXABLE_EXCLUSIVE (18% is added on top) or EXEMPT. Timing decides when
// that GST is booked: with each installment, or all of it UPFRONT at the sale.
const GST_MODES = ["TAXABLE_INCLUSIVE", "TAXABLE_EXCLUSIVE", "EXEMPT"];
const GST_TIMINGS = ["PER_INSTALLMENT", "UPFRONT"];
const INTEREST_GST_RATE = 18;

class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Business dates are "YYYY-MM-DD" strings (shop's local calendar date)
const parseDate = (date) => {
  const [y, m, d] = String(date).slice(0, 10).split("-").map(Number);
  return { y, m, d };
};

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// Same day of month, `months` later, clamped to the month's last day. Always
// counted from the original date: 31 Jan -> 28 Feb -> 31 Mar, never 28 Mar.
const addMonths = (date, months) => {
  const { y, m, d } = parseDate(date);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const daysBetween = (from, to) => {
  const a = parseDate(from);
  const b = parseDate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
};

// Reducing-balance EMI, rounded to the whole rupee
const emiAmount = (principal, annualRatePct, months) => {
  if (months <= 0) throw new DomainError("BAD_TENURE", "Tenure kam se kam 1 mahina hona chahiye");
  const r = annualRatePct / 1200;
  if (r === 0) return roundToRupee(principal / months);
  const growth = Math.pow(1 + r, months);
  return roundToRupee((principal * r * growth) / (growth - 1));
};

// Split one installment's interest into taxable interest + GST per the mode
const interestParts = (grossInterest, gstMode) => {
  if (gstMode === "TAXABLE_INCLUSIVE") {
    const interestGst = gstInside(grossInterest, INTEREST_GST_RATE);
    return { interest: grossInterest - interestGst, interestGst };
  }
  if (gstMode === "TAXABLE_EXCLUSIVE") {
    return { interest: grossInterest, interestGst: gstOf(grossInterest, INTEREST_GST_RATE) };
  }
  return { interest: grossInterest, interestGst: 0 };
};

/**
 * Month-by-month schedule. Interest each month is the balance × monthly rate,
 * the principal part is EMI − interest, and the last installment takes
 * whatever principal is left so the balance ends at exactly zero.
 * amountDue = principal + interest + interestGst for every installment.
 */
const buildSchedule = ({ principal, annualRatePct, tenureMonths, startDate, gstMode = "TAXABLE_INCLUSIVE" }) => {
  if (!GST_MODES.includes(gstMode)) throw new DomainError("BAD_GST_MODE", `GST mode "${gstMode}" galat hai`);
  const emi = emiAmount(principal, annualRatePct, tenureMonths);
  const r = annualRatePct / 1200;
  const installments = [];
  let balance = principal;

  for (let no = 1; no <= tenureMonths; no++) {
    const grossInterest = Math.round(balance * r);
    const principalPart = no === tenureMonths ? balance : Math.min(balance, emi - grossInterest);
    const { interest, interestGst } = interestParts(grossInterest, gstMode);
    installments.push({
      no,
      dueDate: addMonths(startDate, no),
      openingBalance: balance,
      principal: principalPart,
      grossInterest,
      interest,
      interestGst,
      amountDue: principalPart + interest + interestGst,
    });
    balance -= principalPart;
  }

  const total = (key) => installments.reduce((s, i) => s + i[key], 0);
  return {
    emi,
    principal,
    annualRatePct,
    tenureMonths,
    gstMode,
    totalInterest: total("grossInterest"),
    totalInterestGst: total("interestGst"),
    totalPayable: total("amountDue"),
    lastEmi: installments[installments.length - 1].principal + installments[installments.length - 1].grossInterest,
    installments,
  };
};

// What is still owed on one installment, by component
const unpaidOf = (inst) => ({
  lateFee: Math.max(0, (inst.lateFee || 0) - (inst.paidLateFee || 0) - (inst.lateFeeWaived || 0)),
  interestGst: Math.max(0, (inst.interestGst || 0) - (inst.paidInterestGst || 0)),
  interest: Math.max(0, (inst.interest || 0) - (inst.paidInterest || 0)),
  principal: Math.max(0, (inst.principal || 0) - (inst.paidPrincipal || 0)),
});

const totalOf = (parts) => parts.lateFee + parts.interestGst + parts.interest + parts.principal;

/**
 * Foreclosure on `asOf`: everything already due, the principal still to come,
 * interest accrued since the last due date, and the foreclosure charge + GST.
 * Advance already paid is knocked off. UPFRONT-GST contracts would need a
 * credit note for the unearned interest GST, which is not built yet.
 */
const foreclosureQuote = ({ contract, installments, asOf, chargePct }) => {
  if (contract.gstTiming === "UPFRONT") {
    throw new DomainError(
      "FORECLOSURE_UPFRONT_GST",
      "UPFRONT GST wale contract ka foreclosure abhi nahi ho sakta (credit note flow baaki hai)"
    );
  }
  const open = installments.filter((i) => !["PAID", "CANCELLED"].includes(i.status));
  const due = open.filter((i) => daysBetween(i.dueDate, asOf) >= 0);
  const future = open.filter((i) => daysBetween(i.dueDate, asOf) < 0);

  const dueNow = due.reduce((s, i) => s + totalOf(unpaidOf(i)), 0);
  const outstandingPrincipal = future.reduce((s, i) => s + unpaidOf(i).principal, 0);

  // Broken-period interest from the last due date (or the start) to today
  const lastDue = installments
    .filter((i) => daysBetween(i.dueDate, asOf) >= 0)
    .reduce((latest, i) => (!latest || daysBetween(latest, i.dueDate) > 0 ? i.dueDate : latest), null);
  const accrualFrom = lastDue || contract.startDate;
  const days = Math.max(0, daysBetween(accrualFrom, asOf));
  const grossAccrued = Math.round((outstandingPrincipal * contract.annualRatePct * days) / 36500);
  const accrued = interestParts(grossAccrued, contract.gstMode);

  const charge = pct(outstandingPrincipal, chargePct);
  const chargeGst = gstOf(charge, 18);
  const advance = contract.advance || 0;
  const total = Math.max(0, dueNow + outstandingPrincipal + accrued.interest + accrued.interestGst + charge + chargeGst - advance);

  return {
    asOf,
    dueNow,
    outstandingPrincipal,
    accruedDays: days,
    accruedInterest: accrued.interest,
    accruedInterestGst: accrued.interestGst,
    charge,
    chargeGst,
    advance,
    total,
  };
};

module.exports = {
  GST_MODES,
  GST_TIMINGS,
  INTEREST_GST_RATE,
  DomainError,
  addMonths,
  daysBetween,
  emiAmount,
  interestParts,
  buildSchedule,
  unpaidOf,
  totalOf,
  foreclosureQuote,
};
