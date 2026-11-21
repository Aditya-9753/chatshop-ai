import React from "react";
import {
  Database,
  Cpu,
  Bot,
  Link2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, Badge, cn } from "../../../components/ui";

const SERVICE_ICONS = {
  MongoDB: Database,
  API: Cpu,
  AI: Bot,
  Integrations: Link2,
};

const STATUS_CONFIG = {
  healthy: {
    tone: "success",
    label: "Healthy",
    icon: CheckCircle2,
    dot: "bg-success",
    pulse: false,
  },
  degraded: {
    tone: "warning",
    label: "Degraded",
    icon: AlertTriangle,
    dot: "bg-warning",
    pulse: true,
  },
  unhealthy: {
    tone: "danger",
    label: "Unhealthy",
    icon: XCircle,
    dot: "bg-danger",
    pulse: true,
  },
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function HealthCard({ service }) {
  const name = service.serviceName || service.name || "Unknown";
  const status = service.status || "unknown";
  const config = STATUS_CONFIG[status] || {
    tone: "neutral",
    label: status,
    icon: Clock,
    dot: "bg-fg-subtle",
    pulse: false,
  };
  const ServiceIcon = SERVICE_ICONS[name] || Cpu;
  const StatusIcon = config.icon;

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
            <ServiceIcon className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-fg">{name}</span>
        </div>
        {/* Animated status dot */}
        <span className="relative flex h-2.5 w-2.5">
          {config.pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                config.dot
              )}
            />
          )}
          <span
            className={cn("relative inline-flex rounded-full h-2.5 w-2.5", config.dot)}
          />
        </span>
      </div>

      <div className="flex items-center justify-between">
        <Badge tone={config.tone} dot>
          <StatusIcon className="h-3 w-3" aria-hidden="true" />
          <span>{config.label}</span>
        </Badge>
        {typeof service.latencyMs === "number" && (
          <span className="text-xs text-fg-muted tabular-nums">
            {service.latencyMs}ms
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs text-fg-muted">
        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>Checked {formatRelativeTime(service.checkedAt || service.lastCheck)}</span>
      </div>

      {service.metadata?.message && (
        <p className="text-xs text-fg-muted border-t border-line pt-2 mt-1 truncate">
          {service.metadata.message}
        </p>
      )}
    </Card>
  );
}

/**
 * Grid of health status cards, one per service.
 * Accepts `services` as an array of health check objects.
 */
export default function HealthCards({ services = [] }) {
  if (!services.length) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["MongoDB", "API", "AI", "Integrations"].map((name) => (
          <Card key={name} className="p-4 flex flex-col gap-3 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-surface-2" />
              <div className="h-4 w-20 rounded bg-surface-2" />
            </div>
            <div className="h-5 w-16 rounded bg-surface-2" />
            <div className="h-3 w-24 rounded bg-surface-2" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {services.map((svc) => (
        <HealthCard key={svc._id || svc.serviceName || svc.name} service={svc} />
      ))}
    </div>
  );
}
