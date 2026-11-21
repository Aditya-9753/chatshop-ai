"use strict";
const router = require("express").Router();
const { protect } = require("../../../middleware/auth.middleware");
const { isAdmin, superAdminOnly } = require("../../../middleware/admin.middleware");
const ctrl = require("../controllers/incident.controller");

// All guardian incident routes require: authenticated → admin → super-admin
const guard = [protect, isAdmin, superAdminOnly];

router.get("/overview", guard, ctrl.getOverview);
router.get("/", guard, ctrl.listIncidents);
router.get("/notifications", guard, ctrl.listNotifications);
router.patch("/notifications/:id/read", guard, ctrl.markNotificationRead);
router.get("/:id/events", guard, ctrl.getIncidentEvents);
router.get("/:id", guard, ctrl.getIncident);
router.patch("/:id/status", guard, ctrl.updateStatus);

module.exports = router;
