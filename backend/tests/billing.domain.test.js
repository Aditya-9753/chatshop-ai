// Platform billing money rules, without a database
const { test } = require("node:test");
const assert = require("node:assert/strict");
const d = require("../src/billing/domain");

test("financial year runs April to March in India time", () => {
  assert.equal(d.financialYear(new Date("2026-11-02T10:00:00Z")), "26-27");
  assert.equal(d.financialYear(new Date("2027-03-31T18:00:00Z")), "26-27"); // 23:30 IST on 31 March
  assert.equal(d.financialYear(new Date("2027-03-31T18:31:00Z")), "27-28"); // 00:01 IST on 1 April
  assert.equal(d.documentNumber("CSA", "26-27", 7), "CSA-26-27-000007");
  assert.equal(d.documentNumber("CSA", "26-27", 7, "CREDIT_NOTE"), "CN-CSA-26-27-000007");
});

test("periods: same day next month, clamped to the month's end; one-time is lifetime", () => {
  assert.equal(d.addInterval(new Date("2027-01-31T06:00:00Z"), "MONTHLY").toISOString(), "2027-02-28T06:00:00.000Z");
  assert.equal(d.addInterval(new Date("2026-11-02T06:00:00Z"), "YEARLY").toISOString(), "2027-11-02T06:00:00.000Z");
  assert.equal(d.addInterval(new Date(), "ONE_TIME").toISOString(), d.LIFETIME_END.toISOString());
});

test("GST on platform invoices: exclusive, inclusive, inter-state, unregistered", () => {
  const line = [{ kind: "SUBSCRIPTION", description: "Growth", qty: 1, unitPricePaise: 99900 }];
  // The guide's example: ₹999 + 18% = ₹1,178.82, split CGST/SGST within the state
  const intra = d.computeInvoice(line, { gstRegistered: true, gstRatePct: 18, pricesIncludeGst: false, supplierState: "23", customerState: "23" });
  assert.equal(intra.taxablePaise, 99900);
  assert.equal(intra.taxTotalPaise, 17982);
  assert.equal(intra.cgstPaise + intra.sgstPaise, 17982);
  assert.equal(intra.igstPaise, 0);
  assert.equal(intra.grandTotalPaise, 117882);

  const inter = d.computeInvoice(line, { gstRegistered: true, gstRatePct: 18, pricesIncludeGst: false, supplierState: "23", customerState: "27" });
  assert.equal(inter.igstPaise, 17982);
  assert.equal(inter.interState, true);

  const inclusive = d.computeInvoice([{ kind: "CUSTOM", description: "x", unitPricePaise: 49900 }], { gstRegistered: true, gstRatePct: 18, pricesIncludeGst: true });
  assert.equal(inclusive.grandTotalPaise, 49900);
  assert.equal(inclusive.taxablePaise + inclusive.taxTotalPaise, 49900);
  assert.equal(inclusive.taxablePaise, 42288);

  // No GSTIN: not registered, so no GST at all
  const none = d.computeInvoice(line, { gstRegistered: false, gstRatePct: 18, pricesIncludeGst: false });
  assert.equal(none.taxTotalPaise, 0);
  assert.equal(none.grandTotalPaise, 99900);

  // Quantity and discount
  const multi = d.computeInvoice([{ kind: "ADDON", description: "Seats", qty: 3, unitPricePaise: 10000, discountPaise: 5000 }], { gstRegistered: true, gstRatePct: 18, pricesIncludeGst: false });
  assert.equal(multi.subtotalPaise, 30000);
  assert.equal(multi.discountPaise, 5000);
  assert.equal(multi.taxablePaise, 25000);
  assert.equal(multi.grandTotalPaise, 29500);

  assert.throws(() => d.computeInvoice([{ kind: "CUSTOM", description: "x", unitPricePaise: 100, discountPaise: 101 }], { gstRegistered: false }), /discount/);
  assert.throws(() => d.computeInvoice([{ kind: "CUSTOM", description: "x", unitPricePaise: 10.5 }], { gstRegistered: false }), /whole paise/);
  assert.throws(() => d.computeInvoice([], { gstRegistered: false }), /at least one line/);
});

test("credit notes reverse GST in the invoice's proportion and always add up", () => {
  const invoice = { grandTotalPaise: 117882, taxTotalPaise: 17982, igstPaise: 0 };
  const half = d.creditNoteSplit(invoice, 58941);
  assert.equal(half.taxablePaise + half.cgstPaise + half.sgstPaise, 58941);
  assert.equal(half.cgstPaise + half.sgstPaise, 8991);
  for (let amount = 1; amount <= 117882; amount += 3917) {
    const s = d.creditNoteSplit(invoice, amount);
    assert.equal(s.taxablePaise + s.cgstPaise + s.sgstPaise + s.igstPaise, amount);
  }
});

test("a purchase renews the same running plan, otherwise starts now", () => {
  const now = new Date("2026-11-02T06:00:00Z");
  const plan = { code: "business", interval: "MONTHLY" };
  const running = { plan: "business", status: "active", trial: false, endDate: new Date("2026-11-20T06:00:00Z") };
  const renew = d.purchasePeriod(running, plan, now);
  assert.equal(renew.kind, "RENEWED");
  assert.equal(renew.start.toISOString(), "2026-11-20T06:00:00.000Z");
  assert.equal(renew.end.toISOString(), "2026-12-20T06:00:00.000Z");

  assert.equal(d.purchasePeriod({ ...running, trial: true }, plan, now).start.toISOString(), now.toISOString());
  assert.equal(d.purchasePeriod({ ...running, plan: "starter" }, plan, now).kind, "PLAN_CHANGED");
  assert.equal(d.purchasePeriod({ ...running, endDate: new Date("2026-10-01") }, plan, now).start.toISOString(), now.toISOString());
});

test("monthly value: yearly ÷ 12, one-time none; payment status from amounts", () => {
  assert.equal(d.monthlyValue(120000, "YEARLY"), 10000);
  assert.equal(d.monthlyValue(49900, "MONTHLY"), 49900);
  assert.equal(d.monthlyValue(1000000, "ONE_TIME"), 0);
  assert.equal(d.paymentStatusOf(1000, 0), "UNPAID");
  assert.equal(d.paymentStatusOf(1000, 400), "PARTIALLY_PAID");
  assert.equal(d.paymentStatusOf(1000, 1000), "PAID");
  assert.equal(d.stateFromGstin("23ABCDE1234F1Z5"), "23");
  assert.equal(d.stateFromGstin("nope"), null);
});
