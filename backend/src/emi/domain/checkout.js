const { fmt, pct, sum } = require("./money");
const { splitInclusive, gstOf, isInterState, splitTax } = require("./gst");
const { buildSchedule } = require("./emi");
const { computeMdr, PAYMENT_METHODS } = require("./mdr");
const { ACC, dr, cr, gstCredits, journal, accountForMethod } = require("./ledger");

const FINANCE_TYPES = ["NONE", "SHOP_EMI", "NBFC"];

/**
 * The whole money side of one sale, with no database: checks, invoice lines
 * and GST, card fees, the EMI schedule or NBFC payout, and the journals.
 *
 * input: { invoiceNo, date, store: { stateCode }, customer: { kycStatus, stateCode },
 *          items: [{ productId, name, hsn, gstRatePct, listPrice, price?, qty, imei?, serialized }],
 *          canDiscount, payments: [{ method, amount, txnRef? }],
 *          finance: { type, principal?, annualRatePct?, tenureMonths?, loanAmount?, partner? } }
 * settings: effective settings (config/defaults.js shape). Amounts in paise.
 *
 * Returns { ok, errors, needsApproval, invoice, payments, emi, nbfc, journals }.
 * When ok is false, errors holds messages meant for the cashier.
 */
function checkout(input, settings) {
  const errors = [];
  const finance = { type: "NONE", ...(input.finance || {}) };
  const interState = isInterState(input.store?.stateCode, input.customer?.stateCode);

  if (!FINANCE_TYPES.includes(finance.type)) errors.push(`Finance type "${finance.type}" galat hai`);

  // ---- Items and GST ----
  const items = input.items || [];
  if (items.length === 0) errors.push("Kam se kam ek item chahiye");

  const seenImeis = new Set();
  const lines = items.map((item, index) => {
    const qty = Number(item.qty || 1);
    const listPrice = item.listPrice;
    const unitPrice = item.price ?? listPrice;
    const label = item.name || `Item ${index + 1}`;

    if (!Number.isInteger(qty) || qty < 1) errors.push(`${label}: quantity galat hai`);
    if (!Number.isInteger(unitPrice) || unitPrice <= 0) errors.push(`${label}: price galat hai`);
    if (unitPrice > listPrice) errors.push(`${label}: price list price (${fmt(listPrice)}) se zyada nahi ho sakta`);
    if (unitPrice < listPrice && !input.canDiscount) {
      errors.push(`${label}: list price (${fmt(listPrice)}) se kam par bechne ke liye Store Admin chahiye`);
    }
    if (item.serialized) {
      if (!item.imei) errors.push(`${label}: IMEI/serial number daalo`);
      if (qty !== 1) errors.push(`${label}: serial wala item ek line me ek hi hota hai`);
      if (item.imei && seenImeis.has(item.imei)) errors.push(`IMEI ${item.imei} do baar daala hai`);
      if (item.imei) seenImeis.add(item.imei);
    }

    const gross = (unitPrice || 0) * qty;
    const tax = splitInclusive(gross, item.gstRatePct, interState);
    return {
      productId: item.productId,
      name: item.name,
      hsn: item.hsn,
      imei: item.imei || null,
      qty,
      listPrice,
      unitPrice,
      discount: Math.max(0, (listPrice - unitPrice) * qty),
      gstRatePct: item.gstRatePct,
      gross,
      taxable: tax.taxable,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
    };
  });

  const grossTotal = sum(lines.map((l) => l.gross));
  const totals = {
    grossTotal,
    taxable: sum(lines.map((l) => l.taxable)),
    cgst: sum(lines.map((l) => l.cgst)),
    sgst: sum(lines.map((l) => l.sgst)),
    igst: sum(lines.map((l) => l.igst)),
    discount: sum(lines.map((l) => l.discount)),
  };

  // ---- Payments ----
  const payments = (input.payments || []).map((p) => {
    if (!PAYMENT_METHODS.includes(p.method)) errors.push(`Payment method "${p.method}" galat hai`);
    if (!Number.isInteger(p.amount) || p.amount <= 0) errors.push(`${p.method} amount galat hai`);
    return { method: p.method, amount: p.amount, txnRef: p.txnRef || null, mdr: computeMdr(p.method, p.amount || 0, settings.mdrPct) };
  });
  const paid = sum(payments.map((p) => p.amount));
  const cash = sum(payments.filter((p) => p.method === "CASH").map((p) => p.amount));
  if (cash >= settings.cashLimitPerTxn) {
    errors.push(`Ek sale me cash ${fmt(settings.cashLimitPerTxn)} se kam hi le sakte hain (Income Tax 269ST)`);
  }

  // ---- Finance ----
  let financed = 0;
  let schedule = null;
  let nbfc = null;
  let needsApproval = false;
  const emiRules = settings.emi;

  if (finance.type === "SHOP_EMI") {
    const principal = finance.principal ?? grossTotal - paid;
    const rate = finance.annualRatePct ?? emiRules.defaultRatePct;
    const tenure = Number(finance.tenureMonths);
    financed = principal;

    if (!Number.isInteger(principal) || principal <= 0) errors.push("EMI amount galat hai");
    if (!emiRules.allowedTenures.includes(tenure)) {
      errors.push(`Tenure ${tenure || "?"} mahine allowed nahi; allowed: ${emiRules.allowedTenures.join(", ")}`);
    }
    if (!(rate >= emiRules.minRatePct && rate <= emiRules.maxRatePct)) {
      errors.push(`Interest rate ${emiRules.minRatePct}%–${emiRules.maxRatePct}% ke beech hona chahiye`);
    }
    if (principal > emiRules.maxPrincipal) errors.push(`EMI amount ${fmt(emiRules.maxPrincipal)} se zyada nahi ho sakta`);
    const minDown = pct(grossTotal, emiRules.minDownPaymentPct);
    if (paid < minDown) errors.push(`Down payment kam se kam ${fmt(minDown)} (${emiRules.minDownPaymentPct}%) chahiye`);

    if (errors.length === 0) {
      schedule = buildSchedule({
        principal,
        annualRatePct: rate,
        tenureMonths: tenure,
        startDate: input.date,
        gstMode: settings.gst.interestMode,
      });
      schedule.gstTiming = settings.gst.interestTiming;
      needsApproval = principal > emiRules.approvalAbove;
    }
  } else if (finance.type === "NBFC") {
    const loanAmount = finance.loanAmount ?? grossTotal - paid;
    financed = loanAmount;
    if (!finance.partner) errors.push("NBFC partner chuno");
    else if (finance.partner.active === false) errors.push(`${finance.partner.name || "NBFC"} abhi active nahi hai`);
    if (!Number.isInteger(loanAmount) || loanAmount <= 0) errors.push("Loan amount galat hai");
    if (finance.partner && errors.length === 0) {
      const subvention = pct(loanAmount, finance.partner.subventionPct || 0);
      const subventionGst = gstOf(subvention, 18);
      nbfc = { loanAmount, subventionPct: finance.partner.subventionPct || 0, subvention, subventionGst, expectedPayout: loanAmount - subvention - subventionGst };
    }
  }

  if ((financed > 0 || grossTotal > settings.kycRequiredAbove) && input.customer?.kycStatus !== "VERIFIED") {
    errors.push(
      financed > 0
        ? "EMI/finance ke liye customer ka KYC verified hona chahiye"
        : `${fmt(settings.kycRequiredAbove)} se upar ki sale ke liye customer ka KYC verified hona chahiye`
    );
  }
  if (items.length && paid + financed !== grossTotal) {
    errors.push(`Payment + finance (${fmt(paid + financed)}) invoice total (${fmt(grossTotal)}) ke barabar nahi hai`);
  }

  if (errors.length) {
    return { ok: false, errors, needsApproval: false, invoice: { ...totals, lines }, payments, emi: null, nbfc: null, journals: [] };
  }

  // ---- Journals ----
  const journals = [
    journal("INVOICE_POSTED", [dr(ACC.CUSTOMER_RECEIVABLE, grossTotal), cr(ACC.SALES, totals.taxable), ...gstCredits(totals)]),
    ...payments.map((p) =>
      journal("PAYMENT_RECEIVED", [dr(accountForMethod(p.method), p.amount), cr(ACC.CUSTOMER_RECEIVABLE, p.amount)], { method: p.method })
    ),
  ];

  if (schedule) {
    journals.push(journal("EMI_BOOKED", [dr(ACC.EMI_PRINCIPAL, schedule.principal), cr(ACC.CUSTOMER_RECEIVABLE, schedule.principal)]));
    // UPFRONT: the whole interest GST is owed to the government on the sale
    // day; interest income is earned month by month out of "unearned"
    if (schedule.gstTiming === "UPFRONT") {
      const netInterest = sum(schedule.installments.map((i) => i.interest));
      const interestGst = schedule.totalInterestGst;
      journals.push(
        journal("EMI_INTEREST_UPFRONT", [
          dr(ACC.EMI_INTEREST, netInterest + interestGst),
          cr(ACC.UNEARNED_INTEREST, netInterest),
          ...gstCredits(splitTax(interestGst, interState)),
        ])
      );
    }
  }

  if (nbfc) {
    journals.push(journal("NBFC_BOOKED", [dr(ACC.NBFC_RECEIVABLE, nbfc.loanAmount), cr(ACC.CUSTOMER_RECEIVABLE, nbfc.loanAmount)]));
    journals.push(
      journal("NBFC_SUBVENTION", [
        dr(ACC.NBFC_SUBVENTION, nbfc.subvention),
        dr(ACC.INPUT_GST, nbfc.subventionGst),
        cr(ACC.NBFC_RECEIVABLE, nbfc.subvention + nbfc.subventionGst),
      ])
    );
  }

  const status = needsApproval ? "PENDING_APPROVAL" : schedule ? "EMI_ACTIVE" : nbfc ? "NBFC_PENDING" : "PAID";

  return {
    ok: true,
    errors: [],
    needsApproval,
    invoice: {
      invoiceNo: input.invoiceNo,
      date: input.date,
      interState,
      financeType: finance.type,
      status,
      ...totals,
      paidAtSale: paid,
      financed,
      lines,
    },
    payments,
    emi: schedule,
    nbfc,
    journals,
  };
}

module.exports = { checkout, FINANCE_TYPES };
