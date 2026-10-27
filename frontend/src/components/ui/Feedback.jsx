import React from "react";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { cn } from "./cn";
import Button from "./Button";

export function Skeleton({ className, style }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "rounded-md bg-surface-2 bg-[linear-gradient(90deg,transparent,var(--surface-3),transparent)]",
        "bg-[length:200%_100%] animate-shimmer",
        className
      )}
    />
  );
}

export function Spinner({ className, label = "Loading" }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn("w-5 h-5 animate-spin text-fg-muted", className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// Centered spinner for a whole page or panel
export function PageLoader({ className }) {
  return (
    <div className={cn("flex min-h-[40vh] items-center justify-center", className)}>
      <Spinner />
    </div>
  );
}

// Empty list: icon, one sentence, one call to action
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-6 py-12", className)}>
      {Icon && (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2">
          <Icon className="w-5 h-5 text-fg-muted" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-caption text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// Failed load with a retry button
export function ErrorState({ title = "Something went wrong", description, onRetry, className }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center text-center px-6 py-12", className)}>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft">
        <AlertTriangle className="w-5 h-5 text-danger-fg" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-caption text-fg-muted">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCw} onClick={onRetry} className="mt-5">
          Try again
        </Button>
      )}
    </div>
  );
}

// Inline message box (form errors, notices)
export function Alert({ tone = "danger", title, children, className }) {
  const tones = {
    danger: "bg-danger-soft text-danger-fg border-danger/20",
    warning: "bg-warning-soft text-warning-fg border-warning/20",
    success: "bg-success-soft text-success-fg border-success/20",
    info: "bg-accent-soft text-accent-soft-fg border-accent/20",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2.5 text-caption", tones[tone], className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
    </div>
  );
}
