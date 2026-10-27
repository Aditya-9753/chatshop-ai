// Test setup: each test file gets its own throwaway database on the local
// MongoDB, and env vars are fixed before the app (and dotenv) loads.
const crypto = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");

const APP_SECRET = "test-app-secret";

async function startApp(dbName) {
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${dbName}`;
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.META_APP_SECRET = APP_SECRET;
  process.env.META_WEBHOOK_SKIP_SIGNATURE = "false";
  process.env.EMAIL_USER = "";
  process.env.FRONTEND_URL = "http://localhost:5174";

  const app = require("../src/app");
  await mongoose.connection.asPromise();
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  return app;
}

async function stopApp() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

// Register a user through the API; returns { token, user }
async function registerUser(app, overrides = {}) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Shop Owner",
      email: `owner-${crypto.randomUUID()}@example.com`,
      password: "Password123",
      phone: "+919999900000",
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

// Sign a webhook body the way Meta does (HMAC-SHA256 of the raw bytes)
function sign(rawBody, secret = APP_SECRET) {
  return `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

// POST a signed webhook
function postWebhook(app, path, body, signature) {
  const raw = JSON.stringify(body);
  return request(app)
    .post(path)
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", signature === undefined ? sign(raw) : signature)
    .send(raw);
}

// Replace a method for the duration of one test; returns a restore function
function stub(object, method, implementation) {
  const original = object[method];
  object[method] = implementation;
  return () => {
    object[method] = original;
  };
}

module.exports = { startApp, stopApp, registerUser, sign, postWebhook, stub };
