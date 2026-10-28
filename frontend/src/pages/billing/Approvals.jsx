import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckSquare, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Modal, PageHeader, Skeleton, Tabs, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { formatDateTime } from "../../utils/format";
import { APPROVAL_LABELS, BillingGate, ErrorList, StateBadge, useLoad } from "../../features/billing/components";
import { emiApi, inr } from "../../features/billing/api";

const B = "/dashboard/billing";

// What the request is about, in one line, with a link to it
function Subject({ a }) {
  const p = a.payload || {};
  if (a.type === "HIGH_EMI") {
    return (
      <>
        {p.invoiceNo} · {p.customerName} · {p.tenureMonths} months at {p.annualRatePct}% ·{" "}
        <Link className="text-accent hover:underline" to={`${B}/invoices/${a.refId}`}>
          invoice
        </Link>
      </>
    );
  }
  if (a.type === "INVOICE_CANCEL") {
    return (
      <>
        {p.invoiceNo} · {p.customerName} ·{" "}
        <Link className="text-accent hover:underline" to={`${B}/invoices/${a.refId}`}>
          invoice
        </Link>
      </>
    );
  }
  if (a.type === "LATE_FEE_WAIVER") {
    return (
      <>
        {p.contractNo} · EMI #{p.installmentNo} ·{" "}
        <Link className="text-accent hover:underline" to={`${B}/emi/${p.contractId}`}>
          contract
        </Link>
      </>
    );
  }
  return (
    <>
      {p.contractNo} · paid by {p.method?.replace(/_/g, " ").toLowerCase()} ·{" "}
      <Link className="text-accent hover:underline" to={`${B}/emi/${a.refId}`}>
        contract
      </Link>
    </>
  );
}

function Decide({ approval, decision, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await emiApi.post(`/approvals/${approval._id}/decide`, { decision, note: note || undefined });
      toast.success(decision === "APPROVED" ? "Approved" : "Rejected");
      onClose();
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };
  const approving = decision === "APPROVED";
  const effect = {
    HIGH_EMI: approving ? "The EMI starts now." : "The sale is cancelled: stock back, reversal entries posted.",
    INVOICE_CANCEL: "Stock and IMEIs go back, payments are marked reversed and reversal entries are posted.",
    LATE_FEE_WAIVER: "The late fee is written off.",
    FORECLOSURE: "Today's settlement amount is recorded and the remaining installments are closed.",
  }[approval.type];
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${approving ? "Approve" : "Reject"} ${APPROVAL_LABELS[approval.type].toLowerCase()}?`}
      description={approving || approval.type === "HIGH_EMI" ? effect : "Nothing changes; the requester sees your reason."}
      size="sm"
      footer={
        <Button variant={approving ? "primary" : "danger"} loading={saving} disabled={!approving && note.trim().length < 3} onClick={submit}>
          {approving ? "Approve" : "Reject"}
        </Button>
      }
    >
      <Textarea label={approving ? "Note (optional)" : "Reason"} required={!approving} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <ErrorList error={error} className="mt-3" />}
    </Modal>
  );
}

function Page() {
  const [status, setStatus] = useState("PENDING");
  const [deciding, setDeciding] = useState(null);
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/approvals", { status }), [status]);

  return (
    <>
      <PageHeader title="Approvals" description="Maker-checker: the person who asks cannot approve their own request" />
      <Tabs
        variant="pill"
        className="mb-4"
        value={status}
        onChange={setStatus}
        label="Approval status"
        tabs={[
          { value: "PENDING", label: "Waiting" },
          { value: "APPROVED", label: "Approved" },
          { value: "REJECTED", label: "Rejected" },
          { value: "ALL", label: "All" },
        ]}
      />
      {error ? (
        <ErrorState description={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton className="h-40 w-full" />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={CheckSquare} title={status === "PENDING" ? "Nothing waiting for approval" : "No requests"} description="High EMIs, late fee waivers, foreclosures and invoice cancellations show up here." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((a) => (
            <Card as="li" key={a._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-fg">{APPROVAL_LABELS[a.type]}</span>
                  <Badge tone="neutral">{inr(a.amount)}</Badge>
                  {a.status !== "PENDING" && <StateBadge status={a.status} />}
                </div>
                <p className="mt-1 truncate text-caption text-fg-muted">
                  <Subject a={a} />
                </p>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {a.requestedByName} · {formatDateTime(a.createdAt)}
                  {a.reason ? ` · “${a.reason}”` : ""}
                  {a.decidedByName ? ` · ${a.status.toLowerCase()} by ${a.decidedByName}${a.decisionNote ? `: “${a.decisionNote}”` : ""}` : ""}
                </p>
              </div>
              {a.status === "PENDING" &&
                (a.canDecide ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={X} onClick={() => setDeciding({ approval: a, decision: "REJECTED" })}>
                      Reject
                    </Button>
                    <Button size="sm" icon={Check} onClick={() => setDeciding({ approval: a, decision: "APPROVED" })}>
                      Approve
                    </Button>
                  </div>
                ) : (
                  <span className="text-caption text-fg-muted">Waiting for another approver</span>
                ))}
            </Card>
          ))}
        </ul>
      )}
      {deciding && <Decide {...deciding} onClose={() => setDeciding(null)} onDone={reload} />}
    </>
  );
}

export default function Approvals() {
  return (
    <BillingGate perm="approval.read">
      <Page />
    </BillingGate>
  );
}
