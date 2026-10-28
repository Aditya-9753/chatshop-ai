import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { Card, DataTable, PageHeader, Select, Tabs } from "../../components/ui";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, BucketBadge, Money, StateBadge, useLoad } from "../../features/billing/components";
import { emiApi, inr } from "../../features/billing/api";

const B = "/dashboard/billing";
const VIEWS = [
  { value: "today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "active", label: "All active" },
  { value: "pending", label: "Awaiting approval" },
  { value: "closed", label: "Closed" },
];

function Aging() {
  const { data } = useLoad(() => emiApi.get("/reports/emi-aging"), []);
  if (!data) return null;
  return (
    <Card className="mb-4 grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x">
      {data.map((b) => (
        <div key={b.bucket} className="p-3">
          <BucketBadge bucket={b.bucket} />
          <p className="mt-1.5 text-sm font-semibold tabular-nums text-fg">{inr(b.outstandingPrincipal, { whole: true })}</p>
          <p className="text-xs text-fg-muted">
            {b.contracts} contract{b.contracts === 1 ? "" : "s"}
            {b.overdueAmount ? ` · ${inr(b.overdueAmount, { whole: true })} due` : ""}
          </p>
        </div>
      ))}
    </Card>
  );
}

function List() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isAgent } = useBilling();
  const view = params.get("view") || "today";
  const bucket = params.get("bucket") || "";
  const agentId = params.get("agentId") || "";
  const agents = useLoad(() => (isAgent ? Promise.resolve({ data: [] }) : emiApi.get("/agents")), [isAgent]);
  const { data, loading, error, reload } = useLoad(
    () => emiApi.get("/emi", { view, bucket: bucket || undefined, agentId: agentId || undefined }),
    [view, bucket, agentId]
  );

  const set = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  const columns = [
    { key: "contractNo", header: "Contract", cell: (r) => <span className="font-medium text-fg">{r.contractNo}</span> },
    { key: "customer", header: "Customer", sortValue: (r) => r.customer?.name, cell: (r) => (
      <span className="block max-w-48">
        <span className="block truncate">{r.customer?.name}</span>
        <span className="block truncate text-xs text-fg-muted">{r.customer?.phone}</span>
      </span>
    ) },
    { key: "emiAmount", header: "EMI", align: "right", hideBelow: "sm", cell: (r) => <Money value={r.emiAmount} /> },
    { key: "dueNow", header: "Due now", align: "right", cell: (r) => (r.dueNow ? <Money value={r.dueNow} className="font-medium text-fg" /> : <span className="text-fg-muted">—</span>) },
    { key: "nextDueDate", header: "Next due", hideBelow: "md" },
    { key: "bucket", header: "DPD", sortValue: (r) => r.currentDpd, cell: (r) => (r.status === "ACTIVE" ? <span className="inline-flex items-center gap-1.5"><BucketBadge bucket={r.bucket} />{r.currentDpd > 0 && <span className="text-xs text-fg-muted">{r.currentDpd}d</span>}</span> : <StateBadge status={r.status} />) },
    { key: "outstandingPrincipal", header: "Principal left", align: "right", hideBelow: "lg", cell: (r) => <Money value={r.outstandingPrincipal} whole /> },
    { key: "agentName", header: "Agent", hideBelow: "lg", cell: (r) => r.agentName || <span className="text-fg-muted">—</span> },
  ];

  return (
    <>
      <PageHeader title="EMI collections" description={isAgent ? "Contracts assigned to you" : "Shop EMI contracts, what is due and who is following up"} />
      <Aging />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs variant="pill" tabs={VIEWS} value={view === "bucket" ? "active" : view} onChange={(v) => set({ view: v, bucket: "" })} label="EMI view" />
        <div className="flex gap-2">
          <Select
            aria-label="DPD bucket"
            value={bucket}
            onChange={(e) => set({ view: e.target.value ? "bucket" : "active", bucket: e.target.value })}
            options={[{ value: "", label: "Any DPD" }, ...["CURRENT", "1-30", "31-60", "61-90", "90+"].map((b) => ({ value: b, label: b === "CURRENT" ? "Current" : `${b} days` }))]}
            className="w-36"
          />
          {!isAgent && (
            <Select
              aria-label="Agent"
              value={agentId}
              onChange={(e) => set({ agentId: e.target.value })}
              options={[{ value: "", label: "Any agent" }, ...(agents.data || []).map((a) => ({ value: a._id, label: a.name }))]}
              className="w-40"
            />
          )}
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        searchable
        searchPlaceholder="Contract, customer or phone"
        searchText={(r) => [r.contractNo, r.customer?.name, r.customer?.phone].join(" ")}
        onRowClick={(r) => navigate(`${B}/emi/${r._id}`)}
        empty={{ icon: CalendarClock, title: view === "today" ? "Nothing due today" : "No contracts here", description: "Shop EMI contracts appear when a sale is made on EMI." }}
        pageSize={15}
      />
    </>
  );
}

export default function EmiList() {
  return (
    <BillingGate perm="emi.read">
      <List />
    </BillingGate>
  );
}
