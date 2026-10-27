const AuditLog = require("../models/AuditLog.model");

// Record an action in the audit log. Never throws: a logging failure must
// not break the action itself.
async function audit(req, action, { target, details, actor } = {}) {
  try {
    const user = actor || req?.user;
    await AuditLog.create({
      actor: user?._id,
      actorEmail: user?.email,
      action,
      target,
      details,
      ip: req?.ip,
    });
  } catch (error) {
    console.warn("Audit log write failed:", error.message);
  }
}

module.exports = audit;
