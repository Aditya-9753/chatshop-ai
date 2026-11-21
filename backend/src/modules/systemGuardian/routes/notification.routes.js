"use strict";
const router = require("express").Router();
const { protect } = require("../../../middleware/auth.middleware");
const { isAdmin, superAdminOnly } = require("../../../middleware/admin.middleware");
const ctrl = require("../controllers/incident.controller");

const guard = [protect, isAdmin, superAdminOnly];

router.get("/", guard, ctrl.listNotifications);
router.patch("/:id/read", guard, ctrl.markNotificationRead);

module.exports = router;
