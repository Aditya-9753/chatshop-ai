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

test("the super admin can list every shop's orders, customers, products and chats", async () => {
  const User = require("../src/models/User.model");
  const Customer = require("../src/models/Customer.model");
  const Order = require("../src/models/Order.model");
  const Product = require("../src/models/Product.model");
  const Conversation = require("../src/models/Conversation.model");
  const Message = require("../src/models/Message.model");

  const admin = await registerUser(app);
  await User.updateOne({ _id: admin.user.id }, { role: "admin" });
  const shopA = await registerUser(app, { name: "Shop A" });
  const shopB = await registerUser(app, { name: "Shop B" });

  const customer = await Customer.create({ userId: shopA.user.id, name: "Asha", platform: "whatsapp", phone: "+910000000002" });
  await Customer.create({ userId: shopB.user.id, name: "Bela", platform: "instagram", platformId: "ig1" });
  await Order.create({ userId: shopA.user.id, customerId: customer._id, orderNumber: "ORD-ALL-1", platform: "whatsapp", total: 700 });
  await Product.create({ userId: shopB.user.id, name: "Saree", price: 2000 });
  const convo = await Conversation.create({ userId: shopA.user.id, customerId: customer._id, platform: "whatsapp", lastMessage: { content: "Hi", type: "text", direction: "incoming", timestamp: new Date() } });
  await Message.create({ userId: shopA.user.id, customerId: customer._id, conversationId: convo._id, platform: "whatsapp", direction: "incoming", content: { text: "Hi" }, status: "received" });

  const get = (path) => request(app).get(`/api/admin/${path}`).set("Authorization", `Bearer ${admin.token}`);

  const customers = await get("customers");
  assert.ok(customers.body.data.some((c) => c.name === "Asha" && c.userId.name === "Shop A"));
  assert.ok(customers.body.data.some((c) => c.name === "Bela" && c.userId.name === "Shop B"));

  const onlyA = await get(`customers?shop=${shopA.user.id}`);
  assert.ok(onlyA.body.data.every((c) => String(c.userId._id) === String(shopA.user.id)));

  const orders = await get("orders");
  const order = orders.body.data.find((o) => o.orderNumber === "ORD-ALL-1");
  assert.equal(order.customerId.name, "Asha");
  assert.equal(order.userId.name, "Shop A");

  const products = await get("products");
  assert.ok(products.body.data.some((p) => p.name === "Saree" && p.userId.name === "Shop B"));

  const chats = await get("conversations");
  assert.ok(chats.body.data.some((c) => String(c._id) === String(convo._id)));
  const thread = await get(`conversations/${convo._id}/messages`);
  assert.equal(thread.status, 200);
  assert.equal(thread.body.data.messages[0].content.text, "Hi");

  const blocked = await request(app).get("/api/admin/orders").set("Authorization", `Bearer ${shopA.token}`);
  assert.equal(blocked.status, 403);
});
