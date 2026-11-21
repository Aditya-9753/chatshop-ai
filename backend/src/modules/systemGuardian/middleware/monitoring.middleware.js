"use strict";
const crypto = require("crypto");
const detectionService = require("../services/detection.service");
const logger = require("../../../utils/logger");

/**
 * Monitoring middleware.
 * - Assigns req.requestId (UUID) and sets X-Request-Id response header
 * - Records req.startTime
 * - After response finishes: calculates durationMs, triggers captureError for status >= 400
 */
function monitoringMiddleware(req, res, next) {
  // Assign a unique request ID
  req.requestId = crypto.randomUUID();
  req.startTime = Date.now();

  // Set the response header immediately (before next() so all handlers can read it)
  res.setHeader("X-Request-Id", req.requestId);

  // Intercept response finish
  res.on("finish", () => {
    const statusCode = res.statusCode;
    if (statusCode >= 400) {
      const durationMs = Date.now() - req.startTime;
      // Fire-and-forget; captureError never throws
      detectionService
        .captureError({
          req,
          err: req._guardianErr || null, // set by error middleware if available
          statusCode,
          durationMs,
        })
        .catch((err) => logger.error("[SystemGuardian/Monitoring] captureError threw", err));
    }
  });

  next();
}

module.exports = { monitoringMiddleware };
