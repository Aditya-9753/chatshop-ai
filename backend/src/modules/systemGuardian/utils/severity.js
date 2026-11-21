"use strict";

const DB_INFRA_CATEGORIES = new Set(["DATABASE", "INFRA"]);
const AUTH_CATEGORY = "AUTH";

/**
 * Classify an error into a severity level.
 *
 * Rules (first match wins):
 *  CRITICAL – 5xx AND category DATABASE|INFRA, OR errorCode starts with "CRITICAL_"
 *  HIGH     – any 5xx, OR AUTH category with repeated failures (occurrenceCount > 5)
 *  MEDIUM   – 4xx (excluding 400 when category is BUSINESS_LOGIC, 401, 403, 404),
 *             OR latency > 5000 ms
 *  LOW      – everything else
 *
 * @param {object} opts
 * @param {number} [opts.statusCode]
 * @param {string} [opts.category]
 * @param {string} [opts.errorCode]
 * @param {number} [opts.durationMs]
 * @param {number} [opts.occurrenceCount]
 * @returns {"CRITICAL"|"HIGH"|"MEDIUM"|"LOW"}
 */
function classifySeverity({ statusCode, category, errorCode, durationMs, occurrenceCount } = {}) {
  const code = statusCode || 0;
  const dur = durationMs || 0;
  const occ = occurrenceCount || 1;
  const cat = (category || "").toUpperCase();
  const ec = (errorCode || "").toUpperCase();

  // CRITICAL
  if (ec.startsWith("CRITICAL_")) return "CRITICAL";
  if (code >= 500 && DB_INFRA_CATEGORIES.has(cat)) return "CRITICAL";

  // HIGH
  if (code >= 500) return "HIGH";
  if (cat === AUTH_CATEGORY && occ > 5) return "HIGH";

  // MEDIUM
  if (dur > 5000) return "MEDIUM";
  if (code >= 400 && ![400, 401, 403, 404].includes(code)) return "MEDIUM";
  // 400 on a non-BUSINESS_LOGIC category is MEDIUM too
  if (code === 400 && cat !== "BUSINESS_LOGIC") return "MEDIUM";

  return "LOW";
}

/**
 * Decide whether this error warrants creating/updating an incident.
 * Returns false for noise that should be silently dropped.
 *
 * @param {object} opts
 * @param {number} [opts.statusCode]
 * @param {string} [opts.category]
 * @returns {boolean}
 */
function shouldCreateIncident({ statusCode, category } = {}) {
  const code = statusCode || 0;
  const cat = (category || "").toUpperCase();

  // Always skip unauthenticated / forbidden / not-found
  if ([401, 403, 404].includes(code)) return false;

  // Skip validation / business-logic 400s – they are user errors, not incidents
  if (code === 400 && cat === "BUSINESS_LOGIC") return false;

  return true;
}

module.exports = { classifySeverity, shouldCreateIncident };
