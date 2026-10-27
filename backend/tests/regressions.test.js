const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

let app, owner;

// Smallest valid PNG (1×1 pixel)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

before(async () => {
  app = await startApp("chatshop-test-regressions");
  owner = await registerUser(app);
});

after(stopApp);

test("a product image upload is saved and served from /uploads", async () => {
  const created = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${owner.token}`)
    .field("name", "Kurti")
    .field("price", "499")
    .field("stock", "3")
    .attach("image", PNG, { filename: "kurti.png", contentType: "image/png" });

  assert.equal(created.status, 201);
  const imagePath = created.body.data.images[0];
  assert.match(imagePath, /^\/uploads\/products\/image-.+\.png$/);

  const served = await request(app).get(imagePath);
  assert.equal(served.status, 200);
  assert.match(served.headers["content-type"], /image\/png/);

  fs.rmSync(path.join(__dirname, "..", imagePath), { force: true });
});

test("an admin without a plan can open the shop pages", async () => {
  const User = require("../src/models/User.model");
  const admin = await registerUser(app);
  await User.updateOne({ _id: admin.user.id }, { role: "admin", subscription: { plan: null, status: "inactive" } });

  const res = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${admin.token}`);
  assert.equal(res.status, 200);

  // A normal shop without an active plan is still blocked
  const shop = await registerUser(app);
  await User.updateOne({ _id: shop.user.id }, { "subscription.status": "expired" });
  const blocked = await request(app).get("/api/analytics/overview").set("Authorization", `Bearer ${shop.token}`);
  assert.equal(blocked.status, 403);
});

test("6-character passwords work for sign-up and login", async () => {
  const { user } = await registerUser(app, { password: "abc123" });
  const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "abc123" });
  assert.equal(login.status, 200);

  const tooShort = await request(app)
    .post("/api/auth/register")
    .send({ name: "X", email: "short@example.com", password: "12345", phone: "1" });
  assert.equal(tooShort.status, 400);
  assert.equal(tooShort.body.message, "Password must be at least 6 characters");
});

test("the admin panel gets real per-shop numbers and a daily platform series", async () => {
  const User = require("../src/models/User.model");
  const Customer = require("../src/models/Customer.model");
  const Order = require("../src/models/Order.model");

  const admin = await registerUser(app);
  await User.updateOne({ _id: admin.user.id }, { role: "admin" });
  const shop = await registerUser(app);
  const customer = await Customer.create({ userId: shop.user.id, name: "C", platform: "whatsapp", phone: "+910000000001" });
  await Order.create({ userId: shop.user.id, customerId: customer._id, orderNumber: "ORD-ADM-1", platform: "whatsapp", total: 1500, paymentStatus: "paid", status: "delivered" });

  const users = await request(app).get("/api/admin/users?limit=100").set("Authorization", `Bearer ${admin.token}`);
  assert.equal(users.status, 200);
  const row = users.body.data.find((u) => u._id === String(shop.user.id));
  assert.deepEqual(row.activity, { customers: 1, orders: 1, revenue: 1500, messages: 0 });

  const activity = await request(app).get("/api/admin/activity?days=7&tz=UTC").set("Authorization", `Bearer ${admin.token}`);
  assert.equal(activity.status, 200);
  assert.ok(activity.body.data.series.length >= 7);
  assert.equal(activity.body.data.series.reduce((sum, d) => sum + d.revenue, 0), 1500);
  assert.equal(activity.body.data.topShops[0].revenue, 1500);

  const forbidden = await request(app).get("/api/admin/activity").set("Authorization", `Bearer ${shop.token}`);
  assert.equal(forbidden.status, 403);
});
