// Platform billing (ChatShop AI -> shop) end to end through the HTTP API
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const request = require("supertest");
const mongoose = require("mongoose");
const { startApp, stopApp, registerUser, stub } = require("./helpers");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEBHOOK_SECRET = "whsec-test";
let app, User, Order, Product, models, gateway, domain;
let superToken, limitedToken, shopA, shopB;

before(async () => {
  process.env.PAYMENT_GATEWAY = "mock";
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.RAZORPAY_KEY_SECRET = "rzp-secret-test";
  app = await startApp("chatshop-test-platform-billing");
  User = require("../src/models/User.model");
  Order = require("../src/models/Order.model");
  Product = require("../src/models/Product.model");
  models = require("../src/billing/models");
  gateway = require("../src/billing/gateway");
  domain = require("../src/billing/domain");

  const admin = await registerUser(app, { name: "Root Admin", email: "billing-root@example.com" });
  await User.updateOne({ _id: admin.user.id }, { role: "admin" });
  superToken = admin.token;
  await request(app).put("/api/admin/admin-panel").set("Authorization", `Bearer ${superToken}`).send({ password: "Panel@123" });
  limitedToken = (await request(app).post("/api/auth/login").send({ email: "billing-root@example.com", password: "Panel@123" })).body.data.token;

  shopA = await registerUser(app, { name: "Asha", businessName: "Asha Mobiles" });
  shopB = await registerUser(app, { name: "Bala", businessName: "Bala Cement" });
  // Shop B is in Maharashtra (GSTIN 27…): inter-state for a Madhya Pradesh supplier
  await User.updateOne({ _id: shopB.user.id }, { "businessInfo.gstNumber": "27ABCDE1234F1Z5" });
});

after(async () => {
  delete process.env.PAYMENT_GATEWAY;
  await stopApp();
});

const as = (token) => ({
  get: (url) => request(app).get(url).set("Authorization", `Bearer ${token}`),
  post: (url, body, key) => {
    const r = request(app).post(url).set("Authorization", `Bearer ${token}`);
    if (key) r.set("Idempotency-Key", key);
    return r.send(body || {});
  },
  put: (url, body) => request(app).put(url).set("Authorization", `Bearer ${token}`).send(body),
  patch: (url, body) => request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body),
});
const key = () => crypto.randomUUID();
const fy = () => domain.financialYear();

const signedWebhook = (body, { eventId = key(), secret = WEBHOOK_SECRET } = {}) => {
  const raw = JSON.stringify(body);
  return request(app)
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("x-razorpay-event-id", eventId)
    .set("x-razorpay-signature", crypto.createHmac("sha256", secret).update(raw).digest("hex"))
    .send(raw);
};
const capturedEvent = (orderId, amount, paymentId = `pay_${key().slice(0, 8)}`) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, currency: "INR", status: "captured", method: "upi" } } },
});

test("plans come from the database, in paise; only the Super Admin edits them, with versions", async () => {
  const pub = await request(app).get("/api/subscriptions/plans");
  assert.equal(pub.status, 200);
  const codes = pub.body.data.plans.map((p) => p.code);
  assert.deepEqual(codes, ["starter", "business", "premium", "one-time"]);
  assert.equal(pub.body.data.plans.find((p) => p.code === "business").pricePaise, 124900);

  const root = as(superToken);
  assert.equal((await as(limitedToken).get("/api/admin/plans")).status, 403);
  assert.equal((await as(shopA.token).get("/api/admin/plans")).status, 403);

  const created = await root.post("/api/admin/plans", { code: "growth-yearly", name: "Growth yearly", pricePaise: 1200000, interval: "YEARLY", features: ["Everything"] });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal((await root.post("/api/admin/plans", { code: "growth-yearly", name: "Again", pricePaise: 1, interval: "YEARLY" })).status, 409);
  assert.equal((await root.post("/api/admin/plans", { code: "bad", name: "Float", pricePaise: 10.5, interval: "MONTHLY" })).status, 400);

  // A price change is a new version; hiding a plan is not
  const v2 = await root.patch("/api/admin/plans/growth-yearly", { pricePaise: 1100000 });
  assert.equal(v2.body.data.version, 2);
  const hidden = await root.patch("/api/admin/plans/growth-yearly", { isActive: false });
  assert.equal(hidden.body.data.version, 2);
  const history = await root.get("/api/admin/plans/growth-yearly/history");
  assert.deepEqual(history.body.data.map((p) => [p.version, p.pricePaise, p.isCurrent]), [[2, 1100000, true], [1, 1200000, false]]);
  // Hidden plans can't be bought
  assert.equal((await as(shopA.token).post("/api/subscriptions/checkout", { planCode: "growth-yearly" }, key())).status, 404);
});

