"use strict";
const Incident = require("../models/Incident");
const ErrorEvent = require("../models/ErrorEvent");
const { GuardianNotification } = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const { generateFingerprint } = require("../utils/fingerprint");
const { emitToSuperAdmins } = require("../sockets/guardian.socket");
const logger = require("../../../utils/logger");

// Active (not yet resolved) statuses used when de-duplicating
const ACTIVE_STATUSES = ["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "ESCALATED"];
const STATUS_TRANSITIONS = {
  OPEN: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["INVESTIGATING", "ESCALATED"],
  INVESTIGATING: ["RESOLVED", "ESCALATED"],
  ESCALATED: ["RESOLVED"],
  RESOLVED: [],
};

/**
 * Create a new incident or increment an existing one.
 * Persists ErrorEvent and Notification to DB before emitting socket events.
 */
async function createOrUpdateIncident({
  shopId,
  userId,
  title,
  category,
  errorCode,
  severity,
  module: mod,
  endpoint,
  requestId,
  safeMessage,
  stackHash,
  durationMs,
  metadata,
  route,
  method,
  statusCode,
}) {
  const fingerprint = generateFingerprint({ category, errorCode, module: mod, endpoint, statusCode });

  // Check for an existing active incident with the same fingerprint
  let incident = await Incident.findOne({
    fingerprint,
    status: { $in: ACTIVE_STATUSES },
  });

  if (incident) {
    // --- Update existing incident ---
    incident.occurrenceCount += 1;
    incident.lastSeenAt = new Date();
    if (requestId) incident.requestId = requestId;
    await incident.save();

    // Always persist an ErrorEvent for each occurrence
    await _saveErrorEvent({
      incidentId: incident._id,
      requestId,
      safeMessage,
      stackHash,
      route,
      method,
      statusCode,
      durationMs,
      metadata,
    });

    // Emit socket update (after DB write)
    _emitSafe("guardian:incident:updated", { incidentId: incident._id, occurrenceCount: incident.occurrenceCount, lastSeenAt: incident.lastSeenAt });

    return incident;
  }

  // --- Create new incident ---
  incident = await Incident.create({
    shopId: shopId || null,
    userId: userId || null,
    title,
    category,
    errorCode: errorCode || null,
    severity,
    status: "OPEN",
    fingerprint,
    module: mod || null,
    endpoint: endpoint || null,
    requestId: requestId || null,
    occurrenceCount: 1,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  });

  // Persist ErrorEvent
  await _saveErrorEvent({
    incidentId: incident._id,
    requestId,
    safeMessage,
    stackHash,
    route,
    method,
    statusCode,
    durationMs,
    metadata,
  });

  // Persist Notification before emitting socket event
  let notification = null;
  try {
    notification = await GuardianNotification.create({
      incidentId: incident._id,
      recipientRole: "admin",
      eventType: "incident:new",
      title: `New ${severity} incident: ${title}`,
      severity,
    });
  } catch (err) {
    logger.error("[SystemGuardian] Failed to persist notification", err);
  }

  // Emit socket event AFTER DB write
  _emitSafe("guardian:incident:new", {
    _id: incident._id,
    incidentId: incident._id,
    title,
    severity,
    category,
    module: mod,
    endpoint,
    status: "OPEN",
    firstSeenAt: incident.firstSeenAt,
    lastSeenAt: incident.lastSeenAt,
    notificationId: notification?._id,
  });

  return incident;
}

/** Persist an ErrorEvent document, absorbing errors. */
async function _saveErrorEvent({ incidentId, requestId, safeMessage, stackHash, route, method, statusCode, durationMs, metadata }) {
  try {
    await ErrorEvent.create({
      incidentId,
      requestId: requestId || null,
      safeMessage: safeMessage || null,
      stackHash: stackHash || null,
      route: route || null,
      method: method || null,
      statusCode: statusCode || null,
      durationMs: durationMs || null,
      environment: process.env.NODE_ENV || "development",
      metadata: metadata || {},
    });
  } catch (err) {
    logger.error("[SystemGuardian] Failed to persist error event", err);
  }
}

/** Emit to super-admins room without throwing. */
function _emitSafe(event, payload) {
  try {
    emitToSuperAdmins(event, payload);
  } catch (err) {
    logger.warn("[SystemGuardian] Socket emit failed", err?.message);
  }
}

/**
 * List incidents with optional filters.
 * @param {object} filters - { status, severity, category, shopId, page, limit }
 */
async function getIncidents({ status, severity, category, shopId, search, from, to, page = 1, limit = 20 } = {}) {
  const query = {};
  if (status === "ACTIVE") query.status = { $in: ACTIVE_STATUSES };
  else if (status) query.status = status;
  if (severity) query.severity = severity;
  if (category) query.category = category;
  if (shopId) query.shopId = shopId;
  if (search) {
    const re = new RegExp(String(search).slice(0, 100), "i");
    query.$or = [{ title: re }, { errorCode: re }, { module: re }, { endpoint: re }];
  }
  if (from || to) {
    query.lastSeenAt = {};
    if (from) query.lastSeenAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        query.lastSeenAt.$lte = end;
      }
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [incidents, total] = await Promise.all([
    Incident.find(query).sort({ lastSeenAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Incident.countDocuments(query),
  ]);

  return { incidents, total, page: Number(page), limit: Number(limit) };
}

/**
 * Get a single incident by ID, including recent ErrorEvents.
 */
async function getIncidentById(id) {
  const incident = await Incident.findById(id).lean();
  if (!incident) return null;
  const events = await ErrorEvent.find({ incidentId: id }).sort({ createdAt: -1 }).limit(20).lean();
  return { incident, events };
}

/**
 * Update an incident's status and write an audit log.
 */
async function updateIncidentStatus(id, { status, note, actorUserId, actorRole }) {
  const incident = await Incident.findById(id);
  if (!incident) throw new Error("Incident not found");

  const beforeStatus = incident.status;
  if (!STATUS_TRANSITIONS[beforeStatus]?.includes(status)) {
    throw new Error(`Cannot change incident status from ${beforeStatus} to ${status}.`);
  }
  if (status === "RESOLVED" && !String(note || "").trim()) {
    throw new Error("A resolution note is required.");
  }
  incident.status = status;
  if (status === "RESOLVED") {
    incident.resolvedAt = new Date();
    incident.resolutionNote = String(note).trim();
  }
  await incident.save();
  if (status === "RESOLVED") {
    await GuardianNotification.updateMany(
      { incidentId: incident._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
  }

  // Audit
  try {
    await AuditLog.create({
      actorUserId: actorUserId || null,
      actorRole: actorRole || null,
      incidentId: incident._id,
      action: `status_change:${status}`,
      beforeStatus,
      afterStatus: status,
      outcome: "success",
      note: note || null,
    });
  } catch (err) {
    logger.error("[SystemGuardian] AuditLog write failed", err);
  }

  _emitSafe("guardian:incident:updated", { incidentId: incident._id, status, beforeStatus });

  return incident;
}

async function getOverview() {
  const [total, open, critical, resolved, recent] = await Promise.all([
    Incident.countDocuments(),
    Incident.countDocuments({ status: { $in: ["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "ESCALATED"] } }),
    Incident.countDocuments({ severity: "CRITICAL", status: { $ne: "RESOLVED" } }),
    Incident.countDocuments({ status: "RESOLVED" }),
    Incident.find().sort({ lastSeenAt: -1 }).limit(5).lean(),
  ]);
  return { total, open, critical, resolved, recent };
}

module.exports = { createOrUpdateIncident, getIncidents, getIncidentById, updateIncidentStatus, getOverview };
