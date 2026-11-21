"use strict";
const Incident = require("../models/Incident");
const AuditLog = require("../models/AuditLog");
const { GuardianNotification } = require("../models/Notification");
const logger = require("../../../utils/logger");
const { emitToSuperAdmins } = require("../sockets/guardian.socket");

// Allowlisted recovery actions
const ALLOWED_ACTIONS = new Set(["safe_retry", "reconnect_integration", "clear_cache", "resolve", "escalate"]);

// Payment/billing error codes that block safe_retry
const PAYMENT_CODES = ["PAYMENT_", "BILLING_", "RAZORPAY_", "REFUND_", "CHARGE_", "SUBSCRIPTION_"];

/**
 * Run a recovery action against an incident.
 *
 * @param {string} incidentId
 * @param {string} action        - one of ALLOWED_ACTIONS
 * @param {object} opts
 * @param {string} opts.actorUserId
 * @param {string} opts.actorRole
 * @param {string} [opts.note]
 * @param {string} [opts.shopId]  - for scoping cache clears
 */
async function runRecoveryAction(incidentId, action, { actorUserId, actorRole, note, shopId } = {}) {
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`Recovery action '${action}' is not allowed.`);
  }

  const incident = await Incident.findById(incidentId);
  if (!incident) throw new Error("Incident not found");

  const beforeStatus = incident.status;
  let afterStatus = beforeStatus;
  let outcome = "success";
  let resultMessage = "";

  switch (action) {
    case "safe_retry": {
      // Block for payment/billing incidents
      const ec = (incident.errorCode || "").toUpperCase();
      if (PAYMENT_CODES.some((prefix) => ec.startsWith(prefix))) {
        throw new Error("safe_retry is not allowed for payment or billing incidents.");
      }
      resultMessage = "Safe retry hint logged. No automatic retry executed.";
      logger.info(`[SystemGuardian/Recovery] safe_retry hint for incident ${incidentId}`);
      break;
    }

    case "reconnect_integration": {
      // Log + audit only – no actual OAuth token operations
      resultMessage = "OAuth reconnect hint logged. Manual re-auth required.";
      logger.info(`[SystemGuardian/Recovery] reconnect_integration hint for incident ${incidentId}`);
      break;
    }

    case "clear_cache": {
      // Scoped cache invalidation hint
      resultMessage = `Cache invalidation hint for shop ${shopId || "global"} logged.`;
      logger.info(`[SystemGuardian/Recovery] clear_cache hint for shop=${shopId}, incident=${incidentId}`);
      break;
    }

    case "resolve": {
      if (!String(note || "").trim()) throw new Error("resolutionNote is required to resolve an incident.");
      incident.status = "RESOLVED";
      incident.resolvedAt = new Date();
      incident.resolutionNote = String(note).trim();
      await incident.save();
      await GuardianNotification.updateMany(
        { incidentId: incident._id, readAt: null },
        { $set: { readAt: new Date() } }
      );
      afterStatus = "RESOLVED";
      resultMessage = "Incident resolved.";
      break;
    }

    case "escalate": {
      incident.status = "ESCALATED";
      await incident.save();
      afterStatus = "ESCALATED";
      resultMessage = "Incident escalated to developer category.";
      break;
    }

    default:
      outcome = "failure";
      break;
  }

  // Persist audit log
  try {
    await AuditLog.create({
      actorUserId: actorUserId || null,
      actorRole: actorRole || null,
      incidentId: incident._id,
      action,
      beforeStatus,
      afterStatus,
      outcome,
      note: note || resultMessage,
    });
  } catch (err) {
    logger.error("[SystemGuardian/Recovery] AuditLog write failed", err);
  }

  // Emit status change if relevant
  if (afterStatus !== beforeStatus) {
    try {
      emitToSuperAdmins("guardian:incident:updated", { incidentId: incident._id, status: afterStatus, beforeStatus });
    } catch (err) {
      logger.warn("[SystemGuardian/Recovery] Socket emit failed", err?.message);
    }
  }

  return { incident, action, beforeStatus, afterStatus, outcome, message: resultMessage };
}

module.exports = { runRecoveryAction };
