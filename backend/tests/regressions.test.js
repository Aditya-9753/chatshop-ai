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
