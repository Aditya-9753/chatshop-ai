"use strict";
const router = require("express").Router();
const { protect } = require("../../../middleware/auth.middleware");
const { isAdmin, superAdminOnly } = require("../../../middleware/admin.middleware");
const ctrl = require("../controllers/recovery.controller");

const guard = [protect, isAdmin, superAdminOnly];

// POST /api/admin/guardian/incidents/:id/recover
router.post("/:id/recover", guard, ctrl.runRecovery);
router.post("/:id/actions/:action", guard, ctrl.runRecovery);

module.exports = router;
