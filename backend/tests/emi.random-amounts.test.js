// 2,000 random sales through the domain functions. Every sale must keep GST,
// EMI principal and card fees exact, and close the books at zero once every
// EMI is paid, so the maths does not hold only for the worked examples.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { checkout } = require("../src/emi/domain/checkout");
const { allocate } = require("../src/emi/domain/overdue");
const { trialBalance, balanceOf, ACC, RECEIVABLE_ACCOUNTS } = require("../src/emi/domain/ledger");
const { postEmiReceipt, postGatewaySettlement, postNbfcSettlement } = require("../src/emi/domain/postings");
const { GATEWAY_METHODS } = require("../src/emi/domain/mdr");
const { DEFAULT_SETTINGS } = require("../src/emi/config/defaults");

// Small seeded PRNG so a failure can be reproduced
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("2,000 random sales stay exact and close the ledger", () => {
  const rand = rng(20261028);
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (list) => list[int(0, list.length - 1)];

  for (let n = 0; n < 2000; n++) {
    const settings = structuredClone(DEFAULT_SETTINGS);
    settings.gst.interestMode = pick(["TAXABLE_INCLUSIVE", "TAXABLE_EXCLUSIVE", "EXEMPT"]);
    settings.gst.interestTiming = pick(["PER_INSTALLMENT", "UPFRONT"]);
    settings.emi.maxRatePct = 36;
    settings.emi.allowedTenures = Array.from({ length: 36 }, (_, i) => i + 1);
    settings.emi.maxPrincipal = Number.MAX_SAFE_INTEGER;
    settings.cashLimitPerTxn = Number.MAX_SAFE_INTEGER;

    const items = Array.from({ length: int(1, 3) }, (_, i) => ({
      productId: `p${i}`,
      name: `Item ${i}`,
      hsn: "8517",
      gstRatePct: pick([5, 12, 18, 28]),
      listPrice: int(49900, 300000000), // ₹499 to ₹3 crore, with paise
      qty: 1,
    }));
    const gross = items.reduce((s, i) => s + i.listPrice, 0);
    const financeType = pick(["NONE", "SHOP_EMI", "NBFC"]);
    const financed = financeType === "NONE" ? 0 : int(Math.ceil(gross * 0.1), gross);
    const upfront = gross - financed;

    // Split what is paid now across one to three methods
    const payments = [];
    let left = upfront;
    while (left > 0) {
      const amount = payments.length === 2 ? left : int(1, left);
      payments.push({ method: pick(["CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "BANK"]), amount });
      left -= amount;
    }

    const finance =
      financeType === "SHOP_EMI"
        ? { type: "SHOP_EMI", principal: financed, annualRatePct: int(0, 3600) / 100, tenureMonths: int(1, 36) }
        : financeType === "NBFC"
          ? { type: "NBFC", loanAmount: financed, partner: { subventionPct: int(0, 800) / 100, active: true } }
          : { type: "NONE" };

    const r = checkout(
      { invoiceNo: `T-${n}`, date: "2026-01-31", store: { stateCode: "23" }, customer: { kycStatus: "VERIFIED", stateCode: pick(["23", "27"]) }, items, payments, finance },
      settings
    );
    const label = `sale ${n}`;
    assert.ok(r.ok, `${label}: ${r.errors.join("; ")}`);

    // GST adds back to the gross on every line and in total
    for (const line of r.invoice.lines) assert.equal(line.taxable + line.cgst + line.sgst + line.igst, line.gross, label);
    assert.equal(r.invoice.taxable + r.invoice.cgst + r.invoice.sgst + r.invoice.igst, gross, label);

    // Card fee + GST + net = amount
    for (const p of r.payments) assert.equal(p.mdr.mdr + p.mdr.gstOnMdr + p.mdr.netSettled, p.amount, label);

    const journals = [...r.journals];
    for (const p of r.payments) {
      if (GATEWAY_METHODS.includes(p.method)) journals.push(postGatewaySettlement({ amount: p.amount, ...p.mdr }));
    }

    if (r.emi) {
      const insts = r.emi.installments.map((i) => ({ ...i, status: i.amountDue === 0 ? "PAID" : "UPCOMING" }));
      assert.equal(insts.reduce((s, i) => s + i.principal, 0), financed, `${label}: principal repaid in full`);
      assert.ok(insts.every((i) => i.principal >= 0 && i.grossInterest >= 0), `${label}: no negative parts`);
      for (const inst of insts) {
        if (inst.status === "PAID") continue;
        const { allocations, advance } = allocate(insts, inst.amountDue);
        assert.equal(advance, 0, label);
        for (const a of allocations) {
          const t = insts.find((i) => i.no === a.no);
          t.paidInterest = (t.paidInterest || 0) + a.interest;
          t.paidInterestGst = (t.paidInterestGst || 0) + a.interestGst;
          t.paidPrincipal = (t.paidPrincipal || 0) + a.principal;
          if (t.paidPrincipal === t.principal && t.paidInterest === t.interest && t.paidInterestGst === t.interestGst) t.status = "PAID";
        }
        journals.push(postEmiReceipt({ method: "BANK", amount: inst.amountDue, allocations, advance, gstTiming: r.emi.gstTiming, interState: r.invoice.interState }));
      }
    }
    if (r.nbfc) journals.push(postNbfcSettlement({ expectedPayout: r.nbfc.expectedPayout }));

    const tb = trialBalance(journals);
    assert.ok(tb.balanced, label);
    for (const account of [...RECEIVABLE_ACCOUNTS, ACC.UNEARNED_INTEREST]) {
      assert.equal(balanceOf(tb, account), 0, `${label}: account ${account} closes at zero`);
    }
  }
});
