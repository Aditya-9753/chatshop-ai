import React, { useState } from "react";
import { Wallet } from "lucide-react";
import { Button, Card, DataTable, PageHeader, Select } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { formatDateTime } from "../../utils/format";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, METHOD_LABELS, Money, StateBadge, Stat, useLoad } from "../../features/billing/components";
import { emiApi, inr } from "../../features/billing/api";

const PURPOSES = { SALE: "At sale", EMI: "EMI", FORECLOSURE: "Foreclosure" };

function Page() {
  const { can } = useBilling();
  const toast = useToast();
  const [filter, setFilter] = useState({ status: "", purpose: "" });
  const [settling, setSettling] = useState(null);
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/payments", { status: filter.status || undefined, purpose: filter.purpose || undefined }), [filter]);

  const settle = async (p) => {
    setSettling(p._id);
    try {
      await emiApi.post(`/payments/${p._id}/settle`, {});
      toast.success(`${p.receiptNo} settled: ${inr(p.netSettled)} to bank`);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSettling(null);
    }
  };

  const rows = data || [];
  const awaiting = rows.filter((p) => p.status === "CAPTURED");
  const columns = [
    { key: "receiptNo", header: "Receipt", cell: (r) => <span className="font-medium text-fg">{r.receiptNo}</span> },
    { key: "createdAt", header: "When", hideBelow: "md", cell: (r) => formatDateTime(r.createdAt) },
    { key: "customerName", header: "Customer", hideBelow: "sm" },
    { key: "purpose", header: "For", hideBelow: "lg", cell: (r) => PURPOSES[r.purpose] },
    { key: "method", header: "Method", cell: (r) => (
      <span>
        {METHOD_LABELS[r.method]}
        {r.txnRef && <span className="block text-xs text-fg-muted">{r.txnRef}</span>}
      </span>
    ) },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} /> },
    { key: "fee", header: "Fee + GST", align: "right", hideBelow: "lg", sortValue: (r) => r.mdr + r.gstOnMdr, cell: (r) => (r.mdr ? <Money value={r.mdr + r.gstOnMdr} /> : "—") },
    { key: "status", header: "Status", cell: (r) => <StateBadge status={r.status} /> },
    {
      key: "action",
      header: "",
      sortable: false,
      cell: (r) =>
        r.status === "CAPTURED" &&
        can("payment.reconcile") && (
          <Button size="sm" variant="secondary" loading={settling === r._id} onClick={(e) => { e.stopPropagation(); settle(r); }}>
            Mark settled
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Payments" description="Every receipt. Card and UPI money is settled when it reaches the bank (or by the gateway webhook)." />
      <Card className="mb-4 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Receipts shown">{rows.length}</Stat>
        <Stat label="Collected">{inr(rows.filter((p) => p.status !== "REVERSED").reduce((s, p) => s + p.amount, 0), { whole: true })}</Stat>
        <Stat label="Awaiting settlement">{inr(awaiting.reduce((s, p) => s + p.amount, 0), { whole: true })}</Stat>
        <Stat label="Card/UPI fees">{inr(rows.filter((p) => p.status === "SETTLED").reduce((s, p) => s + p.mdr + p.gstOnMdr, 0))}</Stat>
      </Card>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        searchable
        searchPlaceholder="Receipt, customer or reference"
        searchText={(r) => [r.receiptNo, r.customerName, r.txnRef].join(" ")}
        toolbar={
          <>
            <Select
              aria-label="Status"
              className="w-44"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              options={[
                { value: "", label: "Any status" },
                { value: "CAPTURED", label: "Awaiting settlement" },
                { value: "SETTLED", label: "Settled" },
                { value: "REVERSED", label: "Reversed" },
              ]}
            />
            <Select
              aria-label="Purpose"
              className="w-36"
              value={filter.purpose}
              onChange={(e) => setFilter({ ...filter, purpose: e.target.value })}
              options={[{ value: "", label: "Any purpose" }, ...Object.entries(PURPOSES).map(([value, label]) => ({ value, label }))]}
            />
          </>
        }
        empty={{ icon: Wallet, title: "No payments", description: "Receipts from sales and EMI collections appear here." }}
        pageSize={20}
      />
    </>
  );
}

export default function Payments() {
  return (
    <BillingGate perm="payment.read">
      <Page />
    </BillingGate>
  );
}
