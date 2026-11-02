// Each shop has its own Admin, who sees only that shop's data
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

let app, models, root, cement, kirana, adminToken, adminId;

const as = (token) => ({
  get: (url) => request(app).get(url).set("Authorization", `Bearer ${token}`),
  post: (url, body) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body || {}),
  put: (url, body) => request(app).put(url).set("Authorization", `Bearer ${token}`).send(body || {}),
  patch: (url, body) => request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body || {}),
});

// A shop with a customer, a product, an order, a chat and an EMI invoice
async function shopWithData(name) {
  const shop = await registerUser(app, { name, businessName: name });
  const userId = shop.user.id;
  const customer = await models.Customer.create({ userId, name: `${name} customer`, phone: `+9198${Math.floor(10000000 + Math.random() * 8e7)}`, platform: "whatsapp" });
  await models.Product.create({ userId, name: `${name} product`, price: 100 });
  await models.Order.create({ userId, customerId: customer._id, orderNumber: `${name}-ORD-1`, items: [{ name: "x", quantity: 1, price: 100, total: 100 }], subtotal: 100, total: 100, status: "delivered", paymentStatus: "paid", platform: "store" });
  const conversation = await models.Conversation.create({ userId, customerId: customer._id, platform: "whatsapp", lastMessage: { content: "hello", timestamp: new Date() } });
  await models.Tenant.create({ _id: userId, name, status: "ACTIVE" });
  const store = await models.Store.create({ tenantId: userId, name: "Main", stateCode: "23", invoicePrefix: name.slice(0, 3).toUpperCase() });
  const invoice = await models.Invoice.create({ tenantId: userId, storeId: store._id, invoiceNo: `${store.invoicePrefix}-000001`, date: "2026-11-01", customerId: customer._id, status: "PAID", grossTotal: 10000 });
  return { ...shop, userId, conversationId: String(conversation._id), invoiceId: String(invoice._id) };
}

before(async () => {
  app = await startApp("chatshop-test-shop-admin");
  models = {
    User: require("../src/models/User.model"),
    Customer: require("../src/models/Customer.model"),
    Product: require("../src/models/Product.model"),
    Order: require("../src/models/Order.model"),
    Conversation: require("../src/models/Conversation.model"),
    ...require("../src/emi/models/platform"),
    ...require("../src/emi/models/sales"),
  };
  const r = await registerUser(app, { name: "Root", email: "shopadmin-root@example.com" });
  await models.User.updateOne({ _id: r.user.id }, { role: "admin" });
  root = as(r.token);
  cement = await shopWithData("Patil Cement");
  kirana = await shopWithData("Gupta Kirana");
});
after(stopApp);

test("the Super Admin gives a shop its own Admin; a shop is required", async () => {
  const noShop = await root.post("/api/admin/admins", { name: "No Shop", email: "noshop@example.com", password: "Admin@1234" });
  assert.equal(noShop.status, 400);
  assert.match(noShop.body.message, /Choose the shop/);

  const res = await root.post("/api/admin/admins", { name: "Cement Admin", email: "cement.admin@example.com", password: "Admin@1234", shopId: cement.userId });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.shop.name, "Patil Cement");
  adminId = res.body.data._id;
  const list = await root.get("/api/admin/admins");
  assert.equal(list.body.data[0].shop.name, "Patil Cement");

  const login = await request(app).post("/api/auth/login").send({ email: "cement.admin@example.com", password: "Admin@1234" });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.shopAdmin, true);
  assert.equal(String(login.body.data.user.adminShopId), String(cement.userId));
  adminToken = login.body.data.token;
});

