import React, { useState } from "react";
import {
  RefreshCw,
  Link2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button, Card, CardHeader, CardBody, cn } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import guardianApi from "../../../services/guardianApi";

const ACTIONS = [
  {
    key: "safe-retry",
    label: "Safe Retry",
    description: "Re-attempt the last failed operation safely.",
    icon: RefreshCw,
    variant: "secondary",
    confirm: "Re-run the last operation? This will retry the failed request.",
  },
  {
    key: "reconnect-integration",
    label: "Reconnect Integration",
    description: "Drop and re-establish integration connections.",
    icon: Link2,
    variant: "secondary",
    confirm: "Reconnect integration? Active sessions may be briefly interrupted.",
  },
  {
    key: "clear-cache",
    label: "Clear Cache",
    description: "Flush the relevant cache layer for this service.",
    icon: Trash2,
    variant: "danger-ghost",
    confirm: "Clear cache? Requests may be slower until the cache warms up.",
  },
];

function ConfirmModal({ action, note, onNoteChange, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-popover">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft">
            <AlertTriangle className="h-4 w-4 text-warning-fg" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-fg">Confirm: {action.label}</h3>
        </div>
        <p className="text-sm text-fg-muted">{action.confirm}</p>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Optional: add a note for the audit log…"
          rows={3}
          className={cn(
            "mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-fg placeholder:text-fg-muted",
            "focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
          )}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={action.variant === "danger-ghost" ? "danger" : "primary"}
            size="sm"
            loading={loading}
            onClick={onConfirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Recovery actions panel for an incident detail page.
 * incidentId - the incident's _id
 * applicableActions - optional array of action keys to show (default: show all)
 * onActionComplete - callback after a successful action
 */
export default function RecoveryActions({
  incidentId,
  applicableActions,
  onActionComplete,
}) {
  const toast = useToast();
  const [pending, setPending] = useState(null);  // the action being confirmed
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});

  const visibleActions = applicableActions
    ? ACTIONS.filter((a) => applicableActions.includes(a.key))
    : ACTIONS;

  async function runAction() {
    if (!pending) return;
    setLoading(true);
    try {
      await guardianApi.runRecoveryAction(incidentId, pending.key, { note });
      toast.success(`${pending.label} completed successfully`);
      setResults((r) => ({ ...r, [pending.key]: "success" }));
      onActionComplete?.();
    } catch (err) {
      toast.error(`${pending.label} failed: ${err.message || "Unknown error"}`);
      setResults((r) => ({ ...r, [pending.key]: "failed" }));
    } finally {
      setLoading(false);
      setPending(null);
      setNote("");
    }
  }

  if (!visibleActions.length) {
    return (
      <p className="text-sm text-fg-muted">
        No recovery actions are applicable for this incident.
      </p>
    );
  }

  return (
    <>
      <Card>
        <CardHeader title="Recovery Actions" description="Allowlisted remediation actions for this incident." />
        <CardBody>
          <div className="flex flex-col gap-3">
            {visibleActions.map((action) => {
              const Icon = action.icon;
              const result = results[action.key];
              return (
                <div
                  key={action.key}
                  className="flex items-center justify-between gap-4 rounded-lg border border-line bg-canvas px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-fg">{action.label}</p>
                      <p className="text-xs text-fg-muted">{action.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {result === "success" && (
                      <CheckCircle2 className="h-4 w-4 text-success-fg" aria-hidden="true" />
                    )}
                    <Button
                      variant={action.variant}
                      size="sm"
                      onClick={() => { setPending(action); setNote(""); }}
                    >
                      Run
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {pending && (
        <ConfirmModal
          action={pending}
          note={note}
          onNoteChange={setNote}
          onConfirm={runAction}
          onCancel={() => { setPending(null); setNote(""); }}
          loading={loading}
        />
      )}
    </>
  );
}
