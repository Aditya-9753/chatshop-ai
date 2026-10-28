const { splitTax } = require("./gst");
const { ACC, dr, cr, gstCredits, journal, accountForMethod } = require("./ledger");

// Journals for what happens after the sale. Each GST timing books interest
// differently: PER_INSTALLMENT earns interest and owes its GST when the money
// comes in; UPFRONT already booked both at the sale, so a receipt only clears
// the interest receivable and moves interest from "unearned" to income.

const componentCredits = ({ lateFee = 0, interest = 0, interestGst = 0, principal = 0 }, { gstTiming, interState }) => {
  const lines = [cr(ACC.LATE_FEE_RECEIVABLE, lateFee), cr(ACC.EMI_PRINCIPAL, principal)];
  if (gstTiming === "UPFRONT") {
    lines.push(cr(ACC.EMI_INTEREST, interest + interestGst), dr(ACC.UNEARNED_INTEREST, interest), cr(ACC.INTEREST_INCOME, interest));
  } else {
    lines.push(cr(ACC.INTEREST_INCOME, interest), ...gstCredits(splitTax(interestGst, interState)));
  }
  return lines;
};

const totals = (allocations) =>
  allocations.reduce(
    (t, a) => ({
      lateFee: t.lateFee + (a.lateFee || 0),
      interest: t.interest + (a.interest || 0),
      interestGst: t.interestGst + (a.interestGst || 0),
      principal: t.principal + (a.principal || 0),
    }),
    { lateFee: 0, interest: 0, interestGst: 0, principal: 0 }
  );

// EMI money received: split across installments, anything extra is advance
const postEmiReceipt = ({ method, amount, allocations, advance = 0, gstTiming, interState }) =>
  journal("EMI_RECEIPT", [
    dr(accountForMethod(method), amount),
    ...componentCredits(totals(allocations), { gstTiming, interState }),
    cr(ACC.CUSTOMER_ADVANCE, advance),
  ]);

// Gateway paid out a card/UPI payment: bank gets the net, fee + GST are costs
const postGatewaySettlement = ({ amount, mdr, gstOnMdr, netSettled }) =>
  journal("GATEWAY_SETTLED", [
    dr(ACC.BANK, netSettled),
    dr(ACC.MDR_EXPENSE, mdr),
    dr(ACC.INPUT_GST, gstOnMdr),
    cr(ACC.GATEWAY_RECEIVABLE, amount),
  ]);

// NBFC paid the dealer. A short payment is extra subvention cost.
const postNbfcSettlement = ({ expectedPayout, received = expectedPayout }) => {
  const diff = expectedPayout - received;
  return journal("NBFC_SETTLED", [
    dr(ACC.BANK, received),
    diff > 0 ? dr(ACC.NBFC_SUBVENTION, diff) : cr(ACC.NBFC_SUBVENTION, -diff),
    cr(ACC.NBFC_RECEIVABLE, expectedPayout),
  ]);
};

const postLateFee = ({ amount }) => journal("LATE_FEE_APPLIED", [dr(ACC.LATE_FEE_RECEIVABLE, amount), cr(ACC.LATE_FEE_INCOME, amount)]);

const postWaiver = ({ amount }) => journal("LATE_FEE_WAIVED", [dr(ACC.WAIVERS, amount), cr(ACC.LATE_FEE_RECEIVABLE, amount)]);

// Foreclosure: dues already owed, the rest of the principal, broken-period
// interest and the foreclosure charge, paid in one go
const postForeclosure = ({ method, amount, allocations, quote, gstTiming, interState }) =>
  journal("FORECLOSURE", [
    dr(accountForMethod(method), amount),
    dr(ACC.CUSTOMER_ADVANCE, quote.advance || 0),
    ...componentCredits(totals(allocations), { gstTiming, interState }),
    cr(ACC.EMI_PRINCIPAL, quote.outstandingPrincipal),
    cr(ACC.INTEREST_INCOME, quote.accruedInterest),
    cr(ACC.FORECLOSURE_INCOME, quote.charge),
    ...gstCredits(splitTax(quote.accruedInterestGst + quote.chargeGst, interState)),
  ]);

module.exports = {
  postEmiReceipt,
  postGatewaySettlement,
  postNbfcSettlement,
  postLateFee,
  postWaiver,
  postForeclosure,
  allocationTotals: totals,
};
