import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw, Shield, Play, Activity } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Button, PageHeader, ErrorState, Card, CardHeader, CardBody, cn } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import guardianApi from "../../../services/guardianApi";
import { useGuardianSocket } from "../../../hooks/useGuardianSocket";
import HealthCards from "../components/HealthCards";

const REFRESH_INTERVAL_MS = 30_000;

export default function SystemHealth() {
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);

  const { healthChanged } = useGuardianSocket();

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await guardianApi.getHealth();
      // Backend may return { services: [...] } or plain array
      const list = Array.isArray(res) ? res : (res.services || res.data?.services || []);
      setServices(list);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      if (!silent) {
        setError(err.message || "Failed to load health data");
        toast.error("Failed to load system health");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Auto-refresh
  useEffect(() => {
    const timer = setInterval(() => fetchHealth(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchHealth]);

  const runCheck = async () => {
    setChecking(true);
    try {
      await guardianApi.runHealthCheck();
      await fetchHealth(true);
      toast.success("Health checks completed");
    } catch (err) {
      toast.error(err.message || "Failed to run health checks");
    } finally {
      setChecking(false);
    }
  };

  // Real-time update: merge changed service into state
  useEffect(() => {
    if (!healthChanged) return;
    const updated = healthChanged.service || healthChanged;
    if (!updated?.serviceName) return;
    const normalized = updated.status
      ? updated
      : { ...updated, status: updated.current };
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.serviceName === normalized.serviceName);
      if (idx === -1) return [...prev, normalized];
      const next = [...prev];
      next[idx] = normalized;
      return next;
    });
  }, [healthChanged]);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="System Health"
          description="Real-time service health monitoring"
          icon={Shield}
        />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-line bg-surface"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="System Health"
          description="Real-time service health monitoring"
          icon={Shield}
        />
        <div className="mt-6">
          <ErrorState
            title="Failed to load health data"
            description={error}
            action={<Button onClick={() => fetchHealth()}>Retry</Button>}
          />
        </div>
      </div>
    );
  }

  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const unhealthyCount = services.filter((s) => s.status === "unhealthy").length;
  const unknownCount = services.length - healthyCount - degradedCount - unhealthyCount;
  const overallScore = services.length
    ? Math.round(((healthyCount + degradedCount * 0.5) / services.length) * 100)
    : 0;
  const overallTone = unhealthyCount > 0
    ? "text-danger-fg"
    : degradedCount > 0
      ? "text-warning-fg"
      : "text-success-fg";
  const overallLabel = unhealthyCount > 0
    ? "Needs attention"
    : degradedCount > 0
      ? "Degraded"
      : services.length > 0
        ? "All systems operational"
        : "No data";
  const graphData = [
    { name: "Healthy", value: healthyCount, color: "#22c55e" },
    { name: "Degraded", value: degradedCount, color: "#f59e0b" },
    { name: "Unhealthy", value: unhealthyCount, color: "#ef4444" },
  ].filter((item) => item.value > 0);
  if (unknownCount > 0) graphData.push({ name: "Unknown", value: unknownCount, color: "#94a3b8" });

  return (
    <div>
      <PageHeader
        title="System Health"
        description="Real-time service health monitoring"
        icon={Shield}
        action={
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="hidden text-xs text-fg-muted sm:block">
                Last checked {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => fetchHealth()}
            >
              Refresh
            </Button>
            <Button variant="primary" size="sm" icon={Play} loading={checking} onClick={runCheck}>
              Run check
            </Button>
          </div>
        }
      />

      {unhealthyCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-danger-soft bg-danger-soft px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
          </span>
          <p className="text-sm font-medium text-danger-fg">
            {unhealthyCount} service{unhealthyCount !== 1 ? "s" : ""} with issues detected
          </p>
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Overall System"
          description="Real-time health distribution"
          icon={Activity}
        />
        <CardBody>
          <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
            <div className="relative mx-auto h-[150px] w-[180px]" role="img" aria-label={`Overall system health ${overallScore}%`}>
              {graphData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 180, height: 150 }}>
                  <PieChart>
                    <Pie
                      data={graphData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={68}
                      startAngle={90}
                      endAngle={-270}
                      stroke="var(--surface)"
                      strokeWidth={3}
                      isAnimationActive={false}
                    >
                      {graphData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 m-auto h-[136px] w-[136px] rounded-full border-[16px] border-surface-2" />
              )}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-3xl font-semibold tabular-nums", overallTone)}>{overallScore}%</span>
                <span className="mt-0.5 text-[11px] text-fg-muted">overall</span>
              </div>
            </div>

            <div>
              <p className={cn("text-sm font-semibold", overallTone)}>{overallLabel}</p>
              <p className="mt-1 text-xs text-fg-muted">
                {services.length} monitored service{services.length !== 1 ? "s" : ""}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["Healthy", healthyCount, "bg-success"],
                  ["Degraded", degradedCount, "bg-warning"],
                  ["Unhealthy", unhealthyCount, "bg-danger"],
                ].map(([label, count, dot]) => (
                  <div key={label} className="rounded-lg border border-line bg-canvas px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", dot)} />
                      <span className="text-xs text-fg-muted">{label}</span>
                    </div>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-fg">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6">
        <HealthCards services={services} />
      </div>

      <p className="mt-4 text-xs text-fg-muted">
        Auto-refreshes every 30 seconds · Real-time updates via WebSocket
      </p>
    </div>
  );
}
