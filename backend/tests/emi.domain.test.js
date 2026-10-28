// EMI module calculations: pure functions, no database needed.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { splitInclusive } = require("../src/emi/domain/gst");
const { checkout } = require("../src/emi/domain/checkout");
const { addMonths, foreclosureQuote, buildSchedule } = require("../src/emi/domain/emi");
const { evaluateOverdue, allocate } = require("../src/emi/domain/overdue");
const { trialBalance, balanceOf, ACC, RECEIVABLE_ACCOUNTS } = require("../src/emi/domain/ledger");
const { postEmiReceipt, postGatewaySettlement, postNbfcSettlement } = require("../src/emi/domain/postings");
const { GATEWAY_METHODS } = require("../src/emi/domain/mdr");
const { DEFAULT_SETTINGS } = require("../src/emi/config/defaults");

const L = (rupees) => Math.round(rupees * 100); // ₹ -> paise
const settingsWith = (patch = {}) => {
  const s = structuredClone(DEFAULT_SETTINGS);
  for (const [key, value] of Object.entries(patch)) {
    const path = key.split(".");
    let node = s;
    while (path.length > 1) node = node[path.shift()];
    node[path[0]] = value;
  }
  return s;
};

const phone = (price = L(1000000)) => ({ productId: "p1", name: "Phone", hsn: "8517", gstRatePct: 18, listPrice: price, qty: 1, imei: "IMEI1", serialized: true });
const verified = { kycStatus: "VERIFIED", stateCode: "23" };
const store = { stateCode: "23" };
const sale = (overrides = {}) => ({ invoiceNo: "BPL-000001", date: "2026-01-31", store, customer: verified, items: [phone()], payments: [], ...overrides });

// Run a sale to the end: every gateway payment settles, every installment is
// paid exactly when due, the NBFC pays out. Returns the trial balance.
function runToEnd(result) {
  const journals = [...result.journals];
  for (const p of result.payments) {
    if (GATEWAY_METHODS.includes(p.method)) journals.push(postGatewaySettlement({ amount: p.amount, ...p.mdr }));
  }
  if (result.emi) {
    const installments = result.emi.installments.map((i) => ({ ...i, status: "UPCOMING" }));
    for (const inst of installments) {
      const { allocations, advance } = allocate(installments, inst.amountDue);
      for (const a of allocations) {
        const target = installments.find((i) => i.no === a.no);
        target.paidLateFee = (target.paidLateFee || 0) + a.lateFee;
        target.paidInterest = (target.paidInterest || 0) + a.interest;
        target.paidInterestGst = (target.paidInterestGst || 0) + a.interestGst;
        target.paidPrincipal = (target.paidPrincipal || 0) + a.principal;
        if (target.paidPrincipal === target.principal && target.paidInterest === target.interest && target.paidInterestGst === target.interestGst) target.status = "PAID";
      }
      journals.push(postEmiReceipt({ method: "CASH", amount: inst.amountDue, allocations, advance, gstTiming: result.emi.gstTiming, interState: result.invoice.interState }));
    }
    assert.ok(installments.every((i) => i.status === "PAID"), "every installment paid");
  }
  if (result.nbfc) journals.push(postNbfcSettlement({ expectedPayout: result.nbfc.expectedPayout }));
  return trialBalance(journals);
}

const assertClosed = (tb) => {
  assert.ok(tb.balanced, "trial balance Dr = Cr");
  for (const account of [...RECEIVABLE_ACCOUNTS, ACC.UNEARNED_INTEREST]) {
    assert.equal(balanceOf(tb, account), 0, `account ${account} ends at zero`);
  }
};

test("GST split of ₹10L inclusive at 18%", () => {
  const t = splitInclusive(L(1000000), 18);
  assert.equal(t.taxable, L(847457.63));
  assert.equal(t.cgst, L(76271.19));
  assert.equal(t.sgst, L(76271.18));
  assert.equal(t.taxable + t.cgst + t.sgst, L(1000000));
});

