import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, HandCoins, MessageSquarePlus, PhoneCall, UserCheck, XCircle } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DetailRow,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Select,
  Textarea,
} from "../../components/ui";
import { useToast } from "../../components/Toast";
import { formatDateTime } from "../../utils/format";
import { useBilling } from "../../features/billing/BillingContext";
import { APPROVAL_LABELS, BillingGate, BucketBadge, ErrorList, METHOD_LABELS, METHOD_OPTIONS, Money, StateBadge, Stat, useLoad } from "../../features/billing/components";
import { emiApi, fromPaise, inr, newKey, toPaise } from "../../features/billing/api";

const B = "/dashboard/billing";
const OUTCOMES = [
  { value: "CALLED", label: "Called, spoke to customer" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "PROMISED_TO_PAY", label: "Promised to pay" },
  { value: "VISITED", label: "Visited" },
  { value: "DISPUTE", label: "Dispute raised" },
  { value: "OTHER", label: "Other" },
];

function useAction(onDone) {
  const toast = useToast();
  const [state, setState] = useState({ saving: false, error: null });
  const run = async (fn, message) => {
    setState({ saving: true, error: null });
    try {
      const res = await fn();
      if (message) toast.success(typeof message === "function" ? message(res) : message);
      setState({ saving: false, error: null });
      onDone?.(res);
      return res;
    } catch (error) {
      setState({ saving: false, error });
      return null;
    }
  };
  return { ...state, run, reset: () => setState({ saving: false, error: null }) };
}

function CollectModal({ contract, dueNow, open, onOpenChange, onDone }) {
  const [form, setForm] = useState({ method: "CASH", amount: dueNow ? String(fromPaise(dueNow)) : String(fromPaise(contract.emiAmount)), txnRef: "" });
  const [key] = useState(newKey);
  const action = useAction(() => {
    onOpenChange(false);
    onDone();
  });
  const submit = () =>
    action.run(
      () => emiApi.post(`/emi/${contract._id}/payments`, { method: form.method, amount: toPaise(form.amount), txnRef: form.txnRef || undefined }, key),
      (res) => (res.data.duplicate ? "Already recorded" : `Receipt ${res.data.payment.receiptNo} saved`)
    );
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Collect EMI"
      description="Pays the oldest dues first: late fee, then interest, then principal. More than the whole loan is kept as advance."
      footer={
        <Button loading={action.saving} disabled={toPaise(form.amount) <= 0} onClick={submit}>
          Save receipt
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} options={METHOD_OPTIONS} />
        <Input label="Amount (₹)" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} hint={dueNow ? `Due now ${inr(dueNow)}` : "Nothing overdue; this pays ahead"} />
        {form.method !== "CASH" && <Input label="Reference" className="sm:col-span-2" value={form.txnRef} onChange={(e) => setForm({ ...form, txnRef: e.target.value })} />}
      </div>
      {action.error && <ErrorList error={action.error} className="mt-3" />}
    </Modal>
  );
}

