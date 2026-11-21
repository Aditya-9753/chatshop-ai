import React, { useEffect, useState, useCallback } from "react";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button, PageHeader, ErrorState, EmptyState } from "../../../components/ui";
import guardianApi from "../../../services/guardianApi";
import { useToast } from "../../../components/Toast";

const ACTION_TONES = {
  status_change: "accent",
  recovery_action: "warning",
  resolved: "success",
  escalated: "danger",
};

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AuditLogs() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await guardianApi.getAuditLogs({ page, limit: 25 });
      const data = res.data || res;
      const list = Array.isArray(data) ? data : data.logs || data.data || [];
      setLogs(list);
      setTotalPages(data.totalPages || data.pages || 1);
    } catch (err) {
      setError(err.message || "Failed to load audit logs");
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Complete history of all admin actions on incidents"
        icon={History}
      />

      <div className="mt-6 space-y-4">
        {error ? (
          <ErrorState
            title="Failed to load audit logs"
            description={error}
            action={<Button onClick={fetchLogs}>Retry</Button>}
          />
        ) : loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg border border-line bg-surface" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit logs yet"
            description="Admin actions on incidents will appear here."
          />
        ) : (
          <>
            <div className="rounded-xl border border-line bg-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2">
                      {["Actor", "Action", "Incident", "Before", "After", "Outcome", "Time"].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-fg-muted"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {logs.map((log, i) => (
                      <tr key={log._id || i} className="hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-fg">
                            {log.actorUserId?.name || log.actorUserId || "System"}
                          </span>
                          <span className="ml-1 text-xs text-fg-muted">
                            ({log.actorRole || "—"})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={ACTION_TONES[log.action] || "neutral"}>
                            {log.action?.replace(/_/g, " ") || "—"}
                          </Badge>
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-fg-muted font-mono text-xs">
                          {log.incidentId?._id || log.incidentId || "—"}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {log.beforeStatus || "—"}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">
                          {log.afterStatus || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={log.outcome === "success" ? "success" : "danger"}>
                            {log.outcome || "—"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                          {fmt(log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-fg-muted">Page {page} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary" size="sm" icon={ChevronLeft}
                    disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                    aria-label="Previous page"
                  />
                  <Button
                    variant="secondary" size="sm" icon={ChevronRight}
                    disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
