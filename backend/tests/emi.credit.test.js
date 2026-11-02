// Pay-later (udhaar) sales: paid / partly paid / due, collected later
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

let app, models, platform;
const L = (rupees) => Math.round(rupees * 100);
const key = () => crypto.randomUUID();

before(async () => {
  app = await startApp("chatshop_test_emi_credit");
  models = {
    Product: require("../src/models/Product.model"),
    User: require("../src/models/User.model"),
    Order: require("../src/models/Order.model"),
    ...require("../src/emi/models/finance"),
    ...require("../src/emi/models/sales"),
  };
  const root = await registerUser(app, { name: "Platform", email: "root-credit@example.com" });
  await models.User.updateOne({ _id: root.user.id }, { role: "admin" });
  platform = as(root.token);
});
after(stopApp);

const as = (token) => ({
  get: (url) => request(app).get(`/api/emi${url}`).set("Authorization", `Bearer ${token}`),
  post: (url, body, k) => {
    const r = request(app).post(`/api/emi${url}`).set("Authorization", `Bearer ${token}`);
    if (k) r.set("Idempotency-Key", k);
    return r.send(body);
  },
  patch: (url, body) => request(app).patch(`/api/emi${url}`).set("Authorization", `Bearer ${token}`).send(body),
  put: (url, body) => request(app).put(`/api/emi${url}`).set("Authorization", `Bearer ${token}`).send(body),
});

// An approved shop with a ₹1,000 product (10 in stock) and a customer without KYC
async function setupShop(name) {
  const { token, user } = await registerUser(app, { businessName: name });
  const tenantId = user.id || user._id;
  const owner = as(token);
  assert.equal((await owner.get("/me")).status, 403); // first visit asks the Super Admin
  assert.equal((await platform.patch(`/super/tenants/${tenantId}`, { status: "ACTIVE" })).status, 200);
  const store = (await owner.get("/me")).body.data.stores[0];
  const product = await models.Product.create({ userId: tenantId, name: "Cement bag", price: 1000, hsn: "2523", gstRatePct: 28, stock: 10 });
  const customer = (await owner.post("/customers", { name: "Mohan Lal", phone: `98${Math.floor(10000000 + Math.random() * 89999999)}` })).body.data;
  return { owner, store, product, customer, tenantId };
}

const sale = (s, { qty = 1, payments = [], dueDate } = {}) => ({
  customerId: s.customer._id,
  items: [{ productId: String(s.product._id), qty }],
  payments,
  finance: { type: "CREDIT", ...(dueDate && { dueDate }) },
});

test("pay later: partly paid now, rest collected later until paid; ledger and order follow", async () => {
  const s = await setupShop("Sharma Cement");

  // ₹1,000 × 2, ₹300 by UPI now, ₹1,700 later; no KYC needed under the usual limit
  const created = await s.owner.post(`/stores/${s.store._id}/checkout`, sale(s, { qty: 2, payments: [{ method: "UPI", amount: L(300), txnRef: "UPI1" }] }), key());
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.status, "PARTIALLY_PAID");
  const invoiceId = created.body.data.invoiceId;

  let inv = (await s.owner.get(`/invoices/${invoiceId}`)).body.data.invoice;
  assert.equal(inv.financeType, "CREDIT");
  assert.equal(inv.amountPaid, L(300));
  assert.equal(inv.balanceDue, L(1700));
  assert.ok(inv.dueDate > inv.date); // default due days
  assert.equal(inv.overdue, false);
  const order = await models.Order.findOne({ invoiceId });
  assert.equal(order.paymentStatus, "pending");

  // More than is owed: refused. Then ₹1,000 cash, retried with the same key
  assert.equal((await s.owner.post(`/invoices/${invoiceId}/payments`, { method: "CASH", amount: L(1800) }, key())).status, 422);
  assert.equal((await s.owner.post(`/invoices/${invoiceId}/payments`, { method: "CASH", amount: L(10) })).status, 400); // key required
  const k = key();
  const first = await s.owner.post(`/invoices/${invoiceId}/payments`, { method: "CASH", amount: L(1000) }, k);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.data.invoice.balanceDue, L(700));
  assert.equal(first.body.data.invoice.status, "PARTIALLY_PAID");
  const retry = await s.owner.post(`/invoices/${invoiceId}/payments`, { method: "CASH", amount: L(1000) }, k);
  assert.equal(retry.body.data.duplicate, true);

  // Another shop can't touch it
  const other = await setupShop("Other Shop");
  assert.equal((await other.owner.post(`/invoices/${invoiceId}/payments`, { method: "CASH", amount: L(100) }, key())).status, 404);

  const last = await s.owner.post(`/invoices/${invoiceId}/payments`, { method: "BANK", amount: L(700), txnRef: "NEFT9" }, key());
  assert.equal(last.body.data.invoice.status, "PAID");
  assert.equal(last.body.data.invoice.balanceDue, 0);
  assert.equal((await s.owner.post(`/invoices/${invoiceId}/payments`, { method: "CASH", amount: L(1) }, key())).status, 409);
  assert.equal((await models.Order.findOne({ invoiceId })).paymentStatus, "paid");

  // Every rupee owed came in: the customer receivable for this sale is zero
  const payments = await models.Payment.find({ tenantId: s.tenantId, invoiceId });
  assert.deepEqual(payments.map((p) => p.purpose).sort(), ["DUE", "DUE", "SALE"]);
  const journals = await models.JournalEntry.find({ tenantId: s.tenantId, refId: { $in: [invoiceId, ...payments.map((p) => p._id)] } });
  const receivable = journals.flatMap((j) => j.lines).filter((l) => l.account === "1100").reduce((t, l) => t + l.dr - l.cr, 0);
  assert.equal(receivable, 0);
});

