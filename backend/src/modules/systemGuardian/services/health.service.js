"use strict";
const mongoose = require("mongoose");
const HealthCheck = require("../models/HealthCheck");
const logger = require("../../../utils/logger");
const { emitToSuperAdmins } = require("../sockets/guardian.socket");

// Store the last known status per service so we can detect changes
const _lastStatus = new Map();

// setInterval handle (bounded – cleared on process exit)
let _intervalHandle = null;

/**
 * Run all health checks and persist results.
 * Emits guardian:health:changed when any service status changes.
 */
async function runHealthChecks() {
  const checks = await Promise.allSettled([_checkMongoDB()]);

  for (const result of checks) {
    if (result.status === "fulfilled") {
      const { serviceName, status, latencyMs, metadata } = result.value;
      try {
        await HealthCheck.create({ serviceName, status, latencyMs, checkedAt: new Date(), metadata });
      } catch (err) {
        logger.error("[SystemGuardian/Health] DB write failed", err);
      }

      const previous = _lastStatus.get(serviceName);
      if (previous !== undefined && previous !== status) {
        try {
          emitToSuperAdmins("guardian:health:changed", { serviceName, previous, current: status });
        } catch (err) {
          logger.warn("[SystemGuardian/Health] Socket emit failed", err?.message);
        }
      }
      _lastStatus.set(serviceName, status);
    } else {
      logger.error("[SystemGuardian/Health] check threw", result.reason);
    }
  }
}

/** Check MongoDB connection state */
async function _checkMongoDB() {
  const start = Date.now();
  let status = "unhealthy";
  let metadata = {};
  try {
    const state = mongoose.connection.readyState;
    // 1 = connected
    if (state === 1) {
      status = "healthy";
    } else if (state === 2 || state === 3) {
      // 2=connecting, 3=disconnecting
      status = "degraded";
    }
    metadata = { readyState: state };
  } catch (err) {
    metadata = { error: err.message };
  }
  return { serviceName: "mongodb", status, latencyMs: Date.now() - start, metadata };
}

/**
 * Returns the latest check document per service.
 */
async function getLatestHealthChecks() {
  // Aggregate to get the most recent doc per service
  return HealthCheck.aggregate([
    { $sort: { checkedAt: -1 } },
    { $group: { _id: "$serviceName", latest: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$latest" } },
    { $sort: { serviceName: 1 } },
  ]);
}

/**
 * Start scheduled health checks every 2 minutes.
 * Safe to call multiple times – only one interval is created.
 */
function startSchedule() {
  if (_intervalHandle) return;
  // Run once immediately (async, don't block)
  runHealthChecks().catch((err) => logger.error("[SystemGuardian/Health] initial check failed", err));
  _intervalHandle = setInterval(() => {
    runHealthChecks().catch((err) => logger.error("[SystemGuardian/Health] scheduled check failed", err));
  }, 2 * 60 * 1000); // 2 minutes

  // Allow process to exit cleanly
  if (_intervalHandle.unref) _intervalHandle.unref();
}

function stopSchedule() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}

module.exports = { runHealthChecks, getLatestHealthChecks, startSchedule, stopSchedule };
