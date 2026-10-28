import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Landmark } from "lucide-react";
import { Button, DataTable, Input, Modal, PageHeader, Select, Tabs, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { formatDateTime } from "../../utils/format";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, ErrorList, Money, StateBadge, useLoad } from "../../features/billing/components";
import { emiApi, fromPaise, inr, toPaise } from "../../features/billing/api";

const B = "/dashboard/billing";
const NEXT = { LOGIN: ["APPROVED", "REJECTED"], APPROVED: ["DO_RECEIVED", "REJECTED"], DO_RECEIVED: ["DISBURSED", "REJECTED"] };
const LABELS = { APPROVED: "Loan approved", DO_RECEIVED: "Delivery order received", DISBURSED: "Payout received", REJECTED: "Rejected by NBFC" };

function MoveModal({ nbfcCase, onClose, onDone }) {
  const toast = useToast();
  const options = NEXT[nbfcCase.status] || [];
  const [form, setForm] = useState({ status: options[0], doNumber: nbfcCase.doNumber || "", received: String(fromPaise(nbfcCase.expectedPayout)), note: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await emiApi.post(`/nbfc/${nbfcCase._id}/status`, {
        status: form.status,
        doNumber: form.status === "DO_RECEIVED" ? form.doNumber : undefined,
        receivedAmount: form.status === "DISBURSED" ? toPaise(form.received) : undefined,
        note: form.note || undefined,
      });
      toast.success(LABELS[form.status]);
      onClose();
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${nbfcCase.partnerName} · ${nbfcCase.invoiceNo}`}
      description={`Loan ${inr(nbfcCase.loanAmount)} · expected payout ${inr(nbfcCase.expectedPayout)}`}
      footer={
        <Button loading={saving} disabled={form.status === "DO_RECEIVED" && !form.doNumber.trim()} onClick={submit}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Select label="What happened" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={options.map((s) => ({ value: s, label: LABELS[s] }))} />
        {form.status === "DO_RECEIVED" && <Input label="DO number" required value={form.doNumber} onChange={(e) => setForm({ ...form, doNumber: e.target.value })} />}
        {form.status === "DISBURSED" && (
          <Input
            label="Amount received (₹)"
            inputMode="decimal"
            value={form.received}
            onChange={(e) => setForm({ ...form, received: e.target.value.replace(/[^\d.]/g, "") })}
            hint="A short payment is booked as extra subvention cost."
          />
        )}
        <Textarea label="Note" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        {nbfcCase.history?.length > 0 && (
          <ol className="flex flex-col gap-1 border-t border-line pt-3 text-caption text-fg-muted">
            {nbfcCase.history.map((h, i) => (
              <li key={i}>
                {h.status.replace(/_/g, " ").toLowerCase()} · {h.byName} · {formatDateTime(h.at)}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ol>
        )}
        {error && <ErrorList error={error} />}
      </div>
    </Modal>
  );
}

function Page() {
  const { can } = useBilling();
  const [status, setStatus] = useState("");
  const [moving, setMoving] = useState(null);
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/nbfc", { status: status || undefined }), [status]);

  const columns = [
    { key: "invoiceNo", header: "Invoice", cell: (r) => <Link onClick={(e) => e.stopPropagation()} to={`${B}/invoices/${r.invoiceId}`} className="font-medium text-fg hover:text-accent">{r.invoiceNo}</Link> },
    { key: "customer", header: "Customer", sortValue: (r) => r.customer?.name, cell: (r) => r.customer?.name },
    { key: "partnerName", header: "NBFC", hideBelow: "sm" },
    { key: "loanAmount", header: "Loan", align: "right", cell: (r) => <Money value={r.loanAmount} whole /> },
    { key: "expectedPayout", header: "Payout", align: "right", hideBelow: "md", cell: (r) => <Money value={r.receivedAmount || r.expectedPayout} whole /> },
    { key: "doNumber", header: "DO", hideBelow: "lg", cell: (r) => r.doNumber || "—" },
    { key: "status", header: "Status", cell: (r) => <StateBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="NBFC cases" description="Loans financed by NBFC partners, from login to payout" />
      <Tabs
        variant="pill"
        className="mb-4"
        value={status}
        onChange={setStatus}
        label="NBFC status"
        tabs={[
          { value: "", label: "All" },
          { value: "LOGIN", label: "Login" },
          { value: "APPROVED", label: "Approved" },
          { value: "DO_RECEIVED", label: "DO received" },
          { value: "DISBURSED", label: "Paid out" },
          { value: "REJECTED", label: "Rejected" },
        ]}
      />
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        searchable
        searchPlaceholder="Invoice, customer or DO"
        searchText={(r) => [r.invoiceNo, r.customer?.name, r.doNumber, r.partnerName].join(" ")}
        onRowClick={(r) => can("nbfc.update") && NEXT[r.status] && setMoving(r)}
        empty={{ icon: Landmark, title: "No NBFC cases", description: "Choose NBFC finance in New sale to start one." }}
        pageSize={15}
      />
      {moving && <MoveModal nbfcCase={moving} onClose={() => setMoving(null)} onDone={reload} />}
    </>
  );
}

export default function NbfcCases() {
  return (
    <BillingGate perm="nbfc.read">
      <Page />
    </BillingGate>
  );
}