test("Case A: ₹10L on Shop EMI needs approval", () => {
  const r = checkout(sale({ finance: { type: "SHOP_EMI", principal: L(1000000), annualRatePct: 18, tenureMonths: 12 } }), settingsWith());
  assert.ok(r.ok, r.errors.join("; "));
  assert.equal(r.emi.emi, L(91680));
  assert.equal(r.emi.lastEmi, L(91679.91));
  assert.equal(r.emi.totalInterest, L(100159.91));
  assert.equal(r.needsApproval, true);
  assert.equal(r.invoice.status, "PENDING_APPROVAL");
});

test("Case B: ₹5L card + ₹5L EMI closes every receivable after 12 EMIs", () => {
  const r = checkout(
    sale({ payments: [{ method: "CREDIT_CARD", amount: L(500000) }], finance: { type: "SHOP_EMI", principal: L(500000), annualRatePct: 18, tenureMonths: 12 } }),
    settingsWith()
  );
  assert.ok(r.ok, r.errors.join("; "));
  assert.deepEqual(
    { mdr: r.payments[0].mdr.mdr, gstOnMdr: r.payments[0].mdr.gstOnMdr, net: r.payments[0].mdr.netSettled },
    { mdr: L(7500), gstOnMdr: L(1350), net: L(491150) }
  );
  assert.equal(r.emi.emi, L(45840));
  assert.equal(r.needsApproval, false);
  assertClosed(runToEnd(r));
});

test("All three interest GST modes close the ledger at zero", () => {
  const cases = [
    { "gst.interestMode": "TAXABLE_INCLUSIVE", "gst.interestTiming": "UPFRONT" },
    { "gst.interestMode": "TAXABLE_EXCLUSIVE", "gst.interestTiming": "PER_INSTALLMENT" },
    { "gst.interestMode": "EXEMPT", "gst.interestTiming": "PER_INSTALLMENT" },
  ];
  for (const patch of cases) {
    const r = checkout(sale({ payments: [{ method: "UPI", amount: L(400000) }], finance: { type: "SHOP_EMI", annualRatePct: 18, tenureMonths: 9 } }), settingsWith(patch));
    assert.ok(r.ok, r.errors.join("; "));
    const tb = runToEnd(r);
    assertClosed(tb);
    const outputGst = -(balanceOf(tb, ACC.OUTPUT_CGST) + balanceOf(tb, ACC.OUTPUT_SGST));
    assert.equal(outputGst, r.invoice.cgst + r.invoice.sgst + r.emi.totalInterestGst, `GST owed in ${JSON.stringify(patch)}`);
  }
});

test("Case C: NBFC subvention and payout", () => {
  const partner = { name: "Demo Finance", subventionPct: 3, active: true };
  const r = checkout(sale({ payments: [{ method: "UPI", amount: L(200000) }], finance: { type: "NBFC", loanAmount: L(800000), partner } }), settingsWith());
  assert.ok(r.ok, r.errors.join("; "));
  assert.equal(r.nbfc.subvention, L(24000));
  assert.equal(r.nbfc.subventionGst, L(4320));
  assert.equal(r.nbfc.expectedPayout, L(771680));
  assert.equal(r.invoice.status, "NBFC_PENDING");
  assertClosed(runToEnd(r));
});

test("Checks reject cash ≥ ₹2L, missing KYC, total mismatch, bad tenure and rate", () => {
  const s = settingsWith();
  const reject = (input, pattern) => {
    const r = checkout(input, s);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => pattern.test(e)), `expected ${pattern} in ${JSON.stringify(r.errors)}`);
  };
  reject(sale({ items: [phone(L(200000))], payments: [{ method: "CASH", amount: L(200000) }] }), /cash/i);
  reject(sale({ customer: { kycStatus: "PENDING" }, payments: [{ method: "UPI", amount: L(1000000) }] }), /KYC/);
  reject(sale({ payments: [{ method: "UPI", amount: L(900000) }] }), /barabar nahi/);
  reject(sale({ finance: { type: "SHOP_EMI", principal: L(1000000), tenureMonths: 5 } }), /Tenure 5/);
  reject(sale({ finance: { type: "SHOP_EMI", principal: L(1000000), tenureMonths: 12, annualRatePct: 30 } }), /rate/);
  // Below list price needs a Store Admin
  reject(sale({ items: [{ ...phone(), price: L(900000) }], payments: [{ method: "UPI", amount: L(900000) }] }), /Store Admin/);
});

