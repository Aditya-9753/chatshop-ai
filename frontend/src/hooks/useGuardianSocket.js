import { useState, useCallback } from "react";
import { useRealtime } from "../services/realtime";

/**
 * Custom hook that subscribes to all System Guardian realtime events.
 * Returns the most recent payload for each event type.
 */
export function useGuardianSocket() {
  const [newIncident, setNewIncident] = useState(null);
  const [updatedIncident, setUpdatedIncident] = useState(null);
  const [resolvedIncident, setResolvedIncident] = useState(null);
  const [healthChanged, setHealthChanged] = useState(null);

  const handleNew = useCallback((payload) => setNewIncident(payload), []);
  const handleUpdated = useCallback((payload) => setUpdatedIncident(payload), []);
  const handleResolved = useCallback((payload) => setResolvedIncident(payload), []);
  const handleHealth = useCallback((payload) => setHealthChanged(payload), []);

  useRealtime("guardian:incident:new", handleNew);
  useRealtime("guardian:incident:updated", handleUpdated);
  useRealtime("guardian:incident:resolved", handleResolved);
  useRealtime("guardian:health:changed", handleHealth);

  return { newIncident, updatedIncident, resolvedIncident, healthChanged };
}
