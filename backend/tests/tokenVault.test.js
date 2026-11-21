const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const tokenVault = require("../src/utils/tokenVault");

test("WhatsApp token vault encrypts, decrypts, and identifies ciphertext", () => {
  const originalKey = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  try {
    const encrypted = tokenVault.encrypt("long-lived-meta-token");
    assert.notEqual(encrypted, "long-lived-meta-token");
    assert.equal(tokenVault.isEncrypted(encrypted), true);
    assert.equal(tokenVault.decrypt(encrypted), "long-lived-meta-token");
    assert.equal(tokenVault.decrypt("legacy-plaintext-token"), "legacy-plaintext-token");
  } finally {
    if (originalKey === undefined) delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
    else process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = originalKey;
  }
});

test("WhatsApp token vault rejects ciphertext authenticated with another key", () => {
  const originalKey = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  try {
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    const encrypted = tokenVault.encrypt("long-lived-meta-token");
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    assert.throws(() => tokenVault.decrypt(encrypted));
  } finally {
    if (originalKey === undefined) delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
    else process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = originalKey;
  }
});
