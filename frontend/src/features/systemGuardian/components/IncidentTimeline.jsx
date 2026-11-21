import React from "react";
import { User, ArrowRight, Clock } from "lucide-react";
import { Badge, cn } from "../../../components/ui";

const ACTION_LABELS = {
  status_changed: "Status changed",
  acknowledged: "Acknowledged",
  investigating: "Investigation started",
  escalated: "Escalated",
  resolved: "Resolved",
  note_added: "Note added",
  recovery_action: "Recovery action run",
  created: "Incident created",
};

const STATUS_TONES = {
  OPEN: "accent",
  ACKNOWLEDGED: "warning",
  INVESTIGATING: "warning",
  RESOLVED: "success",
  ESCALATED: "danger",
};

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <Badge tone={STATUS_TONES[status] || "neutral"} dot>
      {status}
    </Badge>
  );
}

function TimelineEntry({ entry, isLast }) {
  const action = ACTION_LABELS[entry.action] || entry.action;
  const hasStatusChange = entry.beforeStatus || entry.afterStatus;

  return (
    <li className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div
          className="absolute left-3.5 top-8 bottom-0 w-px bg-line"
          aria-hidden="true"
        />
      )}

      {/* Dot */}
      <div
        className={cn(
          "relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line",
          entry.outcome === "success"
            ? "bg-success-soft"
            : entry.outcome === "failed"
            ? "bg-danger-soft"
            : "bg-surface-2"
        )}
      >
        <User
          className={cn(
            "h-3.5 w-3.5",
            entry.outcome === "success"
              ? "text-success-fg"
              : entry.outcome === "failed"
              ? "text-danger-fg"
              : "text-fg-muted"
          )}
          aria-hidden="true"
        />
      </div>

      {/* Content */}
      <div className="flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-fg">{action}</span>
          {hasStatusChange && (
            <div className="flex items-center gap-1.5">
              {entry.beforeStatus && <StatusBadge status={entry.beforeStatus} />}
              {entry.beforeStatus && entry.afterStatus && (
                <ArrowRight className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" />
              )}
              {entry.afterStatus && <StatusBadge status={entry.afterStatus} />}
            </div>
          )}
          {entry.outcome && entry.outcome !== "success" && (
            <Badge tone={entry.outcome === "failed" ? "danger" : "warning"}>
              {entry.outcome}
            </Badge>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          {entry.actorRole && (
            <span className="capitalize">{entry.actorRole}</span>
          )}
          {entry.actorUserId && (
            <span className="font-mono">{String(entry.actorUserId).slice(-6)}</span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {entry.createdAt
              ? new Date(entry.createdAt).toLocaleString()
              : "—"}
          </span>
        </div>

        {entry.note && (
          <p className="mt-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-fg-muted">
            {entry.note}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Vertical timeline of audit log entries for one incident.
 */
export default function IncidentTimeline({ entries = [], loading }) {
  if (loading) {
    return (
      <ul className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <li key={i} className="flex gap-4 animate-pulse">
            <div className="mt-1 h-7 w-7 rounded-full bg-surface-2 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-40 rounded bg-surface-2" />
              <div className="h-3 w-24 rounded bg-surface-2" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (!entries.length) {
    return (
      <p className="text-sm text-fg-muted">No timeline entries yet.</p>
    );
  }

  return (
    <ul className="space-y-0">
      {entries.map((entry, i) => (
        <TimelineEntry
          key={entry._id || i}
          entry={entry}
          isLast={i === entries.length - 1}
        />
      ))}
    </ul>
  );
}
