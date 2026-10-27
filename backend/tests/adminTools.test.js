const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { authenticator } = require("otplib");
const { startApp, stopApp, registerUser } = require("./helpers");

let app, admin, shop, User;

before(async () => {
  app = await startApp("chatshop-test-admintools");
  User = require("../src/models/User.model");
  admin = await registerUser(app, { name: "Root Admin" });
  await User.updateOne({ _id: admin.user.id }, { role: "admin" });
  shop = await registerUser(app, { name: "Asha Stores" });
});

after(stopApp);

const asAdmin = (method, path) => request(app)[method](`/api/admin/${path}`).set("Authorization", `Bearer ${admin.token}`);

test("platform settings save and the public part is readable by anyone", async () => {
  const saved = await asAdmin("put", "settings").send({
    platformName: "ShopChat",
    supportEmail: "help@shopchat.in",
    contactPhone: "+91 90000 00000",
    notifications: { newUserAlerts: false },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.notifications.newUserAlerts, false);

  const bad = await asAdmin("put", "settings").send({ supportEmail: "not-an-email" });
  assert.equal(bad.status, 400);

  const pub = await request(app).get("/api/settings/public");
  assert.deepEqual(pub.body.data, { platformName: "ShopChat", supportEmail: "help@shopchat.in", contactPhone: "+91 90000 00000" });
});

test("system status reports the real server and database state", async () => {
  const res = await asAdmin("get", "system");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.server.status, "online");
  assert.equal(res.body.data.database.connected, true);
  assert.ok(res.body.data.server.uptimeSeconds >= 0);
  assert.equal(typeof res.body.data.database.pingMs, "number");
  assert.deepEqual(res.body.data.email, { configured: false, working: false });
});

test("trends compare this month with last month", async () => {
  const res = await asAdmin("get", "trends");
  assert.equal(res.status, 200);
  assert.ok(res.body.data.users.current >= 1);
  assert.ok("previous" in res.body.data.orderRevenue);
});

test("an admin can add a shop, which can then log in", async () => {
  const res = await asAdmin("post", "users").send({ name: "New Shop", email: "newshop@example.com", password: "secret1", plan: "starter" });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.subscription.status, "active");

  const login = await request(app).post("/api/auth/login").send({ email: "newshop@example.com", password: "secret1" });
  assert.equal(login.status, 200);

  const duplicate = await asAdmin("post", "users").send({ name: "Again", email: "newshop@example.com", password: "secret1" });
  assert.equal(duplicate.status, 400);
});

test("a broadcast reaches the shops it was sent to as a dashboard message", async () => {
  const toOne = await asAdmin("post", "broadcast").send({ title: "Maintenance", message: "Tonight 2–3 AM", recipients: [shop.user.id] });
  assert.equal(toOne.status, 201);
  assert.equal(toOne.body.data.recipients, 1);
  assert.equal(toOne.body.data.announcement.emailSkipped, true, "no SMTP in tests");

  const seen = await request(app).get("/api/users/announcements").set("Authorization", `Bearer ${shop.token}`);
  assert.equal(seen.body.data[0].title, "Maintenance");

  const other = await registerUser(app);
  const notSeen = await request(app).get("/api/users/announcements").set("Authorization", `Bearer ${other.token}`);
  assert.equal(notSeen.body.data.length, 0, "only the chosen shop sees it");

  const history = await asAdmin("get", "announcements");
  assert.equal(history.body.data[0].title, "Maintenance");
});

test("exports are real CSV files and the backup leaves out secrets", async () => {
  const csv = await asAdmin("get", "export/shops");
  assert.equal(csv.status, 200);
  assert.match(csv.headers["content-type"], /text\/csv/);
  assert.match(csv.text, /"Asha Stores"/);

  const unknown = await asAdmin("get", "export/passwords");
  assert.equal(unknown.status, 400);

  const backup = await asAdmin("get", "backup");
  assert.equal(backup.status, 200);
  assert.ok(backup.body.counts.users >= 2);
  const raw = JSON.stringify(backup.body);
  assert.ok(!raw.includes('"password"'), "no password hashes in the backup");
  assert.ok(!raw.includes("accessToken"), "no channel tokens in the backup");
});

test("clear cache empties the report cache", async () => {
  await asAdmin("get", "trends");
  const res = await asAdmin("post", "cache/clear");
  assert.equal(res.status, 200);
  assert.ok(res.body.data.cleared >= 1);
});

test("two-factor login: setup, a second login step, and challenge tokens aren't sessions", async () => {
  const person = await registerUser(app, { password: "pass123" });
  const auth = (r) => r.set("Authorization", `Bearer ${person.token}`);

  const setup = await auth(request(app).post("/api/users/2fa/setup"));
  assert.equal(setup.status, 200);
  assert.match(setup.body.data.qrCode, /^data:image\/png;base64,/);

  const wrong = await auth(request(app).post("/api/users/2fa/enable")).send({ code: "000000" });
  assert.equal(wrong.status, 400);
  const on = await auth(request(app).post("/api/users/2fa/enable")).send({ code: authenticator.generate(setup.body.data.secret) });
  assert.equal(on.status, 200);

  const step1 = await request(app).post("/api/auth/login").send({ email: person.user.email, password: "pass123" });
  assert.equal(step1.body.data.twoFactorRequired, true);
  assert.equal(step1.body.data.token, undefined, "no session before the code");

  const misuse = await request(app).get("/api/users/profile").set("Authorization", `Bearer ${step1.body.data.challengeToken}`);
  assert.equal(misuse.status, 401, "a challenge token can't be used as a session");

  const step2 = await request(app)
    .post("/api/auth/login/2fa")
    .send({ challengeToken: step1.body.data.challengeToken, code: authenticator.generate(setup.body.data.secret) });
  assert.equal(step2.status, 200);
  assert.ok(step2.body.data.token);
});

test("admin actions are written to the audit log", async () => {
  const res = await asAdmin("get", "audit");
  const actions = res.body.data.map((entry) => entry.action);
  for (const action of ["settings.update", "shop.create", "broadcast.send", "data.export", "data.backup", "cache.clear", "2fa.enable"]) {
    assert.ok(actions.includes(action), `missing ${action}`);
  }
});

test("shops can't use the admin tools", async () => {
  const res = await request(app).get("/api/admin/system").set("Authorization", `Bearer ${shop.token}`);
  assert.equal(res.status, 403);
});
