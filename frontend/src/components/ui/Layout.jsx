import React, { useRef } from "react";
import { cn } from "./cn";

/**
 * Top of every page: title, one-line description and the primary action.
 * Every app page uses the same skeleton: PageHeader, filters row, content.
 */
export function PageHeader({ title, description, actions, className }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Accessible tab list. `tabs` is [{ value, label, count? }].
 * variant "underline" for page sections, "pill" for compact filters.
 */
export function Tabs({ tabs, value, onChange, variant = "underline", fill, className, label = "Tabs" }) {
  const listRef = useRef(null);

  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.value);
    listRef.current?.querySelector(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "relative flex items-center overflow-x-auto scrollbar-none",
        variant === "underline" ? "gap-5 border-b border-line" : cn("gap-1 rounded-lg bg-surface-2 p-1", fill ? "w-full" : "w-fit max-w-full"),
        className
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            data-value={tab.value}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors duration-150",
              fill && "flex-1 justify-center",
              variant === "underline"
                ? cn(
                    "-mb-px border-b-2 py-2.5",
                    selected ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
                  )
                : cn(
                    "rounded-md px-2.5 py-1",
                    selected ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
                  )
            )}
          >
            {tab.icon && <tab.icon className="w-4 h-4" aria-hidden="true" />}
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded px-1.5 text-xs tabular-nums",
                  selected ? "bg-accent-soft text-accent-soft-fg" : "bg-surface-3 text-fg-muted"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Label/value row used in detail drawers
export function DetailRow({ label, children, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2 text-sm", className)}>
      <dt className="text-fg-muted shrink-0">{label}</dt>
      <dd className="text-fg text-right min-w-0 break-words">{children}</dd>
    </div>
  );
}

// Small uppercase section label
export function SectionLabel({ children, className }) {
  return <h3 className={cn("text-xs font-medium uppercase tracking-wide text-fg-muted", className)}>{children}</h3>;
}
