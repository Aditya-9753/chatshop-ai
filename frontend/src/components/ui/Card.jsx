import React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "./cn";
import { Skeleton } from "./Feedback";

export function Card({ as: Component = "div", className, children, ...props }) {
  return (
    <Component className={cn("rounded-xl border border-line bg-surface", className)} {...props}>
      {children}
    </Component>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-caption text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

// Tiny inline trend line; cheaper than a chart library for a KPI card
function Sparkline({ data }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((value, i) => `${(i / (data.length - 1)) * 100},${28 - ((value - min) / range) * 24}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-24 text-accent" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * KPI card: label, value, optional delta (percent vs previous period)
 * and sparkline. A positive delta is good unless `invertDelta` is set
 * (e.g. response time, where lower is better).
 */
export function StatCard({ label, value, delta, deltaLabel = "vs last week", sparkline, icon: Icon, invertDelta, loading, className }) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const good = hasDelta && (invertDelta ? delta <= 0 : delta >= 0);

  return (
    <Card className={cn("p-4 flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-medium text-fg-muted">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-fg-subtle" aria-hidden="true" />}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <div className="flex items-end justify-between gap-3">
          <span className="text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</span>
          <Sparkline data={sparkline} />
        </div>
      )}
      {hasDelta && !loading && (
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium tabular-nums",
              good ? "text-success-fg" : "text-danger-fg"
            )}
          >
            {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-fg-muted">{deltaLabel}</span>
        </div>
      )}
    </Card>
  );
}
