import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { Button, DataTable, PageHeader, Tabs } from "../../components/ui";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, FINANCE_LABELS, Money, StateBadge, useLoad } from "../../features/billing/components";
import { emiApi } from "../../features/billing/api";

const B = "/dashboard/billing";
const VIEWS = [
  { value: "", label: "All" },
  { value: "EMI_ACTIVE", label: "On EMI" },
  { value: "PENDING_APPROVAL", label: "Needs approval" },
  { value: "NBFC_PENDING", label: "NBFC pending" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

function List() {
  const navigate = useNavigate();
  const { can, stores } = useBilling();
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/invoices", { status: status || undefined }), [status]);
  const storeName = (id) => stores.find((s) => s._id === id)?.name;

  const columns = [
    { key: "invoiceNo", header: "Invoice", cell: (r) => <span className="font-medium text-fg">{r.invoiceNo}</span> },
    { key: "date", header: "Date", hideBelow: "sm" },
    { key: "customer", header: "Customer", sortValue: (r) => r.customer?.name, cell: (r) => <span className="block max-w-48 truncate">{r.customer?.name}</span> },
    { key: "financeType", header: "Payment", hideBelow: "md", cell: (r) => FINANCE_LABELS[r.financeType] },
    { key: "storeId", header: "Store", hideBelow: "lg", cell: (r) => storeName(r.storeId) || "—" },
    { key: "grossTotal", header: "Amount", align: "right", cell: (r) => <Money value={r.grossTotal} /> },
    { key: "status", header: "Status", cell: (r) => <StateBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="GST invoices for counter sales"
        actions={
          can("invoice.create") && (
            <Button as={Link} to={`${B}/sale`} icon={Plus}>
              New sale
            </Button>
          )
        }
      />
      <Tabs tabs={VIEWS} value={status} onChange={setStatus} className="mb-4" label="Invoice status" />
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        searchable
        searchPlaceholder="Invoice no., customer, phone or IMEI"
        searchText={(r) => [r.invoiceNo, r.customer?.name, r.customer?.phone, ...(r.lines || []).map((l) => l.imei)].join(" ")}
        onRowClick={(r) => navigate(`${B}/invoices/${r._id}`)}
        defaultSort={{ key: "invoiceNo", dir: "desc" }}
        empty={{ icon: FileText, title: "No invoices yet", description: "Invoices appear here as soon as a sale is made." }}
        pageSize={15}
      />
    </>
  );
}

export default function Invoices() {
  return (
    <BillingGate perm="invoice.read">
      <List />
    </BillingGate>
  );
}
