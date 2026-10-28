// EMI & billing end to end through the HTTP API, on a real MongoDB.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

let app;
let models;
const L = (rupees) => Math.round(rupees * 100);

before(async () => {
  app = await startApp("chatshop_test_emi_api");
  models = {
    Product: require("../src/models/Product.model"),
    User: require("../src/models/User.model"),
    Order: require("../src/models/Order.model"),
    ...require("../src/emi/models/finance"),
    ...require("../src/emi/models/sales"),
  };
});
after(stopApp);

const as = (token) => ({
  get: (url) => request(app).get(`/api/emi${url}`).set("Authorization", `Bearer ${token}`),
  post: (url, body, key) => {
    const req = request(app).post(`/api/emi${url}`).set("Authorization", `Bearer ${token}`);
    if (key) req.set("Idempotency-Key", key);
    return req.send(body);
  },
  patch: (url, body) => request(app).patch(`/api/emi${url}`).set("Authorization", `Bearer ${token}`).send(body),
});

const login = async (email, password) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.token;
};

// A shop with a store, a ₹10L phone with IMEIs, a KYC-verified customer
async function setupShop() {
  const { token, user } = await registerUser(app, { businessName: "Bhopal Mobiles" });
  const owner = as(token);
  const me = await owner.get("/me");
  assert.equal(me.status, 200, JSON.stringify(me.body));
  const store = me.body.data.stores[0];
  assert.equal(me.body.data.isOwner, true);

  const phone = await models.Product.create({ userId: user.id || user._id, name: "Galaxy S24 Ultra", price: 1000000, hsn: "8517", gstRatePct: 18, serialized: true });
  const added = await owner.post(`/stores/${store._id}/inventory`, { productId: String(phone._id), imeis: ["IMEI-001", "IMEI-002", "IMEI-003", "IMEI-004"] });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.equal(added.body.data.added, 4);

  const created = await owner.post("/customers", { name: "Ravi Kumar", phone: "98765 43210", pan: "ABCDE1234F", stateCode: "23" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const customer = created.body.data;
  assert.equal(customer.phone, "+919876543210");
  const kyc = await owner.patch(`/customers/${customer._id}/kyc`, { kycStatus: "VERIFIED" });
  assert.equal(kyc.status, 200, JSON.stringify(kyc.body));

  return { token, owner, store, phone, customer, tenantId: user.id || user._id };
}

const caseB = (s, imei) => ({
  customerId: s.customer._id,
  items: [{ productId: String(s.phone._id), imei }],
  payments: [{ method: "CREDIT_CARD", amount: L(500000), txnRef: `TXN-${imei}` }],
  finance: { type: "SHOP_EMI", principal: L(500000), annualRatePct: 18, tenureMonths: 12 },
});

test("Case B end to end: sale, idempotency, IMEI, EMI, late fee, ledger zero, cancel blocked", async () => {
  const s = await setupShop();

  // Same phone typed differently is the same customer
  const dupe = await s.owner.post("/customers", { name: "Ravi again", phone: "+91 98765-43210" });
  assert.equal(dupe.status, 409);
  assert.equal(dupe.body.data.customerId, s.customer._id);

  const sale = await s.owner.post(`/stores/${s.store._id}/checkout`, caseB(s, "IMEI-001"), "key-1");
  assert.equal(sale.status, 201, JSON.stringify(sale.body));
  const inv = sale.body.data;
  assert.equal(inv.status, "EMI_ACTIVE");
  assert.match(inv.invoiceNo, /-000001$/);

  // Same Idempotency-Key: the first sale again, nothing new
  const again = await s.owner.post(`/stores/${s.store._id}/checkout`, caseB(s, "IMEI-001"), "key-1");
  assert.equal(again.status, 200);
  assert.equal(again.body.data.duplicate, true);
  assert.equal(again.body.data.invoiceNo, inv.invoiceNo);

  // Same IMEI with a new key: already sold
  const sameImei = await s.owner.post(`/stores/${s.store._id}/checkout`, caseB(s, "IMEI-001"), "key-2");
  assert.equal(sameImei.status, 409);

  // The sale is a ChatShop order too
  const order = await models.Order.findOne({ invoiceId: inv.invoiceId });
  assert.equal(order.platform, "store");
  assert.equal(order.total, 1000000);
  assert.equal(order.paymentStatus, "paid");

  // GST invoice
  const detail = await s.owner.get(`/invoices/${inv.invoiceId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.invoice.cgst, L(76271.19));
  assert.equal(detail.body.data.invoice.sgst, L(76271.18));
  assert.equal(detail.body.data.contract.emiAmount, L(45840));
  const card = detail.body.data.payments[0];
  assert.equal(card.status, "CAPTURED");
  assert.equal(card.netSettled, L(491150));

  // Card money reaches the bank
  const settled = await s.owner.post(`/payments/${card._id}/settle`, {});
  assert.equal(settled.status, 200, JSON.stringify(settled.body));

  // First EMI, paid in cash
  const contractId = inv.emiContractId;
  const pay1 = await s.owner.post(`/emi/${contractId}/payments`, { method: "CASH", amount: L(45840) }, "emi-1");
  assert.equal(pay1.status, 201, JSON.stringify(pay1.body));
  const alloc = pay1.body.data.payment.allocations[0];
  assert.equal(alloc.no, 1);
  assert.equal(alloc.principal + alloc.interest + alloc.interestGst, L(45840));
  assert.equal(alloc.interest + alloc.interestGst, L(7500), "first month interest = 1.5% of ₹5L");
  const payDupe = await s.owner.post(`/emi/${contractId}/payments`, { method: "CASH", amount: L(45840) }, "emi-1");
  assert.equal(payDupe.body.data.duplicate, true);

  // Once an EMI has come in, the sale cannot be cancelled
  const cancel = await s.owner.post(`/invoices/${inv.invoiceId}/cancel-request`, { reason: "customer changed mind" });
  assert.equal(cancel.status, 409);

  // Installment 2 unpaid 12 days after its due date: one late fee, once
  const { runOverdueJob } = require("../src/emi/services/emi.service");
  const inst2 = await models.EmiInstallment.findOne({ tenantId: s.tenantId, contractId, no: 2 });
  const asOf = new Date(Date.parse(`${inst2.dueDate}T00:00:00Z`) + 12 * 86400000).toISOString().slice(0, 10);
  const job = await runOverdueJob(asOf);
  assert.equal(job.lateFees, 1);
  assert.equal(job.lateFeeTotal, L(500));
  const rerun = await runOverdueJob(asOf);
  assert.equal(rerun.lateFees, 0, "late fee is applied only once");
  const overdueView = await s.owner.get("/emi?view=overdue");
  assert.equal(overdueView.body.data.length, 1);
  assert.equal(overdueView.body.data[0].bucket, "1-30");
  assert.ok(await models.Notification.exists({ tenantId: s.tenantId, template: "LATE_FEE_NOTICE" }), "late fee reminder queued");

  // Reminders go out on the shop's WhatsApp; this shop has not connected it
  const { processNotifications } = require("../src/emi/services/notify.service");
  const sent = await processNotifications();
  assert.ok(sent.failed >= 1);
  assert.match((await models.Notification.findOne({ tenantId: s.tenantId, status: "FAILED" })).error, /WhatsApp connect/);

  // Pay off everything left (late fee included) in one go
  const detail2 = await s.owner.get(`/emi/${contractId}`);
  const left = detail2.body.data.installments.reduce((sum, i) => sum + i.unpaid, 0);
  const payAll = await s.owner.post(`/emi/${contractId}/payments`, { method: "BANK", amount: left }, "emi-all");
  assert.equal(payAll.status, 201, JSON.stringify(payAll.body));
  assert.equal(payAll.body.data.contract.status, "CLOSED");
  const closedInvoice = await s.owner.get(`/invoices/${inv.invoiceId}`);
  assert.equal(closedInvoice.body.data.invoice.status, "EMI_CLOSED");

  // The books: balanced, every receivable back to zero
  const tb = await s.owner.get("/reports/trial-balance");
  assert.equal(tb.status, 200);
  assert.ok(tb.body.data.balanced);
  for (const account of ["1100", "1200", "1300", "1310", "1320", "1400"]) {
    const row = tb.body.data.rows.find((r) => r.account === account);
    assert.equal(row?.balance || 0, 0, `account ${account} is zero`);
  }

  // Journals cannot be edited or deleted
  await assert.rejects(models.JournalEntry.updateOne({ tenantId: s.tenantId }, { date: "2000-01-01" }), /reversal/);
  await assert.rejects(models.JournalEntry.deleteMany({ tenantId: s.tenantId }), /reversal/);
  await assert.rejects(models.JournalEntry.find({}), /tenantId/, "queries without tenantId are blocked");

  // GST report for the sale month
  const gst = await s.owner.get(`/reports/gst?month=${inv.invoiceNo ? detail.body.data.invoice.date.slice(0, 7) : ""}`);
  assert.equal(gst.status, 200);
  assert.ok(gst.body.data.output.cgst >= L(76271.19));
});

test("Case A approval: ₹10L EMI waits for a Store Admin, cashier cannot approve", async () => {
  const s = await setupShop();

  const mk = async (email, role) => {
    const res = await s.owner.post("/users", { name: role, email, password: "Password@123", roles: [{ role, storeId: s.store._id }] });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return as(await login(email, "Password@123"));
  };
  const cashier = await mk(`cashier-${Date.now()}@crm.local`, "CASHIER");
  const storeAdmin = await mk(`admin-${Date.now()}@crm.local`, "STORE_ADMIN");

  const sale = await cashier.post(
    `/stores/${s.store._id}/checkout`,
    { customerId: s.customer._id, items: [{ productId: String(s.phone._id), imei: "IMEI-002" }], finance: { type: "SHOP_EMI", principal: L(1000000), tenureMonths: 12 } },
    "case-a"
  );
  assert.equal(sale.status, 201, JSON.stringify(sale.body));
  assert.equal(sale.body.data.status, "PENDING_APPROVAL");
  assert.equal(sale.body.data.needsApproval, true);

  const pending = await storeAdmin.get("/approvals");
  assert.equal(pending.body.data.length, 1);
  const approval = pending.body.data[0];
  assert.equal(approval.type, "HIGH_EMI");
  assert.equal(approval.canDecide, true);

  const byCashier = await cashier.post(`/approvals/${approval._id}/decide`, { decision: "APPROVED" });
  assert.equal(byCashier.status, 403);

  const decided = await storeAdmin.post(`/approvals/${approval._id}/decide`, { decision: "APPROVED", note: "KYC dekha" });
  assert.equal(decided.status, 200, JSON.stringify(decided.body));
  const contract = await storeAdmin.get(`/emi/${sale.body.data.emiContractId}`);
  assert.equal(contract.body.data.contract.status, "ACTIVE");
  assert.equal(contract.body.data.contract.emiAmount, L(91680));

  // A cashier below list price needs a Store Admin; cash ≥ ₹2L is refused
  const discount = await cashier.post(
    `/stores/${s.store._id}/checkout`,
    { customerId: s.customer._id, items: [{ productId: String(s.phone._id), imei: "IMEI-003", price: L(900000) }], payments: [{ method: "UPI", amount: L(900000) }] },
    "disc"
  );
  assert.equal(discount.status, 422);
  assert.match(discount.body.message, /Store Admin/);
  const cash = await cashier.post(
    `/stores/${s.store._id}/checkout`,
    { customerId: s.customer._id, items: [{ productId: String(s.phone._id), imei: "IMEI-003" }], payments: [{ method: "CASH", amount: L(1000000) }] },
    "cash"
  );
  assert.equal(cash.status, 422);
  assert.ok(cash.body.errors.some((e) => /cash/i.test(e)));

  // Staff only reach EMI & billing, never the rest of ChatShop
  const orders = await request(app).get("/api/orders").set("Authorization", `Bearer ${await login((await models.User.findOne({ role: "staff", "emiRoles.role": "CASHIER" })).email, "Password@123")}`);
  assert.equal(orders.status, 403);
});

test("Shops are isolated; NBFC payout; invoice cancel puts stock back", async () => {
  const a = await setupShop();
  const b = await setupShop();

  const partner = await models.NbfcPartner.create({ name: "Demo Finance", subventionPct: 3 });
  const sale = await a.owner.post(
    `/stores/${a.store._id}/checkout`,
    { customerId: a.customer._id, items: [{ productId: String(a.phone._id), imei: "IMEI-004" }], payments: [{ method: "UPI", amount: L(200000) }], finance: { type: "NBFC", partnerId: String(partner._id), loanAmount: L(800000), tenureMonths: 12 } },
    "nbfc-1"
  );
  assert.equal(sale.status, 201, JSON.stringify(sale.body));
  assert.equal(sale.body.data.status, "NBFC_PENDING");

  // Another shop cannot see it
  assert.equal((await b.owner.get(`/invoices/${sale.body.data.invoiceId}`)).status, 404);
  assert.equal((await b.owner.get("/invoices")).body.data.length, 0);

  const caseId = sale.body.data.nbfcCaseId;
  const nbfcCase = (await a.owner.get("/nbfc")).body.data[0];
  assert.equal(nbfcCase.expectedPayout, L(771680));
  assert.equal((await a.owner.post(`/nbfc/${caseId}/status`, { status: "DISBURSED" })).status, 409, "must follow the flow");
  for (const step of [{ status: "APPROVED" }, { status: "DO_RECEIVED", doNumber: "DO-778" }, { status: "DISBURSED" }]) {
    const res = await a.owner.post(`/nbfc/${caseId}/status`, step);
    assert.equal(res.status, 200, JSON.stringify(res.body));
  }
  assert.equal((await a.owner.get(`/invoices/${sale.body.data.invoiceId}`)).body.data.invoice.status, "PAID");

  // A plain UPI sale, cancelled through approval: IMEI back in stock, order cancelled
  await a.owner.post(`/stores/${a.store._id}/inventory`, { productId: String(a.phone._id), imeis: ["IMEI-900"] });
  const plain = await a.owner.post(
    `/stores/${a.store._id}/checkout`,
    { customerId: a.customer._id, items: [{ productId: String(a.phone._id), imei: "IMEI-900" }], payments: [{ method: "UPI", amount: L(1000000) }] },
    "plain-1"
  );
  assert.equal(plain.status, 201, JSON.stringify(plain.body));
  const req = await a.owner.post(`/invoices/${plain.body.data.invoiceId}/cancel-request`, { reason: "galat model" });
  assert.equal(req.status, 201);
  const decide = await a.owner.post(`/approvals/${req.body.data._id}/decide`, { decision: "APPROVED", note: "ok" });
  assert.equal(decide.status, 200, JSON.stringify(decide.body));
  const unit = await models.InventoryItem.findOne({ tenantId: a.tenantId, imei: "IMEI-900" });
  assert.equal(unit.status, "IN_STOCK");
  const order = await models.Order.findOne({ invoiceId: plain.body.data.invoiceId });
  assert.equal(order.status, "cancelled");

  const tb = (await a.owner.get("/reports/trial-balance")).body.data;
  assert.ok(tb.balanced);
  for (const account of ["1100", "1400"]) assert.equal(tb.rows.find((r) => r.account === account)?.balance || 0, 0);
});

test("Both admin panels see every shop's billing; only the Super Admin changes it", async () => {
  const s = await setupShop();
  const sale = await s.owner.post(`/stores/${s.store._id}/checkout`, caseB(s, "IMEI-003"), "admin-view");
  assert.equal(sale.status, 201, JSON.stringify(sale.body));

  // One admin email: main password = Super Admin, panel password = limited Admin
  const admin = await registerUser(app, { name: "Platform Admin", email: `admin-${Date.now()}@example.com` });
  await models.User.updateOne({ _id: admin.user.id }, { role: "admin" });
  const set = await request(app).put("/api/admin/admin-panel").set("Authorization", `Bearer ${admin.token}`).send({ password: "Panel@789" });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  const superAdmin = as(await login(admin.user.email, "Password123"));
  const limited = as(await login(admin.user.email, "Panel@789"));

  for (const panel of [superAdmin, limited]) {
    const invoices = await panel.get(`/super/invoices?tenantId=${s.tenantId}`);
    assert.equal(invoices.status, 200, JSON.stringify(invoices.body));
    assert.equal(invoices.body.data.length, 1);
    assert.equal(invoices.body.data[0].tenantName, "Bhopal Mobiles");
    const detail = await panel.get(`/super/invoices/${sale.body.data.invoiceId}`);
    assert.equal(detail.body.data.contract.emiAmount, L(45840));
    const contracts = await panel.get(`/super/emi?tenantId=${s.tenantId}`);
    assert.equal(contracts.body.data.length, 1);
    const contract = await panel.get(`/super/emi/${contracts.body.data[0]._id}`);
    assert.equal(contract.body.data.installments.length, 12);
    assert.equal((await panel.get("/super/payments")).status, 200);
    assert.equal((await panel.get("/super/dashboard")).status, 200);
  }

  // Changes and the audit log stay with the Super Admin
  assert.equal((await limited.patch(`/super/tenants/${s.tenantId}`, { status: "SUSPENDED", reason: "test" })).status, 403);
  assert.equal((await limited.get("/super/audit")).status, 403);
  assert.equal((await limited.post("/super/jobs/overdue/run", {})).status, 403);
  const suspend = await superAdmin.patch(`/super/tenants/${s.tenantId}`, { status: "SUSPENDED", reason: "KYC audit" });
  assert.equal(suspend.status, 200);
  assert.equal((await s.owner.get("/me")).status, 403, "a suspended shop is locked out");
  await superAdmin.patch(`/super/tenants/${s.tenantId}`, { status: "ACTIVE" });
  assert.equal((await s.owner.get("/me")).status, 200);
});

test("Gateway webhook needs a valid signature", async () => {
  process.env.EMI_WEBHOOK_SECRET = "hook-secret";
  const body = JSON.stringify({ event: "payment.settled", txnRef: "nothing" });
  const bad = await request(app).post("/api/emi/webhooks/gateway").set("Content-Type", "application/json").set("x-signature", "deadbeef").send(body);
  assert.equal(bad.status, 401);
  const sig = require("crypto").createHmac("sha256", "hook-secret").update(body).digest("hex");
  const good = await request(app).post("/api/emi/webhooks/gateway").set("Content-Type", "application/json").set("x-signature", sig).send(body);
  assert.equal(good.status, 200);
  assert.equal(good.body.data.settled, 0);
});
