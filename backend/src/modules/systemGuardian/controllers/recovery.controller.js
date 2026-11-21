"use strict";
const recoveryService = require("../services/recovery.service");

/** POST /api/admin/guardian/incidents/:id/recover */
async function runRecovery(req, res) {
  try {
    const actionFromBody = req.body?.action;
    const actionFromPath = req.params.action;
    const action = actionFromBody || actionFromPath?.replace(/-/g, "_");
    const { note, shopId } = req.body || {};
    if (!action) return res.status(400).json({ success: false, message: "action is required" });

    const result = await recoveryService.runRecoveryAction(req.params.id, action, {
      actorUserId: req.user?._id,
      actorRole: req.user?.role,
      note,
      shopId,
    });
    res.json({ success: true, result });
  } catch (err) {
    if (err.message === "Incident not found") return res.status(404).json({ success: false, message: err.message });
    if (err.message.startsWith("Recovery action")) return res.status(400).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { runRecovery };
