"use strict";
const crypto = require("crypto");
const logger = require("../../../utils/logger");
const { sanitizeMetadata, sanitizeMessage, sanitizeStackHash } = require("../utils/sanitize");
const { classifySeverity, shouldCreateIncident } = require("../utils/severity");
const incidentService = require("./incident.service");

/**
 * Main entry point called by monitoring/error middleware.
 * Never throws – all errors are caught and logged internally.
 *
 * @param {object} opts
 * @param {object} opts.req        - Express request
 * @param {Error}  opts.err        - The error object
 * @param {number} opts.statusCode - HTTP status code
 * @param {number} [opts.durationMs]
 */
async function captureError({ req, err, statusCode, durationMs }) {
  // Honour feature flag
  if (process.env.GUARDIAN_ENABLED === "false") return;

  try {
    // Determine category from request or error metadata
    const category = err?.category || _inferCategory(req, statusCode);
    const errorCode = err?.code || err?.errorCode || null;

    // Check if we should create an incident at all
    if (!shouldCreateIncident({ statusCode, category })) return;

    // Extract identity from request
    const userId = req?.user?._id || null;
    // shopId: for shop owners it's their own _id; for super-admin it's tenantId
    const shopId = req?.user?.tenantId || req?.user?._id || null;

    // Build safe error message (no PII / sensitive data)
    const rawMessage = err?.message || `HTTP ${statusCode}`;
    const safeMessage = sanitizeMessage(rawMessage);

    // Stack hash for de-duplication
    const stackHash = sanitizeStackHash(err?.stack || "");

    // Classify severity
    const occurrenceCount = 1; // Will be incremented if existing incident found
    const severity = classifySeverity({ statusCode, category, errorCode, durationMs, occurrenceCount });

    // Build sanitized metadata
    const rawMeta = {
      headers: req?.headers || {},
      query: req?.query || {},
      body: req?.body || {},
      params: req?.params || {},
      userAgent: req?.headers?.["user-agent"] || null,
    };
    const metadata = sanitizeMetadata(rawMeta);

    const endpoint = req?.route?.path || req?.path || null;
    const route = req?.originalUrl || null;
    const method = req?.method || null;
    const mod = _inferModule(req);
    const title = _buildTitle(safeMessage, statusCode, category);

    await incidentService.createOrUpdateIncident({
      shopId,
      userId,
      title,
      category,
      errorCode,
      severity,
      module: mod,
      endpoint,
      requestId: req?.requestId || null,
      safeMessage,
      stackHash,
      durationMs: durationMs || null,
      metadata,
      route,
      method,
      statusCode,
    });
  } catch (internalErr) {
    // Guardian failures MUST NOT crash the main request path
    logger.error("[SystemGuardian/Detection] captureError failed internally", internalErr);
  }
}

/** Infer a category from the route or status code */
function _inferCategory(req, statusCode) {
  const url = (req?.originalUrl || "").toLowerCase();
  if (url.includes("/auth")) return "AUTH";
  if (url.includes("/whatsapp") || url.includes("/instagram") || url.includes("/facebook")) return "INTEGRATION";
  if (url.includes("/ai") || url.includes("/assistant")) return "AI";
  if (statusCode >= 500) return "API";
  return "API";
}

/** Infer the module/file from the request route */
function _inferModule(req) {
  const url = (req?.originalUrl || "").split("?")[0];
  const parts = url.split("/").filter(Boolean);
  // e.g. /api/orders/... → "orders"
  return parts[1] || parts[0] || null;
}

/** Build a human-readable incident title */
function _buildTitle(safeMessage, statusCode, category) {
  if (safeMessage && safeMessage.length > 0 && safeMessage !== `HTTP ${statusCode}`) {
    return `[${category}] ${safeMessage}`.slice(0, 200);
  }
  return `[${category}] HTTP ${statusCode} error`;
}

module.exports = { captureError };
