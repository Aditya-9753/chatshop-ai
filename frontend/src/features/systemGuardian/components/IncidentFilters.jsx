import React from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { Button, cn } from "../../../components/ui";

const STATUSES = [
  { value: "ACTIVE", label: "Active incidents" },
  { value: "OPEN", label: "OPEN" },
  { value: "ACKNOWLEDGED", label: "ACKNOWLEDGED" },
  { value: "INVESTIGATING", label: "INVESTIGATING" },
  { value: "ESCALATED", label: "ESCALATED" },
  { value: "RESOLVED", label: "RESOLVED" },
];
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function Select({ label, value, options, onChange, placeholder = "All" }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "h-9 appearance-none rounded-lg border border-line bg-surface pl-3 pr-8 text-sm text-fg",
          "focus:outline-none focus:ring-2 focus:ring-accent/40 hover:bg-surface-2 transition-colors",
          "dark:bg-surface dark:text-fg dark:border-line"
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Filter bar for the Incident Center.
 * Calls `onChange(filters)` with the current filter state whenever any field changes.
 */
export default function IncidentFilters({ filters, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  const hasFilters =
    (filters.status && filters.status !== "ACTIVE") || filters.severity || filters.search || filters.from || filters.to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={filters.search || ""}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search incidents…"
          className={cn(
            "h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted",
            "focus:outline-none focus:ring-2 focus:ring-accent/40 hover:bg-surface-2 transition-colors"
          )}
        />
      </div>

      {/* Status */}
      <Select
        label="Status"
        value={filters.status || ""}
        options={STATUSES}
        onChange={(v) => set("status", v)}
        placeholder="All statuses"
      />

      {/* Severity */}
      <Select
        label="Severity"
        value={filters.severity || ""}
        options={SEVERITIES}
        onChange={(v) => set("severity", v)}
        placeholder="All severities"
      />

      {/* Date from */}
      <input
        type="date"
        value={filters.from || ""}
        onChange={(e) => set("from", e.target.value)}
        aria-label="From date"
        className={cn(
          "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-fg",
          "focus:outline-none focus:ring-2 focus:ring-accent/40 hover:bg-surface-2 transition-colors"
        )}
      />

      {/* Date to */}
      <input
        type="date"
        value={filters.to || ""}
        onChange={(e) => set("to", e.target.value)}
        aria-label="To date"
        className={cn(
          "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-fg",
          "focus:outline-none focus:ring-2 focus:ring-accent/40 hover:bg-surface-2 transition-colors"
        )}
      />

      {/* Clear */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          icon={X}
          onClick={() => onChange({ status: "ACTIVE", severity: "", search: "", from: "", to: "" })}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
