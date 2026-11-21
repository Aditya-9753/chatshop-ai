import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, Siren } from "lucide-react";
import {
  Badge,
  Button,
  PageHeader,
  ErrorState,
  EmptyState,
  cn,
} from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import guardianApi from "../../../services/guardianApi";
import { useGuardianSocket } from "../../../hooks/useGuardianSocket";
import IncidentFilters from "../components/IncidentFilters";

const SEVERITY_TONES = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
};

const STATUS_TONES = {
  OPEN: "accent",
  ACKNOWLEDGED: "warning",
  INVESTIGATING: "warning",
  RESOLVED: "success",
  ESCALATED: "danger",
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IncidentCenter() {
  const navigate = useNavigate();
  const toast = useToast();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newCount, setNewCount] = useState(0);
  const [filters, setFilters] = useState({
    status: "ACTIVE",
    severity: "",
    search: "",
    from: "",
    to: "",
  });

  const { newIncident, updatedIncident } = useGuardianSocket();

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await guardianApi.getIncidents({
        ...Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v)
        ),
        page,
        limit: 20,
      });
      const data = res.data || res;
      const list = data.incidents || data.data || data || [];
      const total = data.totalPages || data.pages || 1;
      setIncidents(list);
      setTotalPages(total);
    } catch (err) {
      setError(err.message || "Failed to load incidents");
      toast.error("Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [filters, page, toast]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Real-time new incident
  useEffect(() => {
    if (!newIncident) return;
    if (filters.status && filters.status !== "ACTIVE" && filters.status !== newIncident.status) return;
    setIncidents((prev) => [
      newIncident,
      ...prev.filter((incident) => String(incident._id) !== String(newIncident._id)),
    ]);
    if (newIncident.severity === "CRITICAL") {
      setNewCount((c) => c + 1);
      toast.error(`New CRITICAL incident: ${newIncident.title}`, { duration: 6000 });
    }
  }, [newIncident, filters.status, toast]);

  useEffect(() => {
    if (updatedIncident) fetchIncidents();
  }, [updatedIncident, fetchIncidents]);

  function handleFiltersChange(f) {
    setFilters(f);
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Incident Center"
        description="Monitor and manage system incidents"
        icon={Siren}
        action={
          newCount > 0 && (
            <Badge tone="danger" dot>
              {newCount} new critical
            </Badge>
          )
        }
      />

      <div className="mt-6 space-y-4">
        <IncidentFilters filters={filters} onChange={handleFiltersChange} />

        {error ? (
          <ErrorState
            title="Failed to load incidents"
            description={error}
            action={<Button onClick={fetchIncidents}>Retry</Button>}
          />
        ) : loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg border border-line bg-surface"
              />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No incidents found"
            description="All clear, or try adjusting your filters."
          />
        ) : (
          <>
            <div className="rounded-xl border border-line bg-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2">
                      {[
                        "Title",
                        "Severity",
                        "Status",
                        "Shop",
                        "Module",
                        "Endpoint",
                        "First Seen",
                        "Last Seen",
                        "#",
                      ].map((h) => (
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
                    {incidents.map((inc) => (
                      <tr
                        key={inc._id}
                        onClick={() =>
                          navigate(`/admin/dashboard?section=guardian_incidents&incident=${inc._id}`)
                        }
                        className="cursor-pointer transition-colors hover:bg-surface-2"
                      >
                        <td className="max-w-[200px] truncate px-4 py-3 font-medium text-fg">
                          {inc.title}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={SEVERITY_TONES[inc.severity] || "neutral"}>
                            {inc.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONES[inc.status] || "neutral"} dot>
                            {inc.status}
                          </Badge>
                        </td>
                        <td className="max-w-[120px] truncate px-4 py-3 text-fg-muted">
                          {inc.shopId?.businessInfo?.businessName ||
                            inc.shopId?.name ||
                            inc.shopId ||
                            "—"}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">{inc.module || "—"}</td>
                        <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-fg-muted">
                          {inc.endpoint || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                          {fmt(inc.firstSeenAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                          {fmt(inc.lastSeenAt)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-fg-muted">
                          {inc.occurrenceCount ?? 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-fg-muted">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ChevronLeft}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Previous page"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ChevronRight}
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
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
