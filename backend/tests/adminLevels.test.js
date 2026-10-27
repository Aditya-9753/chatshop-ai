const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

let app, superToken, shop, User;
const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });

before(async () => {
  app = await startApp("chatshop-test-adminlevels");
  User = require("../src/models/User.model");
  const admin = await registerUser(app, { name: "Root Admin", email: "root@example.com" });
  await User.updateOne({ _id: admin.user.id }, { role: "admin" });
  superToken = admin.token;
  shop = await registerUser(app, { name: "Asha Stores" });
});

after(stopApp);

test("one admin email, two passwords: Super Admin and the limited Admin panel", async () => {
  // Super Admin sets the Admin panel password; it can't match the main one
  const same = await request(app).put("/api/admin/admin-panel").set("Authorization", `Bearer ${superToken}`).send({ password: "Password123" });
  assert.equal(same.status, 400);
  const set = await request(app).put("/api/admin/admin-panel").set("Authorization", `Bearer ${superToken}`).send({ password: "Panel@123" });
  assert.equal(set.status, 200);
  assert.equal(set.body.data.set, true);

  const full = await login("root@example.com", "Password123");
  assert.equal(full.body.data.user.adminLevel, "super");
  const limited = await login("root@example.com", "Panel@123");
  assert.equal(limited.status, 200);
  assert.equal(limited.body.data.user.adminLevel, "admin");
  assert.equal((await login("root@example.com", "wrong-pass")).status, 401);

  // A shop owner's account never accepts an admin-panel password
  assert.equal((await login(shop.user.email, "Panel@123")).status, 401);

  const asLimited = (method, path) =>
    request(app)[method](path).set("Authorization", `Bearer ${limited.body.data.token}`);

  // Sees every shop and its data, and can manage plans
  assert.equal((await asLimited("get", "/api/admin/users")).status, 200);
  assert.equal((await asLimited("get", "/api/admin/orders")).status, 200);
  assert.equal((await asLimited("get", "/api/admin/conversations")).status, 200);
  const plan = await asLimited("put", `/api/admin/users/${shop.user.id}`).send({ subscription: { plan: "business" } });
  assert.equal(plan.status, 200);

  // Super Admin only: settings, backup, cache, audit, deletes, roles, own account
  for (const [method, path, body] of [
    ["put", "/api/admin/settings", { platformName: "X" }],
    ["get", "/api/admin/backup"],
    ["post", "/api/admin/cache/clear"],
    ["get", "/api/admin/audit"],
    ["put", "/api/admin/admin-panel", { password: "Other@123" }],
    ["delete", `/api/admin/users/${shop.user.id}`],
    ["put", `/api/admin/users/${shop.user.id}`, { role: "admin" }],
    ["put", "/api/users/password", { currentPassword: "Panel@123", newPassword: "Hacked@123" }],
    ["post", "/api/users/2fa/setup"],
    ["delete", "/api/users/account"],
  ]) {
    const res = await asLimited(method, path).send(body);
    assert.equal(res.status, 403, `${method.toUpperCase()} ${path} should be Super Admin only`);
  }
  assert.ok(await User.exists({ _id: shop.user.id }), "the shop was not deleted");

  // The audit log says which panel was used
  const log = await request(app).get("/api/admin/audit").set("Authorization", `Bearer ${superToken}`);
  assert.ok(log.body.data.some((r) => r.action === "auth.login" && r.details === "Admin panel"));
  assert.ok(log.body.data.some((r) => r.action === "shop.update" && /via Admin panel/.test(r.details || "")));

  // Changing the Admin panel password logs out open Admin panel sessions only
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await request(app).put("/api/admin/admin-panel").set("Authorization", `Bearer ${superToken}`).send({ password: "Panel@456" });
  assert.equal((await asLimited("get", "/api/admin/users")).status, 401);
  assert.equal((await request(app).get("/api/admin/users").set("Authorization", `Bearer ${superToken}`)).status, 200);
  assert.equal((await login("root@example.com", "Panel@456")).body.data.user.adminLevel, "admin");
});