test("Overdue: DPD 12 is bucket 1-30, late fee once, reminder 3 days before", () => {
  const s = settingsWith();
  const inst = { no: 1, dueDate: "2026-03-01", status: "UPCOMING", principal: L(40000), interest: L(5000), interestGst: 0 };
  const late = evaluateOverdue(inst, "2026-03-13", s);
  assert.equal(late.dpd, 12);
  assert.equal(late.bucket, "1-30");
  assert.equal(late.status, "OVERDUE");
  assert.equal(late.lateFee, L(500));
  assert.equal(evaluateOverdue({ ...inst, lateFeeApplied: true, lateFee: L(500) }, "2026-03-20", s).lateFee, 0);
  assert.equal(evaluateOverdue(inst, "2026-03-03", s).lateFee, 0, "still inside grace");
  assert.equal(evaluateOverdue(inst, "2026-02-26", s).action, "REMIND_BEFORE_DUE");
  assert.equal(evaluateOverdue(inst, "2026-03-01", s).action, "DUE_TODAY");
});

test("Allocation: late fee, then interest, then principal; extra is advance", () => {
  const insts = [
    { _id: "a", no: 1, status: "OVERDUE", lateFee: L(500), interest: L(1000), interestGst: L(180), principal: L(10000) },
    { _id: "b", no: 2, status: "UPCOMING", lateFee: 0, interest: L(900), interestGst: L(162), principal: L(10100) },
  ];
  const partial = allocate(insts, L(1200));
  assert.deepEqual(partial.allocations[0], { installmentId: "a", no: 1, lateFee: L(500), interestGst: L(180), interest: L(520), principal: 0, total: L(1200) });
  const full = allocate(insts, L(30000));
  assert.equal(full.allocations.length, 2);
  assert.equal(full.advance, L(30000) - L(11680) - L(11162));
});

test("Due dates keep the day of month; foreclosure quote", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-01-31", 2), "2026-03-31");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");

  const plan = buildSchedule({ principal: L(500000), annualRatePct: 18, tenureMonths: 12, startDate: "2026-01-31" });
  const installments = plan.installments.map((i) => ({
    ...i,
    status: i.no <= 3 ? "PAID" : "UPCOMING",
    paidPrincipal: i.no <= 3 ? i.principal : 0,
    paidInterest: i.no <= 3 ? i.interest : 0,
    paidInterestGst: i.no <= 3 ? i.interestGst : 0,
  }));
  const contract = { startDate: "2026-01-31", annualRatePct: 18, gstMode: "TAXABLE_INCLUSIVE", gstTiming: "PER_INSTALLMENT" };
  // 10 days after the 3rd due date (30 Apr)
  const q = foreclosureQuote({ contract, installments, asOf: "2026-05-10", chargePct: 2 });
  const remaining = installments.slice(3).reduce((s, i) => s + i.principal, 0);
  assert.equal(q.dueNow, 0);
  assert.equal(q.outstandingPrincipal, remaining);
  assert.equal(q.accruedDays, 10);
  assert.equal(q.accruedInterest + q.accruedInterestGst, Math.round((remaining * 18 * 10) / 36500));
  assert.equal(q.charge, Math.round(remaining * 0.02));
  assert.equal(q.chargeGst, Math.round(q.charge * 0.18));
  assert.equal(q.total, q.outstandingPrincipal + q.accruedInterest + q.accruedInterestGst + q.charge + q.chargeGst);
  assert.throws(() => foreclosureQuote({ contract: { ...contract, gstTiming: "UPFRONT" }, installments, asOf: "2026-05-10", chargePct: 2 }), /UPFRONT/);
});