test("billing settings: GSTIN sets the state, bad values are refused", async () => {
  const root = as(superToken);
  assert.equal((await root.put("/api/admin/billing-settings", { gstin: "123" })).status, 422);
  assert.equal((await root.put("/api/admin/billing-settings", { gstRatePct: 17 })).status, 422);
  assert.equal((await root.put("/api/admin/billing-settings", { gstin: "23ABCDE1234F1Z5", stateCode: "27" })).status, 422);
  const saved = await root.put("/api/admin/billing-settings", { legalName: "ChatShop AI Pvt Ltd", gstin: "23AAACC1234A1Z5", address: "Bhopal", sac: "998314" });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.stateCode, "23");
  assert.equal(saved.body.data.gstRegistered, true);
  assert.equal((await as(limitedToken).put("/api/admin/billing-settings", { graceDays: 5 })).status, 403);
});

test("checkout (test gateway): failed stays failed; success issues one paid invoice and turns the plan on", async () => {
  const shop = as(shopA.token);
  const before = await shop.get("/api/subscriptions/current");
  assert.equal(before.body.data.subscription.trial, true);

  const k = key();
  const start = await shop.post("/api/subscriptions/checkout", { planCode: "business" }, k);
  assert.equal(start.status, 201, JSON.stringify(start.body));
  assert.equal(start.body.data.amountPaise, 147382); // ₹1,249 + 18% GST
  assert.equal(start.body.data.gateway.mode, "MOCK");
  assert.equal(start.body.data.breakdown.taxPaise, 22482);
  // Same key: same payment, no second order
  const again = await shop.post("/api/subscriptions/checkout", { planCode: "business" }, k);
  assert.equal(again.body.data.paymentRef, start.body.data.paymentRef);
  assert.equal((await shop.post("/api/subscriptions/checkout", { planCode: "business" })).status, 400); // key required

  const failed = await shop.post(`/api/subscriptions/payments/${start.body.data.paymentRef}/test-result`, { outcome: "fail" });
  assert.equal(failed.body.data.status, "FAILED");
  assert.equal(failed.body.data.subscription.trial, true); // nothing changed

  const paid = await shop.post(`/api/subscriptions/payments/${start.body.data.paymentRef}/test-result`, { outcome: "success" });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.data.status, "CAPTURED");
  assert.match(paid.body.data.invoice.invoiceNo, new RegExp(`^CSA-${fy()}-\\d{6}$`));
  assert.equal(paid.body.data.invoice.paymentStatus, "PAID");
  const sub = paid.body.data.subscription;
  assert.equal(sub.plan, "business");
  assert.equal(sub.trial, false);
  assert.equal(sub.pricePaise, 124900);
  assert.ok(sub.daysLeft >= 28 && sub.daysLeft <= 31, `daysLeft ${sub.daysLeft}`);

  const list = await shop.get("/api/subscriptions/invoices");
  assert.equal(list.body.data.length, 1);
  const detail = await shop.get(`/api/subscriptions/invoices/${list.body.data[0]._id}`);
  const inv = detail.body.data.invoice;
  assert.equal(inv.grandTotalPaise, 147382);
  assert.equal(inv.cgstPaise + inv.sgstPaise, 22482); // same state (no GSTIN on shop A: supplier's state)
  assert.equal(inv.supplierSnapshot.gstin, "23AAACC1234A1Z5");
  assert.equal(inv.customerSnapshot.businessName, "Asha Mobiles");
  assert.equal(inv.lines[0].planCode, "business");

  // Another capture event for the same payment: counted once
  const payment = await models.PlatformPayment.findOne({ paymentRef: start.body.data.paymentRef });
  const { processGatewayEvent } = require("../src/billing/payments");
  const replay = await processGatewayEvent(capturedEvent(payment.gatewayOrderId, payment.amountPaise, payment.gatewayPaymentId), { gateway: "MOCK", eventId: "evt-replay-1", signatureVerified: true });
  assert.equal(replay.alreadyProcessed, true);
  assert.equal((await processGatewayEvent({}, { gateway: "MOCK", eventId: "evt-replay-1", signatureVerified: true })).duplicate, true);
  assert.equal(await models.PlatformInvoice.countDocuments({ merchantId: shopA.user.id }), 1);

  // Renewing the same plan extends from the current end date
  const renew = await shop.post("/api/subscriptions/checkout", { planCode: "business" }, key());
  assert.equal(renew.body.data.period.kind, "RENEWED");
  const renewed = await shop.post(`/api/subscriptions/payments/${renew.body.data.paymentRef}/test-result`, { outcome: "success" });
  assert.ok(renewed.body.data.subscription.daysLeft >= 58, `daysLeft ${renewed.body.data.subscription.daysLeft}`);
});