test("the shop's Admin sees only their shop, whatever they ask for", async () => {
  const admin = as(adminToken);
  const shops = await admin.get("/api/admin/users");
  assert.deepEqual(shops.body.data.map((u) => u.email), [cement.user.email]);
  assert.equal((await admin.get(`/api/admin/users/${kirana.userId}`)).status, 404);
  assert.equal((await admin.get(`/api/admin/users/${cement.userId}`)).status, 200);

  for (const kind of ["orders", "customers", "products", "conversations"]) {
    const rows = (await admin.get(`/api/admin/${kind}?shop=${kirana.userId}`)).body.data;
    assert.ok(rows.length > 0, kind);
    assert.ok(rows.every((r) => String(r.userId._id || r.userId) === String(cement.userId)), `${kind} leaked another shop`);
  }
  assert.equal((await admin.get(`/api/admin/conversations/${kirana.conversationId}/messages`)).status, 404);
  assert.equal((await admin.get(`/api/admin/conversations/${cement.conversationId}/messages`)).status, 200);

  const dash = (await admin.get("/api/admin/dashboard")).body.data;
  assert.equal(dash.users.total, 1);
  assert.equal(dash.entities.orders, 1);
  assert.equal(dash.revenue.total, null); // ChatShop's own revenue isn't theirs to see
  const activity = (await admin.get("/api/admin/activity?days=30")).body.data;
  assert.equal(activity.series.reduce((s, d) => s + d.orders, 0), 1);
  assert.ok(activity.topShops.every((s) => s.email === cement.user.email));

  const csv = (await admin.get("/api/admin/export/orders")).text;
  assert.match(csv, /Patil Cement-ORD-1/);
  assert.doesNotMatch(csv, /Gupta Kirana/);
  const shopsCsv = (await admin.get("/api/admin/export/shops")).text;
  assert.match(shopsCsv, /Patil Cement/);
  assert.doesNotMatch(shopsCsv, /Gupta Kirana/);
});

test("the shop's Admin can't do the platform's work", async () => {
  const admin = as(adminToken);
  const blocked = [
    admin.put(`/api/admin/users/${cement.userId}`, { subscription: { plan: "premium", status: "active" } }),
    admin.post("/api/admin/users", { name: "x", email: "x@example.com", password: "Password1" }),
    admin.post("/api/admin/broadcast", { title: "Hi", message: "To every shop" }),
    admin.get("/api/admin/announcements"),
    admin.get("/api/admin/system"),
    admin.get("/api/admin/trends"),
    admin.get("/api/admin/stats"),
    admin.get("/api/admin/settings"),
    admin.get("/api/admin/billing"),
    admin.get("/api/admin/admins"),
    admin.get("/api/admin/revenue/overview"),
    admin.get("/api/admin/assistant/status"),
  ];
  for (const res of await Promise.all(blocked)) assert.equal(res.status, 403, JSON.stringify(res.body || {}));
});

test("EMI & Billing: the Admin sees their shop's records only, read-only", async () => {
  const admin = as(adminToken);
  const tenants = (await admin.get("/api/emi/super/tenants")).body.data;
  assert.deepEqual(tenants.map((t) => t.name), ["Patil Cement"]);
  const invoices = (await admin.get(`/api/emi/super/invoices?tenantId=${kirana.userId}`)).body.data;
  assert.deepEqual(invoices.map((i) => i.invoiceNo), ["PAT-000001"]);
  assert.equal((await admin.get(`/api/emi/super/invoices/${kirana.invoiceId}`)).status, 404);
  assert.equal((await admin.get(`/api/emi/super/invoices/${cement.invoiceId}`)).status, 200);
  const dash = (await admin.get("/api/emi/super/dashboard")).body.data;
  assert.equal(dash.gmv30d.invoices <= 1, true);
  assert.equal(dash.tenants.active, 1);
  assert.equal((await admin.get("/api/emi/super/requests")).status, 403);
  assert.equal((await admin.get("/api/emi/super/risk/multi-store-customers")).status, 403);
  assert.equal((await admin.patch(`/api/emi/super/tenants/${cement.userId}`, { status: "SUSPENDED", reason: "x" })).status, 403);
});

