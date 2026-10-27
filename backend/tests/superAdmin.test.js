const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

const DAY_MS = 24 * 60 * 60 * 1000;
let app, superToken, limitedToken, shop, ended, User;

before(async () => {
  app = await startApp("chatshop-test-superadmin");
  User = require("../src/models/User.model");
  const admin = await registerUser(app, { name: "Root Admin", email: "boss@example.com" });
  await User.updateOne({ _id: admin.user.id }, { role: "admin" });
  superToken = admin.token;
  await request(app).put("/api/admin/admin-panel").set("Authorization", `Bearer ${superToken}`).send({ password: "Panel@123" });
  limitedToken = (await request(app).post("/api/auth/login").send({ email: "boss@example.com", password: "Panel@123" })).body.data.token;

  // New sign-ups get a premium trial for 14 days; one ends in 3 days, one already ended
  shop = await registerUser(app, { name: "Asha Stores" });
  await User.updateOne({ _id: shop.user.id }, { "subscription.plan": "business", "subscription.endDate": new Date(Date.now() + 3 * DAY_MS) });
  ended = await registerUser(app, { name: "Old Shop" });
  await User.updateOne({ _id: ended.user.id }, { "subscription.status": "expired", "subscription.endDate": new Date(Date.now() - 2 * DAY_MS) });
});

after(stopApp);

const as = (token, method, path) => request(app)[method](path).set("Authorization", `Bearer ${token}`);

test("billing: revenue by plan, plans ending soon, plans that ended; extend adds days", async () => {
  const res = await as(superToken, "get", "/api/admin/billing");
  assert.equal(res.status, 200);
  const { totals, byPlan, expiringSoon } = res.body.data;
  assert.equal(byPlan.find((p) => p.plan === "business").mrr, 1249);
  assert.equal(totals.arr, totals.mrr * 12);
  assert.deepEqual(expiringSoon.map((s) => s.email), [shop.user.email]);
  assert.equal(expiringSoon[0].daysLeft, 3);
  assert.ok(res.body.data.ended.some((s) => s.email === ended.user.email));

  // From the current end date when it's still running…
  const more = await as(superToken, "post", `/api/admin/users/${shop.user.id}/extend`).send({ days: 30 });
  assert.equal(more.status, 200);
  assert.equal(more.body.data.daysLeft, 33);
  // …and from today, switched back on, when it already ended
  const back = await as(superToken, "post", `/api/admin/users/${ended.user.id}/extend`).send({ days: 7 });
  assert.equal(back.body.data.daysLeft, 7);
  assert.equal(back.body.data.status, "active");
  assert.equal((await as(superToken, "post", `/api/admin/users/${shop.user.id}/extend`).send({ days: 0 })).status, 400);

  // Admin panel can't use either tool
  assert.equal((await as(limitedToken, "get", "/api/admin/billing")).status, 403);
  assert.equal((await as(limitedToken, "post", `/api/admin/users/${shop.user.id}/extend`).send({ days: 7 })).status, 403);
});

test("open as shop: the Super Admin sees the shop's own dashboard, logged and limited", async () => {
  assert.equal((await as(limitedToken, "post", `/api/admin/users/${shop.user.id}/impersonate`)).status, 403);

  const res = await as(superToken, "post", `/api/admin/users/${shop.user.id}/impersonate`);
  assert.equal(res.status, 200);
  const { token, user } = res.body.data;
  assert.equal(user.email, shop.user.email);
  assert.equal(user.actingAdmin.email, "boss@example.com");

  // Works as the shop…
  const profile = await as(token, "get", "/api/users/profile");
  assert.equal(profile.body.data.email, shop.user.email);
  assert.equal((await as(token, "get", "/api/customers")).status, 200);
  // …but can't reach admin routes or change the owner's account
  assert.equal((await as(token, "get", "/api/admin/users")).status, 403);
  assert.equal((await as(token, "put", "/api/users/password").send({ currentPassword: "x", newPassword: "Hacked@123" })).status, 403);
  assert.equal((await as(token, "post", "/api/users/2fa/setup")).status, 403);
  assert.equal((await as(token, "delete", "/api/users/account")).status, 403);
  assert.ok(await User.exists({ _id: shop.user.id }));

  // Can't open another admin
  const self = await as(superToken, "get", "/api/users/profile");
  assert.equal((await as(superToken, "post", `/api/admin/users/${self.body.data._id}/impersonate`)).status, 400);

  const log = await as(superToken, "get", "/api/admin/audit");
  assert.ok(log.body.data.some((r) => r.action === "shop.impersonate" && r.target === shop.user.email));

  // Ends when the admin changes their password
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await User.updateOne({ email: "boss@example.com" }, { passwordChangedAt: new Date() });
  assert.equal((await as(token, "get", "/api/users/profile")).status, 401);
});
