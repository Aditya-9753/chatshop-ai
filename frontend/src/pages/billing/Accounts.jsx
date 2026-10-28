import React, { useState } from "react";
import { BookOpen, Download } from "lucide-react";
import { Alert, Badge, Button, Card, CardBody, CardHeader, DataTable, ErrorState, Input, PageHeader, Select, Skeleton, Tabs } from "../../components/ui";
import { formatDateTime } from "../../utils/format";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, Stat, useLoad } from "../../features/billing/components";
import { emiApi, inr } from "../../features/billing/api";

const thisMonth = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 7);
const EVENT_LABELS = {
  INVOICE_POSTED: "Sales",
  EMI_RECEIPT: "EMI interest",
  EMI_INTEREST_UPFRONT: "EMI interest (upfront)",
  FORECLOSURE: "Foreclosure",
};

const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
const download = (name, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
};

function TrialBalance() {
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/reports/trial-balance"), []);
  if (error) return <ErrorState description={error.message} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  return (
    <Card>
      <CardHeader
        title="Trial balance"
        description="Every account, all time. Debits must equal credits."
        action={
          <div className="flex items-center gap-2">
            <Badge tone={data.balanced ? "success" : "danger"} dot>
              {data.balanced ? "Balanced" : "Not balanced"}
            </Badge>
            <Button size="sm" variant="ghost" icon={Download} onClick={() => download("trial-balance.csv", csv([["Account", "Name", "Debit", "Credit", "Balance"], ...data.rows.map((r) => [r.account, r.name, r.dr / 100, r.cr / 100, r.balance / 100])]))}>
              CSV
            </Button>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-y border-line bg-surface-2/60 text-xs text-fg-muted">
            <tr>
              <th className="px-5 py-2 text-left font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">Debit</th>
              <th className="px-3 py-2 text-right font-medium">Credit</th>
              <th className="px-5 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.rows.map((r) => (
              <tr key={r.account} className="border-b border-line">
                <td className="px-5 py-2">
                  <span className="font-mono text-xs text-fg-muted">{r.account}</span> <span className="text-fg">{r.name}</span>
                </td>
                <td className="px-3 py-2 text-right">{inr(r.dr)}</td>
                <td className="px-3 py-2 text-right">{inr(r.cr)}</td>
                <td className="px-5 py-2 text-right font-medium">
                  {inr(Math.abs(r.balance))} <span className="text-xs text-fg-muted">{r.balance > 0 ? "Dr" : r.balance < 0 ? "Cr" : ""}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-semibold tabular-nums">
            <tr>
              <td className="px-5 py-2">Total</td>
              <td className="px-3 py-2 text-right">{inr(data.totals.dr)}</td>
              <td className="px-3 py-2 text-right">{inr(data.totals.cr)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function Gst() {
  const [month, setMonth] = useState(thisMonth());
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/reports/gst", { month }), [month]);
  return (
    <div className="flex flex-col gap-4">
      <Input type="month" label="Month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
            <Stat label="Output CGST">{inr(data.output.cgst)}</Stat>
            <Stat label="Output SGST">{inr(data.output.sgst)}</Stat>
            <Stat label="Output IGST">{inr(data.output.igst)}</Stat>
            <Stat label="Input GST (fees, subvention)">{inr(data.inputGst)}</Stat>
            <Stat label="Net payable">{inr(data.netPayable)}</Stat>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Invoices by GST rate" description={`${data.invoiceCount} invoice${data.invoiceCount === 1 ? "" : "s"} this month`} />
              <CardBody className="px-0">
                <table className="w-full text-sm tabular-nums">
                  <thead className="border-y border-line bg-surface-2/60 text-xs text-fg-muted">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium">Rate</th>
                      <th className="px-3 py-2 text-right font-medium">Taxable</th>
                      <th className="px-3 py-2 text-right font-medium">CGST + SGST</th>
                      <th className="px-5 py-2 text-right font-medium">IGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rateWise.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-3 text-caption text-fg-muted">No invoices this month.</td>
                      </tr>
                    )}
                    {data.rateWise.map((r) => (
                      <tr key={r.ratePct} className="border-b border-line">
                        <td className="px-5 py-2">{r.ratePct}%</td>
                        <td className="px-3 py-2 text-right">{inr(r.taxable)}</td>
                        <td className="px-3 py-2 text-right">{inr(r.cgst + r.sgst)}</td>
                        <td className="px-5 py-2 text-right">{inr(r.igst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Output GST by source" description="Net of cancellations" />
              <CardBody>
                <ul className="flex flex-col gap-2 text-sm">
                  {data.byEvent.length === 0 && <li className="text-caption text-fg-muted">Nothing this month.</li>}
                  {data.byEvent.map((e) => (
                    <li key={e.event} className="flex justify-between">
                      <span className="text-fg-muted">{EVENT_LABELS[e.event] || e.event.replace(/_/g, " ").toLowerCase()}</span>
                      <span className="tabular-nums">{inr(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Journals() {
  const [account, setAccount] = useState("");
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/ledger", { account: account || undefined, limit: 500 }), [account]);
  const names = data?.accounts || {};
  const columns = [
    { key: "date", header: "Date" },
    { key: "event", header: "Entry", cell: (r) => <span className="font-medium text-fg">{r.event.replace(/_/g, " ").toLowerCase()}</span> },
    {
      key: "lines",
      header: "Lines",
      sortable: false,
      cell: (r) => (
        <ul className="text-xs tabular-nums">
          {r.lines.map((l, i) => (
            <li key={i} className={l.cr ? "pl-4 text-fg-muted" : "text-fg"}>
              {l.dr ? "Dr" : "Cr"} {l.account} {names[l.account]} · {inr(l.dr || l.cr)}
            </li>
          ))}
        </ul>
      ),
    },
    { key: "createdAt", header: "Posted", hideBelow: "lg", cell: (r) => formatDateTime(r.createdAt) },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data?.entries || []}
      loading={loading && !data}
      error={error?.message}
      onRetry={reload}
      toolbar={
        <Select
          aria-label="Account"
          className="w-64"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          options={[{ value: "", label: "All accounts" }, ...Object.entries(names).map(([code, name]) => ({ value: code, label: `${code} ${name}` }))]}
        />
      }
      empty={{ icon: BookOpen, title: "No journal entries", description: "Every sale, receipt and settlement posts entries here." }}
      pageSize={20}
    />
  );
}

function Page() {
  const { isOwner } = useBilling();
  const [tab, setTab] = useState("gst");
  return (
    <>
      <PageHeader title="Accounts & GST" description="Double-entry books for counter sales, EMI and NBFC. Entries are never edited: mistakes are reversed." />
      {!isOwner && (
        <Alert tone="info" className="mb-4">
          You see the stores you work at.
        </Alert>
      )}
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        label="Accounts view"
        tabs={[
          { value: "gst", label: "GST summary" },
          { value: "tb", label: "Trial balance" },
          { value: "journals", label: "Journal" },
        ]}
      />
      {tab === "gst" && <Gst />}
      {tab === "tb" && <TrialBalance />}
      {tab === "journals" && <Journals />}
    </>
  );
}

export default function Accounts() {
  return (
    <BillingGate perm="ledger.read">
      <Page />
    </BillingGate>
  );
}
