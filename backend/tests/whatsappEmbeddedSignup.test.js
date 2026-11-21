const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const signup = require("../src/services/whatsappEmbeddedSignup.service");

const META_ENV = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_EMBEDDED_SIGNUP_CONFIG_ID",
  "WHATSAPP_TOKEN_ENCRYPTION_KEY",
];

function withMetaConfig(callback) {
  const previous = Object.fromEntries(META_ENV.map((key) => [key, process.env[key]]));
  process.env.META_APP_ID = "test-app-id";
  process.env.META_APP_SECRET = "test-app-secret";
  process.env.META_EMBEDDED_SIGNUP_CONFIG_ID = "test-config-id";
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const key of META_ENV) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
    });
}

test("Embedded Signup stays disabled without server-side Meta approval config", () => {
  const previous = Object.fromEntries(META_ENV.map((key) => [key, process.env[key]]));
  for (const key of META_ENV.slice(0, 3)) delete process.env[key];
  try {
    assert.deepEqual(signup.publicConfig(), {
      enabled: false,
      appId: "",
      configId: "",
      graphVersion: signup.publicConfig().graphVersion,
    });
  } finally {
    for (const key of META_ENV) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("Embedded Signup rejects malformed asset IDs and invalid verification PINs", () =>
  withMetaConfig(async () => {
    await assert.rejects(
      signup.exchangeCode("user-id", {
        code: "authorization-code",
        phoneNumberId: "not-an-id",
        businessAccountId: "also-invalid",
      }),
      (error) => error.status === 400,
    );
    await assert.rejects(
      signup.completeSetup("user-id", "12345"),
      (error) => error.status === 400,
    );
  }));
