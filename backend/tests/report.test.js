const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

let app, owner, Customer, Order, Message, Product, Conversation;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms) => new Date(Date.now() - ms);

before(async () => {
  app = await startApp("chatshop-test-report");
  Customer = require("../src/models/Customer.model");
  Order = require("../src/models/Order.model");
  Message = require("../src/models/Message.model");
  Product = require("../src/models/Product.model");
  Conversation = require("../src/models/Conversation.model");
  owner = await registerUser(app);
  const userId = owner.user.id;

  const [thisWeek, lastWeek] = await Customer.create([
    { userId, name: "New", platform: "whatsapp", createdAt: ago(2 * DAY) },
    { userId, name: "Old", platform: "instagram", createdAt: ago(10 * DAY) },
  ]);

  const order = (n, extra) => ({
    userId,
    customerId: thisWeek._id,
    orderNumber: `ORD-T-${n}`,
    platform: "whatsapp",
    items: [{ name: "Kurti", quantity: 2, price: 500, total: 1000 }],
    total: 1000,
    ...extra,
  });
  await Order.create([
    order(1, { paymentStatus: "paid", status: "delivered", createdAt: ago(1 * DAY) }),
    order(2, { paymentStatus: "paid", status: "shipped", createdAt: ago(3 * DAY) }),
    order(3, { paymentStatus: "pending", createdAt: ago(3 * DAY) }), // counts as an order, not revenue
    order(4, { paymentStatus: "paid", status: "cancelled", createdAt: ago(2 * DAY) }), // excluded
    order(5, { paymentStatus: "paid", status: "delivered", createdAt: ago(9 * DAY), customerId: lastWeek._id }),
  ]);

  // This week: customer waits 10 min, then 30 min. Last week: 60 min.
  const msg = (direction, at, customer = thisWeek) => ({
    userId,
    customerId: customer._id,
    platform: customer.platform,
    direction,
    content: { text: "x" },
    status: direction === "incoming" ? "received" : "sent",
    createdAt: at,
  });
  await Message.create([
    msg("incoming", ago(2 * DAY)),
    msg("incoming", ago(2 * DAY - 5 * 60 * 1000)),
    msg("outgoing", ago(2 * DAY - 10 * 60 * 1000)),
    msg("incoming", ago(1 * DAY)),
    msg("outgoing", ago(1 * DAY - 30 * 60 * 1000)),
    msg("incoming", ago(9 * DAY), lastWeek),
    msg("outgoing", ago(9 * DAY - HOUR), lastWeek),
  ]);

  await Product.create([
    { userId, name: "Low", price: 100, stock: 2 },
    { userId, name: "Plenty", price: 100, stock: 50 },
  ]);
  await Conversation.create({
    userId,
    customerId: thisWeek._id,
    platform: "whatsapp",
    lastMessage: { content: "Hello?", type: "text", direction: "incoming", timestamp: ago(HOUR) },
  });
});

after(stopApp);

test("overview compares the last 7 days with the 7 before", async () => {
  const res = await request(app)
    .get("/api/analytics/overview?tz=Asia/Kolkata")
    .set("Authorization", `Bearer ${owner.token}`);
  assert.equal(res.status, 200);
  const { kpis, series, attention, onboarding, topProducts } = res.body.data;

  assert.deepEqual(kpis.revenue, { current: 2000, previous: 1000 });
  assert.deepEqual(kpis.orders, { current: 3, previous: 1 });
  assert.deepEqual(kpis.newCustomers, { current: 1, previous: 1 });
  assert.deepEqual(kpis.responseTimeMinutes, { current: 20, previous: 60 });
  assert.equal(kpis.averageOrderValue.current, 1000);

  assert.ok(series.length >= 7 && series.length <= 8, `series has ${series.length} days`);
  assert.equal(series.reduce((sum, d) => sum + d.revenue, 0), 2000);

  assert.equal(attention.unansweredCount, 1);
  assert.equal(attention.pendingCount, 1);
  assert.equal(attention.lowStockCount, 1);
  assert.equal(attention.lowStock[0].name, "Low");

  assert.equal(onboarding.whatsappConnected, false);
  assert.equal(onboarding.firstOrder, true);
  assert.equal(topProducts[0].name, "Kurti");
  assert.equal(topProducts[0].revenue, 2000);
});

test("report accepts a custom range and rejects an invalid one", async () => {
  const start = ago(30 * DAY).toISOString();
  const end = new Date().toISOString();
  const ok = await request(app)
    .get(`/api/analytics/report?start=${start}&end=${end}&tz=UTC`)
    .set("Authorization", `Bearer ${owner.token}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.kpis.revenue.current, 3000);

  const bad = await request(app)
    .get(`/api/analytics/report?start=${end}&end=${start}`)
    .set("Authorization", `Bearer ${owner.token}`);
  assert.equal(bad.status, 400);
});