test("the shop's Admin adds and switches off staff in their own shop only", async () => {
  const admin = as(adminToken);
  // Stores and the owner's own roles for the form: their shop's only
  const roles = await admin.get(`/api/emi/super/shop-roles?tenantId=${kirana.userId}`);
  assert.equal(roles.status, 200);
  assert.deepEqual(roles.body.data.stores.map((st) => st.invoicePrefix), ["PAT"]);

  // Asking for the other shop still adds to their own
  const added = await admin.post("/api/emi/super/staff", { tenantId: kirana.userId, name: "Ramesh Cashier", email: "ramesh@example.com", password: "Staff@1234", roles: [{ role: "CASHIER", storeId: null }] });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  const ramesh = await models.User.findOne({ email: "ramesh@example.com" });
  assert.equal(String(ramesh.tenantId), String(cement.userId));
  assert.equal(ramesh.approvalStatus, "APPROVED");
  const staffList = (await admin.get("/api/emi/super/staff")).body.data;
  assert.deepEqual(staffList.map((u) => u.email), ["ramesh@example.com"]);

  // Switch off and on
  assert.equal((await admin.patch(`/api/emi/super/staff/${ramesh._id}`, { staffActive: false })).body.data.staffActive, false);
  assert.equal((await admin.patch(`/api/emi/super/staff/${ramesh._id}`, { staffActive: true })).body.data.staffActive, true);

  // The other shop's staff are out of reach
  const other = await root.post("/api/emi/super/staff", { tenantId: kirana.userId, name: "Kirana Staff", email: "kstaff@example.com", password: "Staff@1234", roles: [{ role: "CASHIER", storeId: null }] });
  assert.equal(other.status, 201, JSON.stringify(other.body));
  assert.equal((await admin.patch(`/api/emi/super/staff/${other.body.data._id}`, { staffActive: false })).status, 404);
  assert.ok(!(await admin.get("/api/emi/super/staff")).body.data.some((u) => u.email === "kstaff@example.com"));

  // The new staff member signs in and works in the cement shop
  const login = await request(app).post("/api/auth/login").send({ email: "ramesh@example.com", password: "Staff@1234" });
  assert.equal(login.status, 200, JSON.stringify(login.body));
});

test("the Super Admin still sees every shop; an Admin without a shop sees nothing; a new shop signs them out", async () => {
  const all = (await root.get("/api/admin/users?limit=50")).body.data.map((u) => u.email);
  assert.ok(all.includes(cement.user.email) && all.includes(kirana.user.email));
  assert.equal((await root.get("/api/emi/super/tenants")).body.data.length, 2);

  // An Admin from before shops were assigned
  const bcrypt = require("bcryptjs");
  await models.User.create({ name: "Old Admin", email: "old.admin@example.com", phone: "-", password: await bcrypt.hash("Admin@1234", 10), role: "admin", adminLevel: "admin", isVerified: true });
  const old = (await request(app).post("/api/auth/login").send({ email: "old.admin@example.com", password: "Admin@1234" })).body.data.token;
  assert.deepEqual((await as(old).get("/api/admin/users")).body.data, []);
  assert.deepEqual((await as(old).get("/api/admin/orders")).body.data, []);
  assert.deepEqual((await as(old).get("/api/emi/super/tenants")).body.data, []);

  // Moving the cement Admin to the kirana shop ends their old session
  await new Promise((r) => setTimeout(r, 1100));
  const moved = await root.put(`/api/admin/admins/${adminId}`, { shopId: kirana.userId });
  assert.equal(moved.body.data.shop.name, "Gupta Kirana");
  assert.equal((await as(adminToken).get("/api/admin/users")).status, 401);
  const again = (await request(app).post("/api/auth/login").send({ email: "cement.admin@example.com", password: "Admin@1234" })).body.data.token;
  assert.deepEqual((await as(again).get("/api/admin/users")).body.data.map((u) => u.email), [kirana.user.email]);
});