function ForecloseModal({ contract, open, onOpenChange, onDone }) {
  const quote = useLoad(() => (open ? emiApi.get(`/emi/${contract._id}/foreclosure-quote`) : Promise.resolve({ data: null })), [open]);
  const [form, setForm] = useState({ method: "BANK", txnRef: "", reason: "" });
  const action = useAction(() => {
    onOpenChange(false);
    onDone();
  });
  const q = quote.data;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Foreclose this EMI"
      description="Today's settlement amount. It goes for approval; the money is recorded when it is approved."
      footer={
        <Button loading={action.saving} disabled={!q} onClick={() => action.run(() => emiApi.post(`/emi/${contract._id}/foreclose`, { ...form, txnRef: form.txnRef || undefined, reason: form.reason || undefined }), "Foreclosure sent for approval")}>
          Send for approval
        </Button>
      }
    >
      {quote.error && <ErrorList error={quote.error} />}
      {q && (
        <dl className="mb-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-fg-muted">Dues already overdue</dt>
          <dd className="text-right tabular-nums">{inr(q.dueNow)}</dd>
          <dt className="text-fg-muted">Principal outstanding</dt>
          <dd className="text-right tabular-nums">{inr(q.outstandingPrincipal)}</dd>
          <dt className="text-fg-muted">Interest for {q.accruedDays} days</dt>
          <dd className="text-right tabular-nums">{inr(q.accruedInterest + q.accruedInterestGst)}</dd>
          <dt className="text-fg-muted">Foreclosure charge + GST</dt>
          <dd className="text-right tabular-nums">{inr(q.charge + q.chargeGst)}</dd>
          {q.advance > 0 && (
            <>
              <dt className="text-fg-muted">Less advance</dt>
              <dd className="text-right tabular-nums">−{inr(q.advance)}</dd>
            </>
          )}
          <dt className="border-t border-line pt-1 font-semibold">To settle today</dt>
          <dd className="border-t border-line pt-1 text-right font-semibold tabular-nums">{inr(q.total)}</dd>
        </dl>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Customer pays by" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} options={METHOD_OPTIONS} />
        <Input label="Reference" value={form.txnRef} onChange={(e) => setForm({ ...form, txnRef: e.target.value })} />
        <Textarea label="Note for the approver" className="sm:col-span-2" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </div>
      {action.error && <ErrorList error={action.error} className="mt-3" />}
    </Modal>
  );
}

function WaiverModal({ installment, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const action = useAction(() => {
    onClose();
    onDone();
  });
  return (
    <Modal
      open={Boolean(installment)}
      onOpenChange={(open) => !open && onClose()}
      title={`Waive late fee on EMI #${installment?.no}`}
      description={installment && `${inr(installment.unpaidParts.lateFee)} late fee. A Store Admin approves it.`}
      size="sm"
      footer={
        <Button loading={action.saving} disabled={reason.trim().length < 3} onClick={() => action.run(() => emiApi.post(`/emi/installments/${installment._id}/waiver-request`, { reason }), "Waiver sent for approval")}>
          Send for approval
        </Button>
      }
    >
      <Textarea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      {action.error && <ErrorList error={action.error} className="mt-3" />}
    </Modal>
  );
}

function FollowUps({ contract, onDone }) {
  const { can } = useBilling();
  const [form, setForm] = useState({ outcome: "CALLED", note: "", nextActionDate: "" });
  const action = useAction(() => {
    setForm({ outcome: "CALLED", note: "", nextActionDate: "" });
    onDone();
  });
  const list = [...(contract.followUps || [])].reverse();
  return (
    <Card>
      <CardHeader title="Follow-ups" description="Calls and visits for this contract" />
      <CardBody className="flex flex-col gap-4">
        {can("emi.followup") && (
          <div className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-2">
            <Select label="Outcome" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} options={OUTCOMES} />
            <Input label="Next action on" type="date" value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} />
            <Textarea label="Note" rows={2} className="sm:col-span-2" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div className="sm:col-span-2">
              <Button size="sm" icon={MessageSquarePlus} loading={action.saving} onClick={() => action.run(() => emiApi.post(`/emi/${contract._id}/followups`, { ...form, nextActionDate: form.nextActionDate || undefined, note: form.note || undefined }), "Follow-up saved")}>
                Add follow-up
              </Button>
            </div>
            {action.error && <ErrorList error={action.error} className="sm:col-span-2" />}
          </div>
        )}
        {list.length === 0 ? (
          <p className="text-caption text-fg-muted">No follow-ups yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {list.map((f) => (
              <li key={f._id} className="flex gap-3 text-sm">
                <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-fg">
                    {OUTCOMES.find((o) => o.value === f.outcome)?.label}
                    {f.nextActionDate && <span className="text-fg-muted"> · next on {f.nextActionDate}</span>}
                  </p>
                  {f.note && <p className="text-caption text-fg-muted">{f.note}</p>}
                  <p className="text-xs text-fg-subtle">
                    {f.byName} · {formatDateTime(f.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function AssignAgent({ contract, onDone }) {
  const agents = useLoad(() => emiApi.get("/agents"), []);
  const action = useAction(onDone);
  return (
    <div className="flex items-end gap-2">
      <Select
        label="Collection agent"
        className="flex-1"
        value={contract.assignedAgentId || ""}
        onChange={(e) => action.run(() => emiApi.post(`/emi/${contract._id}/assign`, { agentId: e.target.value || null }), "Agent updated")}
        options={[{ value: "", label: "Not assigned" }, ...(agents.data || []).map((a) => ({ value: a._id, label: a.name }))]}
      />
      {action.saving && <UserCheck className="mb-2.5 h-4 w-4 animate-pulse text-fg-muted" aria-hidden="true" />}
    </div>
  );
}

function Detail() {
  const { id } = useParams();
  const { can } = useBilling();
  const { data, loading, error, reload } = useLoad(() => emiApi.get(`/emi/${id}`), [id]);
  const [collecting, setCollecting] = useState(false);
  const [foreclosing, setForeclosing] = useState(false);
  const [waiving, setWaiving] = useState(null);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState description={error.message} onRetry={reload} />;
  const { contract, installments, payments, approvals, customer, storeName, agentName } = data;
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const dueNow = installments.filter((i) => !["PAID", "CANCELLED"].includes(i.status) && i.dueDate <= today).reduce((s, i) => s + i.unpaid, 0);
  const left = installments.reduce((s, i) => s + (["CANCELLED"].includes(i.status) ? 0 : i.unpaid), 0);
  const active = contract.status === "ACTIVE";
  const pending = approvals.filter((a) => a.status === "PENDING");

  return (
    <>
      <Link to={`${B}/emi`} className="mb-3 inline-flex items-center gap-1 text-caption text-fg-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> EMI collections
      </Link>
      <PageHeader
        title={contract.contractNo}
        description={`${customer?.name} · ${customer?.phone || ""} · ${storeName || ""}`}
        actions={
          <>
            {active ? <BucketBadge bucket={contract.bucket} /> : <StateBadge status={contract.status} />}
            <Button as={Link} variant="secondary" icon={FileText} to={`${B}/invoices/${contract.invoiceId}`}>
              Invoice
            </Button>
            {active && can("emi.create") && (
              <Button variant="secondary" icon={XCircle} onClick={() => setForeclosing(true)}>
                Foreclose
              </Button>
            )}
            {active && can("payment.collect") && (
              <Button icon={HandCoins} onClick={() => setCollecting(true)}>
                Collect payment
              </Button>
            )}
          </>
        }
      />

      {contract.status === "PENDING_APPROVAL" && (
        <Alert tone="warning" className="mb-4" title="Waiting for approval">
          This EMI is above the shop's approval limit. It starts once a Store Admin approves it in Approvals.
        </Alert>
      )}
      {pending.length > 0 && contract.status !== "PENDING_APPROVAL" && (
        <Alert tone="info" className="mb-4">
          Waiting for approval: {pending.map((a) => APPROVAL_LABELS[a.type]).join(", ")}.
        </Alert>
      )}

      <Card className="mb-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Monthly EMI">{inr(contract.emiAmount)}</Stat>
        <Stat label="Due now">{dueNow ? inr(dueNow) : "—"}</Stat>
        <Stat label="Left to pay">{inr(left)}</Stat>
        <Stat label="Principal paid">{inr(contract.paidPrincipal)} of {inr(contract.principal, { whole: true })}</Stat>
        <Stat label="Rate · tenure">{contract.annualRatePct}% · {contract.tenureMonths} months</Stat>
        <Stat label="Days past due">{contract.currentDpd || 0} (max {contract.maxDpd || 0})</Stat>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Schedule" description={`Interest GST: ${contract.gstMode.replace(/_/g, " ").toLowerCase()}, ${contract.gstTiming === "UPFRONT" ? "booked at sale" : "with each EMI"}`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-line bg-surface-2/60 text-xs text-fg-muted">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Due</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">Late fee</th>
                    <th className="px-3 py-2 text-right font-medium">Still owed</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {installments.map((i) => (
                    <tr key={i._id} className="border-b border-line">
                      <td className="px-5 py-2 text-fg-muted">{i.no}</td>
                      <td className="px-3 py-2">{i.dueDate}</td>
                      <td className="px-3 py-2 text-right">{inr(i.amountDue)}</td>
                      <td className="px-3 py-2 text-right">{i.lateFee ? `${inr(i.lateFee)}${i.lateFeeWaived ? " (waived)" : ""}` : "—"}</td>
                      <td className="px-3 py-2 text-right font-medium">{i.unpaid ? inr(i.unpaid) : "—"}</td>
                      <td className="px-3 py-2">
                        <StateBadge status={i.status} />
                        {i.dpd > 0 && <span className="ml-1 text-xs text-fg-muted">{i.dpd}d</span>}
                      </td>
                      <td className="px-5 py-2 text-right">
                        {active && i.unpaidParts.lateFee > 0 && can("approval.create") && (
                          <Button size="sm" variant="ghost" onClick={() => setWaiving(i)}>
                            Waive fee
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Receipts" />
            <CardBody className="px-0">
              {payments.length === 0 ? (
                <p className="px-5 text-caption text-fg-muted">No EMI received yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {payments.map((p) => (
                    <li key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-fg">{p.receiptNo}</span>
                        <span className="block text-caption text-fg-muted">
                          {METHOD_LABELS[p.method]} · {formatDateTime(p.createdAt)}
                          {p.allocations?.length ? ` · EMI ${p.allocations.map((a) => `#${a.no}`).join(", ")}` : ""}
                          {p.advance ? ` · advance ${inr(p.advance)}` : ""}
                        </span>
                      </span>
                      <StateBadge status={p.status} />
                      <Money value={p.amount} className="w-28 text-right font-medium" />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Customer" />
            <CardBody>
              <dl className="divide-y divide-line">
                <DetailRow label="Name">{customer?.name}</DetailRow>
                <DetailRow label="Mobile">{customer?.phone || "—"}</DetailRow>
                <DetailRow label="PAN">{customer?.pan || "—"}</DetailRow>
                <DetailRow label="Risk grade">{customer?.riskGrade || "—"}</DetailRow>
                {!can("emi.approve") && <DetailRow label="Agent">{agentName || "—"}</DetailRow>}
              </dl>
              {can("emi.approve") && (
                <div className="mt-3">
                  <AssignAgent contract={contract} onDone={reload} />
                </div>
              )}
            </CardBody>
          </Card>
          <FollowUps contract={contract} onDone={reload} />
        </div>
      </div>

      {collecting && <CollectModal contract={contract} dueNow={dueNow} open={collecting} onOpenChange={setCollecting} onDone={reload} />}
      {foreclosing && <ForecloseModal contract={contract} open={foreclosing} onOpenChange={setForeclosing} onDone={reload} />}
      <WaiverModal installment={waiving} onClose={() => setWaiving(null)} onDone={reload} />
    </>
  );
}

export default function EmiDetail() {
  return (
    <BillingGate perm="emi.read">
      <Detail />
    </BillingGate>
  );
}
