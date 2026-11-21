import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, X } from "lucide-react";
import { Badge, cn } from "../../../components/ui";
import { useRealtime } from "../../../services/realtime";

/**
 * Live alert bell with dropdown showing unread critical incidents.
 * Subscribe to guardian:incident:new socket event and accumulate
 * critical incidents in component state.
 */
export default function LiveAlerts({ initialCritical = [] }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState(initialCritical);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Real-time subscription
  useRealtime("guardian:incident:new", (incident) => {
    if (incident.severity === "CRITICAL") {
      setAlerts((prev) => [incident, ...prev.filter((item) => item._id !== incident._id)].slice(0, 20));
    }
  });
  useRealtime("guardian:incident:updated", (update) => {
    if (update.status === "RESOLVED") {
      const id = String(update.incidentId?._id || update.incidentId || update._id);
      setAlerts((prev) => prev.filter((alert) => String(alert._id) !== id));
    }
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unread = alerts.filter((a) => !a._read).length;

  function dismiss(id, e) {
    e.stopPropagation();
    setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, _read: true } : a)));
  }

  function goToIncident(id) {
    setOpen(false);
    setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, _read: true } : a)));
    navigate(`/admin/dashboard?section=guardian_incidents&incident=${id}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Guardian alerts${unread ? ` — ${unread} new` : ""}`}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg",
          open && "bg-surface-2 text-fg"
        )}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-line bg-surface shadow-popover">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold text-fg">Critical Alerts</span>
            {unread > 0 && (
              <Badge tone="danger">{unread} new</Badge>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Bell className="h-6 w-6 text-fg-subtle" aria-hidden="true" />
              <p className="text-sm text-fg-muted">No critical alerts</p>
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert._id}>
                  <div
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2",
                      !alert._read && "bg-danger-soft/30"
                    )}
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-danger-fg"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      onClick={() => goToIncident(alert._id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-fg">
                        {alert.title}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {alert.module || alert.category} ·{" "}
                        {alert.firstSeenAt
                          ? new Date(alert.firstSeenAt).toLocaleTimeString()
                          : "just now"}
                      </p>
                    </button>
                    {!alert._read && (
                      <button
                        type="button"
                        onClick={(e) => dismiss(alert._id, e)}
                        aria-label="Dismiss"
                        className="ml-auto shrink-0 rounded p-0.5 text-fg-muted hover:text-fg"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-line px-4 py-2">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate("/admin/dashboard?section=guardian_incidents"); }}
              className="text-xs font-medium text-accent hover:underline"
            >
              View all incidents →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
