"use strict";
const crypto = require("crypto");

// Keys that should be redacted from metadata objects
const SENSITIVE_KEY_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /password/i,
  /^otp$/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /apikey/i,
  /private[_-]?key/i,
  /card[_-]?number/i,
  /cvv/i,
  /cvc/i,
  /credit[_-]?card/i,
  /payment/i,
  /billing/i,
  /ssn/i,
  /social[_-]?security/i,
  /access[_-]?key/i,
  /refresh[_-]?token/i,
  /auth[_-]?token/i,
  /bearer/i,
  /x-api-key/i,
];

const REDACTED = "[REDACTED]";

/**
 * Check if a key name is sensitive
 * @param {string} key
 * @returns {boolean}
 */
function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively sanitize an object by redacting sensitive keys
 * @param {any} obj
 * @param {number} depth - prevent infinite loops on circular refs
 * @returns {any}
 */
function sanitizeMetadata(obj, depth = 0) {
  if (depth > 10) return "[MAX_DEPTH]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        sanitized[key] = REDACTED;
      } else {
        sanitized[key] = sanitizeMetadata(value, depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

// PII patterns to redact from strings
const PII_PATTERNS = [
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replace: "[EMAIL]" },
  // Phone numbers (10+ digits, with optional separators)
  { pattern: /(\+?\d[\d\s\-().]{8,}\d)/g, replace: "[PHONE]" },
  // JWT tokens (3-part base64url separated by dots)
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replace: "[JWT]",
  },
  // Credit card numbers (13-19 digits with optional spaces/dashes)
  { pattern: /\b(?:\d[ -]?){13,19}\b/g, replace: "[CARD]" },
  // Authorization header value
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replace: "Bearer [REDACTED]" },
  // IP addresses
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replace: "[IP]" },
];

/**
 * Redact PII patterns from a string message
 * @param {string} msg
 * @returns {string}
 */
function sanitizeMessage(msg) {
  if (typeof msg !== "string") return String(msg || "");
  let sanitized = msg;
  for (const { pattern, replace } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replace);
  }
  return sanitized;
}

/**
 * Return a sha256 hash of the stack string (used as stackHash)
 * @param {string} stack
 * @returns {string}
 */
function sanitizeStackHash(stack) {
  if (!stack) return "";
  return crypto.createHash("sha256").update(String(stack)).digest("hex");
}

module.exports = { sanitizeMetadata, sanitizeMessage, sanitizeStackHash };
