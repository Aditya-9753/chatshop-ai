"use strict";
const healthService = require("../services/health.service");

/** GET /api/admin/guardian/health */
async function getHealthStatus(req, res) {
  try {
    const checks = await healthService.getLatestHealthChecks();
    res.json({ success: true, data: { services: checks }, services: checks, checks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/** POST /api/admin/guardian/health/run */
async function triggerHealthCheck(req, res) {
  try {
    await healthService.runHealthChecks();
    const checks = await healthService.getLatestHealthChecks();
    res.json({ success: true, message: "Health checks completed", data: { services: checks }, services: checks, checks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getHealthStatus, triggerHealthCheck };
