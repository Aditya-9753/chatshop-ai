"use strict";
const crypto = require("crypto");

/**
 * Generate a stable sha256 fingerprint for an error signature.
 * The same combination of inputs always produces the same hash,
 * allowing de-duplication of repeated incidents.
 *
 * @param {object} opts
 * @param {string} opts.category    - e.g. "API", "DATABASE"
 * @param {string} [opts.errorCode] - application-specific error code
 * @param {string} [opts.module]    - source module / file
 * @param {string} [opts.endpoint]  - route / endpoint path
 * @param {number} [opts.statusCode]
 * @returns {string} 64-char hex sha256 digest
 */
function generateFingerprint({ category, errorCode, module: mod, endpoint, statusCode }) {
  const parts = [
    (category || "UNKNOWN").toUpperCase(),
    (errorCode || "").toUpperCase(),
    (mod || "").toLowerCase(),
    // Normalize endpoint: strip query string, collapse UUIDs/ObjectIds to placeholders
    normalizeEndpoint(endpoint || ""),
    String(statusCode || ""),
  ];
  const raw = parts.join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Strip volatile parts of an endpoint so the same route
 * with different IDs maps to one fingerprint.
 * e.g. "/api/orders/60d5ec49f1b2c40015d2b8a1" → "/api/orders/:id"
 */
function normalizeEndpoint(endpoint) {
  return endpoint
    .split("?")[0]                                       // drop query string
    .replace(/\/[0-9a-f]{24}(\/|$)/gi, "/:id$1")        // ObjectId
    .replace(/\/[0-9a-f-]{36}(\/|$)/gi, "/:uuid$1")     // UUID
    .replace(/\/\d+(\/|$)/g, "/:num$1")                  // plain numbers
    .toLowerCase();
}

module.exports = { generateFingerprint };