test("Razorpay webhook: signature checked on the raw body, amounts checked, each event once", async () => {
  process.env.PAYMENT_GATEWAY = "razorpay";
  let n = 0;
  const restore = stub(gateway, "createOrder", async ({ amountPaise }) => ({ id: `order_rzp_${++n}_${key().slice(0, 6)}`, amount: amountPaise, currency: "INR", gateway: "RAZORPAY" }));
  try {
    const shop = as(shopB.token);
    const mismatch = (await shop.post("/api/subscriptions/checkout", { planCode: "starter" }, key())).body.data;
    const good = (await shop.post("/api/subscriptions/checkout", { planCode: "starter" }, key())).body.data;
    assert.equal(good.gateway.mode, "RAZORPAY");

    // Bad signature: refused, nothing changes
    const forged = await signedWebhook(capturedEvent(good.orderId, good.amountPaise), { secret: "wrong" });
    assert.equal(forged.status, 401);
    assert.equal((await models.PlatformPayment.findOne({ paymentRef: good.paymentRef })).status, "CREATED");

    // Wrong amount: held for review, no plan
    const odd = await signedWebhook(capturedEvent(mismatch.orderId, 100));
    assert.equal(odd.status, 200, JSON.stringify(odd.body));
    assert.equal(odd.body.data.status, "REVIEW");
    assert.equal((await User.findById(shopB.user.id)).subscription.trial, true);

    // Browser return with a forged signature changes nothing
    const fake = await shop.post("/api/subscriptions/verify", { razorpay_order_id: good.orderId, razorpay_payment_id: "pay_x", razorpay_signature: "deadbeef" });
    assert.equal(fake.status, 400);
    // A real signature, but Razorpay says only "authorized": still processing
    const sig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${good.orderId}|pay_auth`).digest("hex");
    const restoreFetch = stub(gateway, "fetchPayment", async () => ({ id: "pay_auth", order_id: good.orderId, status: "authorized", amount: good.amountPaise, currency: "INR" }));
    const pending = await shop.post("/api/subscriptions/verify", { razorpay_order_id: good.orderId, razorpay_payment_id: "pay_auth", razorpay_signature: sig });
    restoreFetch();
    assert.equal(pending.body.data.processing, true);
    assert.equal(pending.body.data.status, "CREATED");

    // The signed webhook captures it, once
    const event = capturedEvent(good.orderId, good.amountPaise, "pay_good_1");
    const okHook = await signedWebhook(event, { eventId: "evt_good_1" });
    assert.equal(okHook.body.data.status, "CAPTURED");
    const dup = await signedWebhook(event, { eventId: "evt_good_1" });
    assert.equal(dup.body.data.duplicate, true);
    const invoices = await models.PlatformInvoice.find({ merchantId: shopB.user.id });
    assert.equal(invoices.length, 1);
    // Shop B is in another state: IGST
    assert.equal(invoices[0].igstPaise, 8982);
    assert.equal(invoices[0].cgstPaise, 0);
    assert.equal((await User.findById(shopB.user.id)).subscription.plan, "starter");

    // Unknown orders (not a ChatShop plan payment) are acknowledged and ignored
    const other = await signedWebhook(capturedEvent("order_someone_else", 500));
    assert.equal(other.status, 200);
    assert.match(other.body.data.ignored, /not a ChatShop/);
  } finally {
    restore();
    process.env.PAYMENT_GATEWAY = "mock";
  }
});

test("manual invoices: preview, issue once, numbers never repeat, partial and full payment, void", async () => {
  const root = as(superToken);
  const today = domain.istDate();
  const monthLater = domain.istDate(Date.now() + 30 * DAY_MS);
  const body = {
    merchantId: shopB.user.id,
    lines: [
      { kind: "SUBSCRIPTION", planCode: "premium", periodStart: today, periodEnd: monthLater },
      { kind: "CUSTOM", description: "Catalog import", unitPricePaise: 50000, discountPaise: 10000 },
    ],
    notes: "Negotiated",
  };
  const preview = await root.post("/api/admin/platform-invoices/preview", body);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.data.taxablePaise, 440000); // 4000 + 500 − 100
  assert.equal(preview.body.data.igstPaise, 79200);
  assert.equal(preview.body.data.grandTotalPaise, 519200);
  assert.equal((await root.post("/api/admin/platform-invoices/preview", { ...body, lines: [{ kind: "SUBSCRIPTION", planCode: "premium" }] })).status, 400);

  const k = key();
  const issued = await root.post("/api/admin/platform-invoices", body, k);
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  const again = await root.post("/api/admin/platform-invoices", body, k);
  assert.equal(again.body.data.invoiceNo, issued.body.data.invoiceNo);
  const invoiceId = issued.body.data._id;
  assert.equal(issued.body.data.paymentStatus, "UNPAID");

  // Shops only see their own platform invoices
  assert.equal((await as(shopA.token).get(`/api/subscriptions/invoices/${invoiceId}`)).status, 404);
  assert.equal((await as(shopB.token).get(`/api/subscriptions/invoices/${invoiceId}`)).status, 200);
  assert.equal((await as(limitedToken).post("/api/admin/platform-invoices", body, key())).status, 403);

  // Issued invoices can't be edited, only paid or voided
  await assert.rejects(models.PlatformInvoice.updateOne({ _id: invoiceId }, { grandTotalPaise: 1 }), /can't be edited/);
  await assert.rejects(models.PlatformInvoice.deleteOne({ _id: invoiceId }), /can't be edited/);

  // Money in by bank transfer: part, too much, then the rest
  const part = await root.post(`/api/admin/platform-invoices/${invoiceId}/payments`, { method: "BANK", amountPaise: 200000, reference: "UTR123" }, key());
  assert.equal(part.status, 201, JSON.stringify(part.body));
  let inv = (await root.get(`/api/admin/platform-invoices/${invoiceId}`)).body.data.invoice;
  assert.equal(inv.paymentStatus, "PARTIALLY_PAID");
  assert.equal(inv.balanceDuePaise, 319200);
  assert.equal((await User.findById(shopB.user.id)).subscription.plan, "starter"); // plan waits for full payment
  assert.equal((await root.post(`/api/admin/platform-invoices/${invoiceId}/payments`, { method: "BANK", amountPaise: 400000 }, key())).status, 422);
  await root.post(`/api/admin/platform-invoices/${invoiceId}/payments`, { method: "UPI", amountPaise: 319200 }, key());
  inv = (await root.get(`/api/admin/platform-invoices/${invoiceId}`)).body.data.invoice;
  assert.equal(inv.paymentStatus, "PAID");
  const sub = (await User.findById(shopB.user.id)).subscription;
  assert.equal(sub.plan, "premium");
  assert.equal(domain.istDate(sub.endDate), monthLater);

  assert.equal((await root.post(`/api/admin/platform-invoices/${invoiceId}/void`, { reason: "mistake" })).status, 409);
  const spare = await root.post("/api/admin/platform-invoices", { merchantId: shopA.user.id, lines: [{ kind: "ADDON", description: "Extra seat", unitPricePaise: 10000 }] }, key());
  const voided = await root.post(`/api/admin/platform-invoices/${spare.body.data._id}/void`, { reason: "Sent to the wrong shop" });
  assert.equal(voided.body.data.status, "VOID");

  // Five at once: five different numbers in one series
  const many = await Promise.all(Array.from({ length: 5 }, () => root.post("/api/admin/platform-invoices", { merchantId: shopA.user.id, lines: [{ kind: "CUSTOM", description: "Support", unitPricePaise: 1000 }] }, key())));
  const numbers = many.map((r) => r.body.data.invoiceNo);
  assert.equal(new Set(numbers).size, 5);
  numbers.forEach((no) => assert.match(no, new RegExp(`^CSA-${fy()}-\\d{6}$`)));
});

test("refunds: capped at what was paid, credit note linked; shop pays a due invoice online", async () => {
  const root = as(superToken);
  const manual = await models.PlatformPayment.findOne({ merchantId: shopB.user.id, gateway: "MANUAL", amountPaise: 200000 });
  assert.equal((await root.post(`/api/admin/platform-payments/${manual._id}/refunds`, { amountPaise: 200001, reason: "too much" }, key())).status, 422);
  const k = key();
  const refund = await root.post(`/api/admin/platform-payments/${manual._id}/refunds`, { amountPaise: 50000, reason: "Goodwill credit" }, k);
  assert.equal(refund.status, 201, JSON.stringify(refund.body));
  assert.equal(refund.body.data.status, "PROCESSED");
  assert.equal((await root.post(`/api/admin/platform-payments/${manual._id}/refunds`, { amountPaise: 50000, reason: "Goodwill credit" }, k)).body.data._id, refund.body.data._id);
  const note = await models.PlatformInvoice.findById(refund.body.data.creditNoteId);
  assert.equal(note.documentType, "CREDIT_NOTE");
  assert.match(note.invoiceNo, new RegExp(`^CN-CSA-${fy()}-\\d{6}$`));
  assert.equal(note.grandTotalPaise, 50000);
  assert.equal(note.taxablePaise + note.igstPaise, 50000);
  assert.equal(String(note.originalInvoiceId), String(manual.invoiceId));
  // What's left can be refunded, nothing more
  assert.equal((await root.post(`/api/admin/platform-payments/${manual._id}/refunds`, { amountPaise: 150001, reason: "rest" }, key())).status, 422);
  assert.equal((await root.post(`/api/admin/platform-payments/${manual._id}/refunds`, { amountPaise: 150000, reason: "rest" }, key())).status, 201);

  // Test-gateway payment refunds straight away
  const online = await models.PlatformPayment.findOne({ merchantId: shopA.user.id, gateway: "MOCK", status: "CAPTURED" });
  const r2 = await root.post(`/api/admin/platform-payments/${online._id}/refunds`, { amountPaise: 1000, reason: "test" }, key());
  assert.equal(r2.body.data.status, "PROCESSED");

  // A due invoice paid online by the shop
  const due = await root.post("/api/admin/platform-invoices", { merchantId: shopA.user.id, lines: [{ kind: "CUSTOM", description: "Training", unitPricePaise: 20000 }] }, key());
  const pay = await as(shopA.token).post(`/api/subscriptions/invoices/${due.body.data._id}/pay`, {}, key());
  assert.equal(pay.status, 201, JSON.stringify(pay.body));
  assert.equal(pay.body.data.amountPaise, 23600);
  assert.equal((await as(shopB.token).post(`/api/subscriptions/invoices/${due.body.data._id}/pay`, {}, key())).status, 404);
  const done = await as(shopA.token).post(`/api/subscriptions/payments/${pay.body.data.paymentRef}/test-result`, { outcome: "success" });
  assert.equal(done.body.data.invoice.paymentStatus, "PAID");
});

test("revenue overview adds up from platform records only; reconciliation finds and repairs problems", async () => {
  const root = as(superToken);
  // A shop's own sale is never ChatShop revenue
  await Order.create({ userId: shopA.user.id, customerId: new mongoose.Types.ObjectId(), orderNumber: "ORD-BIG", items: [{ name: "Phone", quantity: 1, price: 100000, total: 100000 }], subtotal: 100000, total: 100000, status: "delivered", paymentStatus: "paid", platform: "store" });

  const res = await root.get("/api/admin/revenue/overview");
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const o = res.body.data;
  const invoices = await models.PlatformInvoice.find({ documentType: "INVOICE", status: "ISSUED" });
  assert.equal(o.grossBilledPaise, invoices.reduce((s, i) => s + i.grandTotalPaise, 0));
  const notes = await models.PlatformInvoice.find({ documentType: "CREDIT_NOTE" });
  assert.equal(o.netBilledPaise, o.grossBilledPaise - notes.reduce((s, i) => s + i.grandTotalPaise, 0));
  const captured = await models.PlatformPayment.find({ status: "CAPTURED" });
  assert.equal(o.collectedPaise, captured.reduce((s, p) => s + p.amountPaise, 0));
  assert.equal(o.refundsPaise, 201000);
  assert.equal(o.netCollectionsPaise, o.collectedPaise - 201000);
  // Shop A pays Business (₹1,249), shop B Premium (₹4,000): before GST
  assert.equal(o.mrrPaise, 124900 + 400000);
  assert.equal(o.payingShops, 2);
  assert.equal(o.arrPaise, o.mrrPaise * 12);
  assert.equal(o.range.timezone, "Asia/Kolkata");

  // Reconciliation: a stuck order, the amount mismatch, a half-done capture
  await models.PlatformPayment.collection.insertOne({ paymentRef: "PAY-STUCK-1", merchantId: new mongoose.Types.ObjectId(shopA.user.id), purpose: "SUBSCRIPTION_CHECKOUT", gateway: "MOCK", gatewayOrderId: "order_stuck", amountPaise: 1000, currency: "INR", status: "CREATED", refundedPaise: 0, refundReservedPaise: 0, createdAt: new Date(Date.now() - 2 * 3600 * 1000), updatedAt: new Date() });
  const half = await models.PlatformPayment.create({
    paymentRef: "PAY-HALF-1",
    merchantId: shopB.user.id,
    purpose: "SUBSCRIPTION_CHECKOUT",
    plan: { code: "premium", version: 1, name: "Premium", interval: "MONTHLY", pricePaise: 400000, tax: { gstRegistered: true, gstRatePct: 18, pricesIncludeGst: false } },
    gateway: "MOCK",
    gatewayOrderId: "order_half",
    gatewayPaymentId: "pay_half",
    amountPaise: 472000,
    status: "CAPTURED",
    capturedAt: new Date(),
  });
  const rec = (await root.get("/api/admin/revenue/reconciliation")).body.data;
  assert.ok(rec.stuckPayments.some((p) => p.paymentRef === "PAY-STUCK-1"));
  assert.ok(rec.reviewPayments.some((p) => p.status === "REVIEW"));
  assert.ok(rec.unfinishedCaptures.some((p) => p.paymentRef === "PAY-HALF-1"));
  assert.equal(rec.invoiceMismatches.length, 0);

  const repaired = await root.post(`/api/admin/platform-payments/${half._id}/sync`);
  assert.equal(repaired.body.data.action, "repaired");
  assert.ok(await models.PlatformInvoice.exists({ paymentId: half._id }));
  const after = (await root.get("/api/admin/revenue/reconciliation")).body.data;
  assert.ok(!after.unfinishedCaptures.some((p) => p.paymentRef === "PAY-HALF-1"));

  // CSV export: permission-checked, says when and with which filters
  const csv = await root.get("/api/admin/revenue/export/invoices?from=2020-01-01");
  assert.equal(csv.status, 200);
  assert.match(csv.text, /# Generated /);
  assert.match(csv.text, /# Filters: from 2020-01-01/);
  assert.match(csv.text, /Credit note/);
  assert.equal((await as(limitedToken).get("/api/admin/revenue/export/invoices")).status, 403);
  assert.equal((await as(limitedToken).get("/api/admin/revenue/overview")).status, 403);
});

test("cancel at period end, grace period and expiry; data is never deleted", async () => {
  const root = as(superToken);
  const shop = as(shopA.token);
  const cancel = await shop.post("/api/subscriptions/cancel");
  assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
  assert.equal(cancel.body.data.cancelAtPeriodEnd, true);
  assert.equal(cancel.body.data.status, "active"); // until the end date
  assert.equal((await shop.post("/api/subscriptions/resume")).body.data.cancelAtPeriodEnd, false);
  await shop.post("/api/subscriptions/cancel");

  await root.put("/api/admin/billing-settings", { graceDays: 3 });
  const inGrace = await registerUser(app, { name: "Grace" });
  const lapsed = await registerUser(app, { name: "Lapsed" });
  const paidFields = { "subscription.plan": "starter", "subscription.trial": false, "subscription.interval": "MONTHLY", "subscription.pricePaise": 49900 };
  await User.updateOne({ _id: inGrace.user.id }, { ...paidFields, "subscription.endDate": new Date(Date.now() - 2 * DAY_MS) });
  await User.updateOne({ _id: lapsed.user.id }, { ...paidFields, "subscription.endDate": new Date(Date.now() - 4 * DAY_MS) });
  const trialOver = await registerUser(app, { name: "Trial over" });
  await User.updateOne({ _id: trialOver.user.id }, { "subscription.endDate": new Date(Date.now() - 60 * 1000) });
  await User.updateOne({ _id: shopA.user.id }, { "subscription.endDate": new Date(Date.now() - 60 * 1000) });
  await Product.create({ userId: lapsed.user.id, name: "Kept", price: 10 });

  const run = await root.post("/api/admin/revenue/expiry/run");
  assert.equal(run.status, 200, JSON.stringify(run.body));
  const status = async (u) => (await User.findById(u.user.id)).subscription.status;
  assert.equal(await status(shopA), "cancelled");
  assert.equal(await status(inGrace), "active");
  assert.equal(await status(lapsed), "expired");
  assert.equal(await status(trialOver), "expired");
  assert.equal((await as(inGrace.token).get("/api/subscriptions/current")).body.data.subscription.inGrace, true);
  assert.ok(await Product.exists({ userId: lapsed.user.id }));
  const events = await models.SubscriptionEvent.find({ merchantId: lapsed.user.id });
  assert.ok(events.some((e) => e.type === "EXPIRED"));
  // Running it again changes nothing
  const twice = (await root.post("/api/admin/revenue/expiry/run")).body.data;
  assert.equal(twice.expired + twice.cancelled, 0);

  // An expired shop can buy again
  const back = await as(lapsed.token).post("/api/subscriptions/checkout", { planCode: "starter" }, key());
  const paid = await as(lapsed.token).post(`/api/subscriptions/payments/${back.body.data.paymentRef}/test-result`, { outcome: "success" });
  assert.equal(paid.body.data.subscription.status, "active");
});

test("plan limits are enforced on the server", async () => {
  const root = as(superToken);
  await root.patch("/api/admin/plans/premium", { limits: { products: 1 } });
  const shop = await registerUser(app, { name: "Limited" }); // premium trial
  const first = await as(shop.token).post("/api/products", { name: "One", price: 100, stock: 1 });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const second = await as(shop.token).post("/api/products", { name: "Two", price: 100, stock: 1 });
  assert.equal(second.status, 403);
  assert.match(second.body.message, /allows 1 products/);
  await root.patch("/api/admin/plans/premium", { limits: { products: null } });
  assert.equal((await as(shop.token).post("/api/products", { name: "Two", price: 100, stock: 1 })).status, 201);
});

test("merchant-only routes: staff-free, admin-free, and the old /details name still works", async () => {
  assert.equal((await as(superToken).get("/api/subscriptions/current")).status, 403);
  assert.equal((await as(shopB.token).get("/api/subscriptions/details")).status, 200);
  assert.equal((await request(app).get("/api/subscriptions/current")).status, 401);
  const detail = await as(superToken).get(`/api/admin/merchants/${shopB.user.id}/billing`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.subscription.plan, "premium");
  assert.ok(detail.body.data.events.length > 0);
});
