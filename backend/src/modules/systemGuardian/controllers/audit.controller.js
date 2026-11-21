"use strict";
const AuditLog = require("../models/AuditLog");

async function listAuditLogs(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const query = {};
    if (req.query.incidentId) query.incidentId = req.query.incidentId;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("actorUserId", "name email")
        .populate("incidentId", "title status severity")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({ success: true, logs, total, page, limit, totalPages, pages: totalPages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listAuditLogs };
