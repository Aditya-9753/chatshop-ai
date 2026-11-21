import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Hash,
  AlertTriangle,
  Code2,
  Activity,
  ListChecks,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardBody,
  PageHeader,
  DetailRow,
  SectionLabel,
  ErrorState,
  Spinner,
  cn,
} from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import guardianApi from "../../../services/guardianApi";
import { useGuardianSocket } from "../../../hooks/useGuardianSocket";
import IncidentTimeline from "../components/IncidentTimeline";
import RecoveryActions from "../components/RecoveryActions";

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

const STATUS_TRANSITIONS = {
  OPEN: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["INVESTIGATING", "ESCALATED"],
  INVESTIGATING: ["RESOLVED", "ESCALATED"],
  ESCALATED: ["RESOLVED"],
  RESOLVED: [],
};

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default function IncidentDetails({ incidentId: propId }) {
  const params = useParams();
  const id = propId || params.id;
  const navigate = useNavigate();
  const toast = useToast();

  const [incident, setIncident] = useState(null);
  const [events, setEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status change state
  const [statusNote, setStatusNote] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [changingStatus, setChangingStatus] = useState(null);

  const { updatedIncident, resolvedIncident } = useGuardianSocket();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incRes, evtRes, logRes] = await Promise.all([
        guardianApi.getIncident(id),
        guardianApi.getIncidentEvents(id),
        guardianApi.getAuditLogs({ incidentId: id }),
      ]);
      setIncident(incRes.data?.incident || incRes.data || incRes.incident || incRes);
      setEvents(evtRes.data || evtRes || []);
      const logs = logRes.data || logRes;
      setAuditLogs(Array.isArray(logs) ? logs : logs?.logs || logs?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load incident");
      toast.error("Failed to load incident");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime merges
  useEffect(() => {
    if (updatedIncident?._id === id) setIncident(updatedIncident);
  }, [updatedIncident, id]);

  useEffect(() => {
    if (resolvedIncident?._id === id) setIncident(resolvedIncident);
  }, [resolvedIncident, id]);

  async function changeStatus(newStatus) {
    const noteVal = newStatus === "RESOLVED" ? resolutionNote : statusNote;
    if (newStatus === "RESOLVED" && !noteVal.trim()) {
      toast.error("Resolution note is required before resolving.");
      return;
    }
    setChangingStatus(newStatus);
    try {
      const res = await guardianApi.updateIncidentStatus(id, {
        status: newStatus,
        note: noteVal,
      });
      setIncident(res.data || res);
      setStatusNote("");
      setResolutionNote("");
      toast.success(`Incident ${newStatus.toLowerCase()}`);
      fetchAll(); // reload audit log
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setChangingStatus(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <ErrorState
        title="Incident not found"
        description={error || "This incident does not exist."}
        action={<Button onClick={() => navigate(-1)} icon={ArrowLeft}>Go back</Button>}
      />
    );
  }

  const transitions = STATUS_TRANSITIONS[incident.status] || [];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        icon={ArrowLeft}
        onClick={() => navigate("/admin/dashboard?section=guardian_incidents")}
      >
        All Incidents
      </Button>

      {/* ───── HEADER ───── */}
      <Card>
        <CardBody className="pt-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-fg">{incident.title}</h1>
              <p className="mt-0.5 text-sm text-fg-muted">
                {incident.shopId?.businessInfo?.businessName ||
                  incident.shopId?.name ||
                  incident.shopId ||
                  "Platform"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge tone={SEVERITY_TONES[incident.severity] || "neutral"}>
                {incident.severity}
              </Badge>
              <Badge tone={STATUS_TONES[incident.status] || "neutral"} dot>
                {incident.status}
              </Badge>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-fg-muted sm:grid-cols-4">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> First seen: {fmt(incident.firstSeenAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Last seen: {fmt(incident.lastSeenAt)}
            </span>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ───── IMPACT ───── */}
          <Card>
            <CardHeader title="Impact" icon={Activity} />
            <CardBody>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <DetailRow label="Module" value={incident.module || "—"} />
                <DetailRow label="Endpoint" value={incident.endpoint || "—"} mono />
                <DetailRow label="Occurrences" value={incident.occurrenceCount ?? 1} />
                <DetailRow label="Category" value={incident.category || "—"} />
                <DetailRow label="Error Code" value={incident.errorCode || "—"} mono />
              </div>
            </CardBody>
          </Card>

          {/* ───── DIAGNOSTICS ───── */}
          <Card>
            <CardHeader title="Diagnostics" icon={Code2} />
            <CardBody>
              <div className="space-y-3">
                <DetailRow label="Request ID" value={incident.requestId || "—"} mono />
                <DetailRow label="Stack Hash" value={incident.fingerprint || "—"} mono />

                {incident.safeMessage && (
                  <div>
                    <SectionLabel>Safe Message</SectionLabel>
                    <p className="mt-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg-muted">
                      {incident.safeMessage}
                    </p>
                  </div>
                )}

                {events.length > 0 && (
                  <div>
                    <SectionLabel className="mb-2">Recent Error Events</SectionLabel>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {events.slice(0, 10).map((evt, i) => (
                        <div
                          key={evt._id || i}
                          className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-fg-muted">
                              {evt.method} {evt.route}
                            </span>
                            <Badge tone={evt.statusCode >= 500 ? "danger" : "warning"}>
                              {evt.statusCode}
                            </Badge>
                          </div>
                          {evt.safeMessage && (
                            <p className="mt-1 text-fg-muted truncate">{evt.safeMessage}</p>
                          )}
                          <p className="mt-0.5 text-fg-subtle">
                            {fmt(evt.createdAt)} · {evt.durationMs}ms
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* ───── TIMELINE ───── */}
          <Card>
            <CardHeader title="Timeline" icon={ListChecks} />
            <CardBody>
              <IncidentTimeline entries={auditLogs} />
            </CardBody>
          </Card>
        </div>

        {/* ───── RIGHT SIDEBAR ───── */}
        <div className="space-y-6">
          {/* ───── ACTIONS ───── */}
          <Card>
            <CardHeader title="Status Actions" icon={Zap} />
            <CardBody>
              {transitions.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  No further status transitions for {incident.status}.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Note input (non-resolve) */}
                  {transitions.some((t) => t !== "RESOLVED") && (
                    <textarea
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Optional note…"
                      rows={2}
                      className={cn(
                        "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-fg placeholder:text-fg-muted",
                        "focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
                      )}
                    />
                  )}

                  <div className="flex flex-wrap gap-2">
                    {transitions.map((next) => {
                      const isResolve = next === "RESOLVED";
                      return (
                        <Button
                          key={next}
                          variant={
                            next === "ESCALATED"
                              ? "danger-ghost"
                              : next === "RESOLVED"
                              ? "primary"
                              : "secondary"
                          }
                          size="sm"
                          loading={changingStatus === next}
                          onClick={() => changeStatus(next)}
                        >
                          {next === "ACKNOWLEDGED"
                            ? "Acknowledge"
                            : next === "INVESTIGATING"
                            ? "Investigate"
                            : next === "ESCALATED"
                            ? "Escalate"
                            : "Resolve"}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Resolution note (required) */}
                  {transitions.includes("RESOLVED") && (
                    <div>
                      <SectionLabel className="mb-1">
                        Resolution Note{" "}
                        <span className="text-danger-fg">*</span>
                      </SectionLabel>
                      <textarea
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="Describe how this was resolved (required)…"
                        rows={3}
                        className={cn(
                          "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-fg placeholder:text-fg-muted",
                          "focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none",
                          !resolutionNote.trim() && "border-warning"
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ───── RECOVERY ACTIONS ───── */}
          <RecoveryActions
            incidentId={id}
            onActionComplete={fetchAll}
          />
        </div>
      </div>
    </div>
  );
}
