const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const request = require("supertest");
const { startApp, stopApp, registerUser, stub } = require("./helpers");

let app, User, authService;
let sentEmails = [];

// Pull the raw reset token out of the emailed link
const tokenFromEmail = (email) => email.html.match(/reset-password\/([a-f0-9]{64})/)[1];

before(async () => {
  app = await startApp("chatshop-test-password");
  User = require("../src/models/User.model");
  authService = require("../src/services/auth.service");
  stub(authService, "sendEmail", async (options) => {
    sentEmails.push(options);
    return { messageId: "test" };
  });
});

after(stopApp);

const login = (email, password) =>
  request(app).post("/api/auth/login").send({ email, password });

test("change password works, rejects the old one and logs out other sessions", async () => {
  const { token, user } = await registerUser(app, { password: "OldPassword1" });

  const wrong = await request(app)
    .put("/api/users/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "not-it", newPassword: "NewPassword1" });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.message, "Current password is incorrect");

  const same = await request(app)
    .put("/api/users/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "OldPassword1", newPassword: "OldPassword1" });
  assert.equal(same.status, 400);
  assert.match(same.body.message, /different/);

  // Let a second pass so the old token's iat is clearly before the change
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const changed = await request(app)
    .put("/api/users/password")
    .set("Authorization", `Bearer ${token}`)
    .send({ currentPassword: "OldPassword1", newPassword: "NewPassword1" });
  assert.equal(changed.status, 200);
  assert.ok(changed.body.data.token, "fresh token for this session");

  const oldSession = await request(app)
    .get("/api/users/profile")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(oldSession.status, 401);

  const thisSession = await request(app)
    .get("/api/users/profile")
    .set("Authorization", `Bearer ${changed.body.data.token}`);
  assert.equal(thisSession.status, 200);

  assert.equal((await login(user.email, "OldPassword1")).status, 401);
  assert.equal((await login(user.email, "NewPassword1")).status, 200);
});

test("wrong password on login returns 401 with a readable message", async () => {
  const { user } = await registerUser(app);
  const res = await login(user.email, "wrong-password");
  assert.equal(res.status, 401);
  assert.equal(res.body.message, "Invalid email or password");
});

test("forgot → email → reset → login works end to end, and the link works once", async () => {
  const { user } = await registerUser(app, { password: "Original123" });
  sentEmails = [];

  const forgot = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
  assert.equal(forgot.status, 200);
  assert.equal(sentEmails.length, 1);

  const rawToken = tokenFromEmail(sentEmails[0]);
  const stored = await User.findById(user.id).select("+passwordResetToken +passwordResetExpires");
  assert.equal(stored.passwordResetToken, crypto.createHash("sha256").update(rawToken).digest("hex"));
  assert.notEqual(stored.passwordResetToken, rawToken, "token is stored hashed");
  assert.ok(stored.passwordResetExpires > Date.now() + 59 * 60 * 1000);

  const valid = await request(app).get(`/api/auth/reset-password/${rawToken}`);
  assert.equal(valid.status, 200);
  assert.equal(valid.body.data.email, user.email);

  const reset = await request(app)
    .post("/api/auth/reset-password")
    .send({ token: rawToken, password: "Brand-new-456" });
  assert.equal(reset.status, 200);

  assert.equal((await login(user.email, "Brand-new-456")).status, 200);
  assert.equal((await login(user.email, "Original123")).status, 401);

  const reused = await request(app)
    .post("/api/auth/reset-password")
    .send({ token: rawToken, password: "Another-789" });
  assert.equal(reused.status, 400);
  assert.match(reused.body.message, /expired or was already used/);

  const usedLink = await request(app).get(`/api/auth/reset-password/${rawToken}`);
  assert.equal(usedLink.status, 400);
});

test("an expired reset link is rejected", async () => {
  const { user } = await registerUser(app);
  sentEmails = [];
  await request(app).post("/api/auth/forgot-password").send({ email: user.email });
  const rawToken = tokenFromEmail(sentEmails[0]);

  await User.updateOne({ _id: user.id }, { passwordResetExpires: new Date(Date.now() - 1000) });

  const res = await request(app)
    .post("/api/auth/reset-password")
    .send({ token: rawToken, newPassword: "Whatever-123" });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /expired/);
});

test("forgot password answers the same for unknown emails, then rate-limits", async () => {
  sentEmails = [];
  const unknown = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "nobody@example.com" });
  assert.equal(unknown.status, 200);
  assert.match(unknown.body.message, /If an account exists/);
  assert.equal(sentEmails.length, 0);

  // Two requests came from earlier tests and one from above; the limit is 5
  const send = () => request(app).post("/api/auth/forgot-password").send({ email: "a@example.com" });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
});
