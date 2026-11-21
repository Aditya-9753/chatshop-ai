const crypto = require("crypto");

const PREFIX = "enc:v1:";

function encryptionKey() {
  const raw = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || "";
  const key = /^[\da-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "WHATSAPP_TOKEN_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or base64",
    );
  }
  return key;
}

function encrypt(value) {
  if (!value) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [
    PREFIX.slice(0, -1),
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function decrypt(value) {
  if (!value || !String(value).startsWith(PREFIX)) return value;
  const parts = String(value).split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Stored WhatsApp token has an invalid encrypted format");
  }
  const [, , iv, tag, ciphertext] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

const isEncrypted = (value) => Boolean(value && String(value).startsWith(PREFIX));

module.exports = { encrypt, decrypt, isEncrypted };
