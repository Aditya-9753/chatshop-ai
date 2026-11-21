"use strict";
/**
 * System Guardian Module – entry point
 *
 * Usage in app.js:
 *   const guardian = require('./modules/systemGuardian');
 *   app.use(guardian.monitoringMiddleware);       // early, before routes
 *   app.use('/api/admin/guardian', guardian.router);
 *   app.use(guardian.guardianErrorHandler);       // after routes
 *
 * Usage in server.js (after realtime.init):
 *   guardian.init(io);
 */

const { Router } = require("express");

// Middleware
const { monitoringMiddleware } = require("./middleware/monitoring.middleware");
const { guardianErrorHandler } = require("./middleware/error.middleware");

// Routes
const incidentRoutes = require("./routes/incident.routes");
const healthRoutes = require("./routes/health.routes");
const recoveryRoutes = require("./routes/recovery.routes");
const auditRoutes = require("./routes/audit.routes");
const notificationRoutes = require("./routes/notification.routes");

// Services
const healthService = require("./services/health.service");
const { setupGuardianSocket } = require("./sockets/guardian.socket");

// Compose router
const router = Router();
router.use("/incidents", incidentRoutes);
router.use("/health", healthRoutes);
router.use("/incidents", recoveryRoutes); // /incidents/:id/recover
router.use("/notifications", notificationRoutes);
router.use("/audit-logs", auditRoutes);

/**
 * Initialise the Guardian module.
 * Call once after the socket.io server is ready.
 *
 * @param {import("socket.io").Server} io
 */
function init(io) {
  setupGuardianSocket(io);
  healthService.startSchedule();
}

module.exports = {
  router,
  monitoringMiddleware,
  guardianErrorHandler,
  init,
};
