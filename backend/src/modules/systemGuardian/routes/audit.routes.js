"use strict";
const router = require("express").Router();
const { protect } = require("../../../middleware/auth.middleware");
const { isAdmin, superAdminOnly } = require("../../../middleware/admin.middleware");
const ctrl = require("../controllers/audit.controller");

const guard = [protect, isAdmin, superAdminOnly];

router.get("/", guard, ctrl.listAuditLogs);

module.exports = router;
