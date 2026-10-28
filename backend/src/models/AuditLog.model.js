const mongoose = require("mongoose");

// Record of security-relevant actions, shown in Admin → Security
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorEmail: String,
    action: { type: String, required: true }, // e.g. "user.delete", "auth.login"
    target: String, // what was acted on (an email, an id…)
    details: String,
    ip: String,
    // EMI & billing actions: which shop, what changed and why
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    entity: String,
    entityId: mongoose.Schema.Types.ObjectId,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    reason: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
