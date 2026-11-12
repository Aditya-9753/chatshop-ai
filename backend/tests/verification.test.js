const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startApp, stopApp, registerUser } = require("./helpers");

let app;
let User;
let authService;
let originalSendEmail;
let originalSendOtp;
const sentEmails = [];
const sentOtps = [];

const as = (token) => ({
  get: (path) => request(app).get(path).set("Authorization", `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set("Authorization", `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set("Authorization", `Bearer ${token}`).send(body),
});

before(async () => {
  app = await startApp("chatshop_test_verification");
  User = require("../src/models/User.model");
  authService = require("../src/services/auth.service");
  originalSendEmail = authService.sendEmail;
  originalSendOtp = authService.sendOtp;
  authService.sendEmail = async (message) => {
    sentEmails.push(message);
    return { messageId: "test-email" };
  };
  authService.sendOtp = async (phone, otp) => {
    sentOtps.push({ phone, otp });
    return { messageId: "test-sms" };
  };
});

after(async () => {
  authService.sendEmail = originalSendEmail;
  authService.sendOtp = originalSendOtp;
  await stopApp();
});

test("registration verification tokens, mobile OTP limits, and contact changes", async () => {
  const account = await registerUser(app);
  const userId = account.user.id;
  const token = account.token;
  const emailHtml = sentEmails.at(-1).html;
  const emailToken = emailHtml.match(/verify-email\/([a-f\d]{64})/i)?.[1];
  const emailCode = emailHtml.match(/font-size:24px;font-weight:bold;letter-spacing:4px">(\d{6})<\/p>/)?.[1];
  const otp = sentOtps.at(-1).otp;
  assert.ok(emailToken);
  assert.ok(emailCode);
  assert.equal(account.user.isVerified, false);
  assert.equal(account.user.phoneVerified, false);

  const stored = await User.findById(userId).select("+emailVerificationToken +phoneVerificationOtpHash +emailVerificationCodeHash");
  assert.notEqual(stored.emailVerificationToken, emailToken);
  assert.notEqual(stored.phoneVerificationOtpHash, otp);
  assert.notEqual(stored.emailVerificationCodeHash, emailCode);

  const profile = as(token);
  assert.equal((await profile.post("/api/users/email-verification/resend", {})).status, 400, "email resend cooldown is enforced");
  const emailVerified = await request(app).post("/api/auth/verify-email").send({ token: emailToken });
  assert.equal(emailVerified.status, 200);
  const linkVerified = await User.findById(userId).select("+emailVerificationCodeHash");
  assert.equal(linkVerified.emailVerificationCodeHash, undefined, "link verification invalidates the fallback code");
  assert.equal((await profile.get("/api/users/profile")).body.data.isVerified, true);
  assert.equal((await request(app).post("/api/auth/verify-email").send({ token: emailToken })).status, 400, "email token is one-time");

  const mobileVerified = await profile.post("/api/users/phone-verification/verify", { otp });
  assert.equal(mobileVerified.status, 200, JSON.stringify(mobileVerified.body));
  assert.equal((await profile.get("/api/users/profile")).body.data.phoneVerified, true);
  assert.equal((await profile.post("/api/users/phone-verification/verify", { otp })).status, 400, "OTP is one-time");

  await User.updateOne(
    { _id: userId },
    { $set: { emailVerificationSentAt: new Date(Date.now() - 2 * 60 * 1000), phoneVerificationSentAt: new Date(Date.now() - 2 * 60 * 1000) } }
  );
  const changed = await profile.put("/api/users/profile", {
    email: "updated-verification@example.com",
    phone: "+919999900001",
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.data.isVerified, false);
  assert.equal(changed.body.data.phoneVerified, false);

  const newEmailToken = sentEmails.at(-1).html.match(/verify-email\/([a-f\d]{64})/i)?.[1];
  const newOtp = sentOtps.at(-1).otp;
  assert.ok(newEmailToken);
  assert.equal((await request(app).post("/api/auth/verify-email").send({ token: newEmailToken })).status, 200);
  assert.equal((await profile.post("/api/users/phone-verification/verify", { otp: newOtp })).status, 200);
});

test("email verification code works once and is invalidated after use", async () => {
  const account = await registerUser(app);
  const html = sentEmails.at(-1).html;
  const code = html.match(/font-size:24px;font-weight:bold;letter-spacing:4px">(\d{6})<\/p>/)?.[1];
  assert.ok(code);

  const verified = await request(app).post("/api/auth/verify-email/code").send({ email: account.user.email, code });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.equal((await request(app).post("/api/auth/verify-email/code").send({ email: account.user.email, code })).status, 400);
  assert.equal((await User.findById(account.user.id)).isVerified, true);
});

test("email verification code expires and is limited to five attempts", async () => {
  const expiredAccount = await registerUser(app);
  const expiredCode = sentEmails.at(-1).html.match(/font-size:24px;font-weight:bold;letter-spacing:4px">(\d{6})<\/p>/)?.[1];
  await User.updateOne(
    { _id: expiredAccount.user.id },
    { $set: { emailVerificationCodeExpires: new Date(Date.now() - 1000) } }
  );
  const expired = await request(app).post("/api/auth/verify-email/code").send({ email: expiredAccount.user.email, code: expiredCode });
  assert.equal(expired.status, 400);
  assert.match(expired.body.message, /expired/i);

  const limitedAccount = await registerUser(app);
  const limitedCode = sentEmails.at(-1).html.match(/font-size:24px;font-weight:bold;letter-spacing:4px">(\d{6})<\/p>/)?.[1];
  const wrongCode = limitedCode === "000000" ? "000001" : "000000";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request(app).post("/api/auth/verify-email/code").send({ email: limitedAccount.user.email, code: wrongCode });
    assert.equal(response.status, 400);
  }
  const exhausted = await User.findById(limitedAccount.user.id).select("+emailVerificationCodeAttempts");
  assert.equal(exhausted.emailVerificationCodeAttempts, 5);
  const blocked = await request(app).post("/api/auth/verify-email/code").send({ email: limitedAccount.user.email, code: limitedCode });
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.message, /too many/i);
});

test("mobile OTP resend cooldown, expiry, and maximum attempts are enforced", async () => {
  const account = await registerUser(app);
  const profile = as(account.token);
  const limitedUserId = account.user.id;

  const cooldown = await profile.post("/api/users/phone-verification/send", {});
  assert.equal(cooldown.status, 400);

  const wrongCode = sentOtps.at(-1).otp === "000000" ? "000001" : "000000";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await profile.post("/api/users/phone-verification/verify", { otp: wrongCode });
    assert.equal(response.status, 400);
  }
  const exhausted = await User.findById(limitedUserId).select("+phoneVerificationOtpHash +phoneVerificationAttempts");
  assert.equal(exhausted.phoneVerificationOtpHash, undefined);
  assert.equal(exhausted.phoneVerificationAttempts, 5);

  const expiredAccount = await registerUser(app);
  const expiredOtp = sentOtps.at(-1).otp;
  await User.updateOne({ _id: expiredAccount.user.id }, { $set: { phoneVerificationExpires: new Date(Date.now() - 1000) } });
  const expired = await as(expiredAccount.token).post("/api/users/phone-verification/verify", { otp: expiredOtp });
  assert.equal(expired.status, 400);
  assert.match(expired.body.message, /expired/i);
});
