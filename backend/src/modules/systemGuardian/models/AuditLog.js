"use strict";
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    actorRole: { type: String, default: null },
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },
    action: { type: String, required: true },
    beforeStatus: { type: String, default: null },
    afterStatus: { type: String, default: null },
    outcome: { type: String, enum: ["success", "failure"], default: "success" },
    requestId: { type: String, default: null },
    note: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "system_audit_logs" }
);

auditLogSchema.index({ incidentId: 1, createdAt: -1 });

// Guard against OverwriteModelError on hot-reload (nodemon)
module.exports = mongoose.models.GuardianAuditLog || mongoose.model("GuardianAuditLog", auditLogSchema);
