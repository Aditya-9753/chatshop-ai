"use strict";
const detectionService = require("../services/detection.service");
const logger = require("../../../utils/logger");

/**
 * Global Express error handler (4-param signature required by Express).
 * - Normalizes the error to a safe status + message
 * - Calls detectionService.captureError for unexpected (5xx) errors
 * - Sends JSON: { success: false, message, requestId }
 *
 * Mount AFTER all routes, BEFORE the 404 fallback.
 */
// eslint-disable-next-line no-unused-vars
async function guardianErrorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const durationMs = req.startTime ? Date.now() - req.startTime : undefined;

  // Store the error on req so monitoring middleware's finish-listener can use it
  req._guardianErr = err;

  // For 5xx (unexpected) errors, capture an incident
  if (statusCode >= 500) {
    detectionService
      .captureError({ req, err, statusCode, durationMs })
      .catch((e) => logger.error("[SystemGuardian/ErrorHandler] captureError failed", e));
  }

  // Safe message – never expose stack traces or internal details to clients
  const safeMessage =
    statusCode >= 500
      ? "An unexpected error occurred. Our team has been notified."
      : err.message || "Request failed";

  // Log internally at appropriate level
  if (statusCode >= 500) {
    logger.error(`[${req.requestId || "?"}] ${req.method} ${req.originalUrl} → ${statusCode}`, err);
  } else {
    logger.warn(`[${req.requestId || "?"}] ${req.method} ${req.originalUrl} → ${statusCode}: ${safeMessage}`);
  }

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    requestId: req.requestId || null,
  });
}

module.exports = { guardianErrorHandler };
