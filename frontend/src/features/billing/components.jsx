import React, { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Store } from "lucide-react";
import { Badge, EmptyState, ErrorState, PageLoader, Select, cn } from "../../components/ui";
import { useBilling } from "./BillingContext";
import { inr } from "./api";

// Load data for a page; reload() after an action. Ignores stale responses.
export function useLoad(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const load = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetcher();
      if (id === seq.current) setState({ data: res?.data ?? res, loading: false, error: null });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

export const Money = ({ value, whole, className }) => <span className={cn("tabular-nums", className)}>{inr(value, { whole })}</span>;

const TONES = {
  PAID: ["success", "Paid"],
  EMI_ACTIVE: ["accent", "EMI active"],
  EMI_CLOSED: ["success", "EMI closed"],
  FORECLOSED: ["neutral", "Foreclosed"],
  PENDING_APPROVAL: ["warning", "Needs approval"],
  NBFC_PENDING: ["warning", "NBFC payout pending"],
  CANCELLED: ["danger", "Cancelled"],
  ACTIVE: ["accent", "Active"],
  CLOSED: ["success", "Closed"],
  UPCOMING: ["neutral", "Upcoming"],
  DUE: ["warning", "Due today"],
  OVERDUE: ["danger", "Overdue"],
  PENDING: ["warning", "Pending"],
  APPROVED: ["success", "Approved"],
  REJECTED: ["danger", "Rejected"],
  CAPTURED: ["warning", "Awaiting settlement"],
  SETTLED: ["success", "Settled"],
  REVERSED: ["danger", "Reversed"],
  LOGIN: ["neutral", "Login"],
  DO_RECEIVED: ["accent", "DO received"],
  DISBURSED: ["success", "Disbursed"],
  QUEUED: ["neutral", "Queued"],
  SENT: ["success", "Sent"],
  FAILED: ["danger", "Failed"],
  SKIPPED: ["neutral", "Skipped"],
  VERIFIED: ["success", "KYC verified"],
  NONE: ["neutral", "No KYC"],
  SUSPENDED: ["danger", "Suspended"],
};

export function StateBadge({ status, label, className }) {
  const [tone, text] = TONES[status] || ["neutral", String(status || "").replace(/_/g, " ").toLowerCase()];
  return (
    <Badge tone={tone} dot className={className}>
      {label || text}
    </Badge>
  );
}

export function KycBadge({ status }) {
  const label = { VERIFIED: "KYC verified", PENDING: "KYC pending", REJECTED: "KYC rejected", NONE: "No KYC" }[status || "NONE"];
  return <StateBadge status={status === "PENDING" ? "PENDING" : status || "NONE"} label={label} />;
}

const BUCKET_TONES = { CURRENT: "success", "1-30": "warning", "31-60": "warning", "61-90": "danger", "90+": "danger" };
export const BucketBadge = ({ bucket }) => (
  <Badge tone={BUCKET_TONES[bucket] || "neutral"}>{bucket === "CURRENT" ? "Current" : `${bucket} DPD`}</Badge>
);

export const METHOD_LABELS = { CASH: "Cash", UPI: "UPI", CREDIT_CARD: "Credit card", DEBIT_CARD: "Debit card", BANK: "Bank transfer" };
export const METHOD_OPTIONS = Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }));
export const FINANCE_LABELS = { NONE: "Full payment", SHOP_EMI: "Shop EMI", NBFC: "NBFC finance" };
export const APPROVAL_LABELS = { HIGH_EMI: "High-value EMI", LATE_FEE_WAIVER: "Late fee waiver", FORECLOSURE: "Foreclosure", INVOICE_CANCEL: "Invoice cancellation" };

// Store picker for people who work at more than one store
export function StoreSwitcher({ className }) {
  const { stores, store, setStoreId } = useBilling();
  if (stores.length < 2) {
    return store ? (
      <span className={cn("inline-flex items-center gap-1.5 text-caption text-fg-muted", className)}>
        <Store className="h-3.5 w-3.5" aria-hidden="true" /> {store.name}
      </span>
    ) : null;
  }
  return (
    <Select
      aria-label="Store"
      value={store?._id || ""}
      onChange={(e) => setStoreId(e.target.value)}
      options={stores.map((s) => ({ value: s._id, label: `${s.name} (${s.invoicePrefix})` }))}
      className={cn("w-56", className)}
    />
  );
}

/**
 * Wraps every billing page: waits for the billing profile, explains why
 * the module is unavailable (plan, suspension), and hides pages a role
 * cannot use.
 */
export function BillingGate({ perm, children }) {
  const billing = useBilling();
  if (billing.loading && !billing.me) return <PageLoader />;
  if (billing.error) {
    return <ErrorState title="EMI & billing is unavailable" description={billing.error.message} onRetry={billing.reload} />;
  }
  if (perm && !billing.can(perm)) {
    return <EmptyState icon={Lock} title="Not available for your role" description="Ask the shop owner if you need access to this page." />;
  }
  if (!billing.store) {
    return <EmptyState icon={Store} title="No store yet" description="The shop owner needs to add a store in Billing settings." />;
  }
  return children;
}

// Label + value pairs in a compact grid (summaries, totals)
export function Stat({ label, children, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-fg tabular-nums">{children}</dd>
    </div>
  );
}

// The server's list of errors for a failed action
export function ErrorList({ error, className }) {
  if (!error) return null;
  const errors = error.errors?.length ? error.errors : [error.message];
  return (
    <div role="alert" className={cn("rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-caption text-danger-fg", className)}>
      {errors.length === 1 ? (
        errors[0]
      ) : (
        <ul className="list-disc space-y-0.5 pl-4">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