test("pay later: nothing paid now, due date rules, dues list, overdue, reminders, cancel", async () => {
  const s = await setupShop("Verma Traders");
  const late = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
  const bad = await s.owner.post(`/stores/${s.store._id}/checkout`, sale(s, { dueDate: late }), key());
  assert.equal(bad.status, 422);
  assert.match(bad.body.message, /din ke andar/);
  const past = await s.owner.post(`/stores/${s.store._id}/checkout`, sale(s, { dueDate: "2020-01-01" }), key());
  assert.equal(past.status, 422);
  // Pay later with everything paid isn't pay later
  const full = await s.owner.post(`/stores/${s.store._id}/checkout`, sale(s, { payments: [{ method: "UPI", amount: L(1000) }] }), key());
  assert.equal(full.status, 422);

  const unpaid = await s.owner.post(`/stores/${s.store._id}/checkout`, sale(s), key());
  assert.equal(unpaid.status, 201, JSON.stringify(unpaid.body));
  assert.equal(unpaid.body.data.status, "UNPAID");
  const second = await s.owner.post(`/stores/${s.store._id}/checkout`, sale(s, { payments: [{ method: "CASH", amount: L(200) }] }), key());

  // Make the first one overdue
  await models.Invoice.updateOne({ tenantId: s.tenantId, _id: unpaid.body.data.invoiceId }, { dueDate: "2024-01-01" });
  const dues = (await s.owner.get("/dues")).body.data;
  assert.equal(dues.totals.count, 2);
  assert.equal(dues.totals.balanceDue, L(1000) + L(800));
  assert.equal(dues.totals.overdueCount, 1);
  assert.equal(dues.rows[0].overdue, true);
  assert.ok(dues.rows[0].daysOverdue > 300);
  assert.equal((await s.owner.get("/dues?overdue=true")).body.data.rows.length, 1);
  assert.equal((await s.owner.get("/invoices?overdue=true")).body.data.length, 1);
  const dash = (await s.owner.get("/reports/dashboard")).body.data;
  assert.equal(dash.dues.amount, L(1800));
  assert.equal(dash.dues.overdueAmount, L(1000));

  // WhatsApp reminder: queued once a day
  const remind = await s.owner.post(`/invoices/${unpaid.body.data.invoiceId}/remind`, {});
  assert.equal(remind.status, 201, JSON.stringify(remind.body));
  assert.equal((await s.owner.post(`/invoices/${unpaid.body.data.invoiceId}/remind`, {})).status, 409);
  const note = await models.Notification.findOne({ tenantId: s.tenantId, template: "DUE_REMINDER" });
  assert.equal(note.payload.amount, "₹1,000.00");

  // Cancelling a partly paid credit sale reverses its payments and puts stock back
  const before = (await models.Product.findById(s.product._id)).stock;
  const req = await s.owner.post(`/invoices/${second.body.data.invoiceId}/cancel-request`, { reason: "returned" });
  assert.equal(req.status, 201, JSON.stringify(req.body));
  assert.equal((await s.owner.post(`/approvals/${req.body.data._id}/decide`, { decision: "APPROVED", note: "ok" })).status, 200);
  assert.equal((await models.Product.findById(s.product._id)).stock, before + 1);
  const reversed = await models.Payment.find({ tenantId: s.tenantId, invoiceId: second.body.data.invoiceId });
  assert.ok(reversed.every((p) => p.status === "REVERSED"));
  assert.equal((await s.owner.post(`/invoices/${second.body.data.invoiceId}/payments`, { method: "CASH", amount: L(1) }, key())).status, 409);
});

test("pay later can be turned off in the shop's settings", async () => {
  const s = await setupShop("No Credit Store");
  const res = await s.owner.put("/settings/tenant", { credit: { enabled: false } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const blocked = await s.owner.post(`/stores/${s.store._id}/checkout`, sale(s), key());
  assert.equal(blocked.status, 422);
  assert.match(blocked.body.message, /band hai/);
});
