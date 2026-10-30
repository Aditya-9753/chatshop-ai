import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Ban, CalendarClock, Printer } from "lucide-react";
import { Alert, Button, Card, CardBody, CardHeader, DetailRow, ErrorState, Modal, PageHeader, PageLoader, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { formatDateTime } from "../../utils/format";
import { useBilling } from "../../features/billing/BillingContext";
import { APPROVAL_LABELS, BillingGate, ErrorList, FINANCE_LABELS, METHOD_LABELS, Money, StateBadge, useLoad } from "../../features/billing/components";
import { emiApi, inr } from "../../features/billing/api";
import { printTaxInvoice } from "../../features/billing/printInvoice";

const B = "/dashboard/billing";

function CancelRequest({ invoice, onDone }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await emiApi.post(`/invoices/${invoice._id}/cancel-request`, { reason });
      toast.success("Cancellation sent for approval");
      setOpen(false);
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Button variant="secondary" icon={Ban} onClick={() => setOpen(true)}>
        Request cancellation
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Cancel ${invoice.invoiceNo}?`}
        description="A Store Admin approves it. Stock and IMEIs go back, and reversal entries are posted. Not possible once an EMI or the NBFC payout has come in."
        footer={
          <Button variant="danger" loading={saving} disabled={reason.trim().length < 3} onClick={submit}>
            Send for approval
          </Button>
        }
      >
        <Textarea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <ErrorList error={error} className="mt-3" />}
      </Modal>
    </>
  );
}

function Detail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { can } = useBilling();
  const { data, loading, error, reload } = useLoad(() => emiApi.get(`/invoices/${id}`), [id]);
  const printed = useRef(false);

  useEffect(() => {
    if (data && params.get("print") === "1" && !printed.current) {
      printed.current = true;
      printTaxInvoice(data);
    }
  }, [data, params]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState description={error.message} onRetry={reload} />;
  const { invoice, payments, contract, nbfcCase, approvals, store } = data;
  const pendingCancel = approvals.some((a) => a.type === "INVOICE_CANCEL" && a.status === "PENDING");

  return (
    <>
      <Link to={`${B}/invoices`} className="mb-3 inline-flex items-center gap-1 text-caption text-fg-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Invoices
      </Link>
      <PageHeader
        title={`Invoice ${invoice.invoiceNo}`}
        description={`${invoice.date} · ${store?.name || ""} · ${FINANCE_LABELS[invoice.financeType]}`}
        actions={
          <>
            <StateBadge status={invoice.status} />
            {can("approval.create") && invoice.status !== "CANCELLED" && !pendingCancel && <CancelRequest invoice={invoice} onDone={reload} />}
            <Button icon={Printer} onClick={() => printTaxInvoice(data)}>
              Print
            </Button>
          </>
        }
      />
      {pendingCancel && (
        <Alert tone="warning" className="mb-4">
          A cancellation request is waiting for approval.
        </Alert>
      )}
      {invoice.status === "CANCELLED" && (
        <Alert tone="danger" className="mb-4" title="Cancelled">
          {invoice.cancelReason}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Items" description={invoice.interState ? "Inter-state: IGST" : "Intra-state: CGST + SGST"} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-line bg-surface-2/60 text-xs text-fg-muted">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-left font-medium">HSN</th>
                    <th className="px-3 py-2 text-right font-medium">Taxable</th>
                    <th className="px-3 py-2 text-right font-medium">GST</th>
                    <th className="px-5 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {invoice.lines.map((l, i) => (
                    <tr key={i} className="border-b border-line">
                      <td className="px-5 py-2.5">
                        <span className="block text-fg">{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}</span>
                        {l.imei && <span className="block font-mono text-xs text-fg-muted">IMEI {l.imei}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-fg-muted">{l.hsn || "—"}</td>
                      <td className="px-3 py-2.5 text-right">{inr(l.taxable)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {inr(l.cgst + l.sgst + l.igst)} <span className="text-xs text-fg-muted">({l.gstRatePct}%)</span>
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium">{inr(l.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="pt-4">
              <dl className="ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
                <dt className="text-fg-muted">Taxable</dt>
                <dd className="text-right tabular-nums">{inr(invoice.taxable)}</dd>
                {invoice.igst > 0 ? (
                  <>
                    <dt className="text-fg-muted">IGST</dt>
                    <dd className="text-right tabular-nums">{inr(invoice.igst)}</dd>
                  </>
                ) : (
                  <>
                    <dt className="text-fg-muted">CGST</dt>
                    <dd className="text-right tabular-nums">{inr(invoice.cgst)}</dd>
                    <dt className="text-fg-muted">SGST</dt>
                    <dd className="text-right tabular-nums">{inr(invoice.sgst)}</dd>
                  </>
                )}
                <dt className="border-t border-line pt-1 font-semibold">Total</dt>
                <dd className="border-t border-line pt-1 text-right font-semibold tabular-nums">{inr(invoice.grossTotal)}</dd>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payments" />
            <CardBody className="px-0">
              {payments.length === 0 ? (
                <p className="px-5 text-caption text-fg-muted">Nothing received at the counter: fully financed.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {payments.map((p) => (
                    <li key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-fg">{p.receiptNo}</span>
                        <span className="block text-caption text-fg-muted">
                          {p.purpose === "SALE" ? "At sale" : p.purpose === "EMI" ? "EMI" : "Foreclosure"} · {METHOD_LABELS[p.method]}
                          {p.txnRef ? ` · ${p.txnRef}` : ""} · {formatDateTime(p.createdAt)}
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
                <DetailRow label="Name">{invoice.customer?.name}</DetailRow>
                <DetailRow label="Mobile">{invoice.customer?.phone || "—"}</DetailRow>
                <DetailRow label="PAN">{invoice.customer?.pan || "—"}</DetailRow>
                <DetailRow label="State code">{invoice.customer?.stateCode || "—"}</DetailRow>
              </dl>
            </CardBody>
          </Card>

          {contract && (
            <Card>
              <CardHeader title="Shop EMI" action={<Button as={Link} size="sm" variant="secondary" icon={CalendarClock} to={`${B}/emi/${contract._id}`}>Open</Button>} />
              <CardBody>
                <dl className="divide-y divide-line">
                  <DetailRow label="Contract">{contract.contractNo}</DetailRow>
                  <DetailRow label="EMI">{inr(contract.emiAmount)} × {contract.tenureMonths}</DetailRow>
                  <DetailRow label="Rate">{contract.annualRatePct}% p.a.</DetailRow>
                  <DetailRow label="Principal left">{inr(contract.principal - contract.paidPrincipal)}</DetailRow>
                  <DetailRow label="Status"><StateBadge status={contract.status} /></DetailRow>
                </dl>
              </CardBody>
            </Card>
          )}

          {nbfcCase && (
            <Card>
              <CardHeader title="NBFC finance" />
              <CardBody>
                <dl className="divide-y divide-line">
                  <DetailRow label="Partner">{nbfcCase.partnerName}</DetailRow>
                  <DetailRow label="Loan">{inr(nbfcCase.loanAmount)}</DetailRow>
                  <DetailRow label="Subvention">{inr(nbfcCase.subvention)} + GST {inr(nbfcCase.subventionGst)}</DetailRow>
                  <DetailRow label="Expected payout">{inr(nbfcCase.expectedPayout)}</DetailRow>
                  <DetailRow label="Status"><StateBadge status={nbfcCase.status} /></DetailRow>
                </dl>
              </CardBody>
            </Card>
          )}

          {approvals.length > 0 && (
            <Card>
              <CardHeader title="Approvals" />
              <CardBody>
                <ul className="flex flex-col gap-3 text-sm">
                  {approvals.map((a) => (
                    <li key={a._id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-fg">{APPROVAL_LABELS[a.type]}</span>
                        <StateBadge status={a.status} />
                      </div>
                      <p className="text-caption text-fg-muted">
                        Asked by {a.requestedByName}
                        {a.decidedByName ? ` · decided by ${a.decidedByName}` : ""}
                        {a.decisionNote ? ` · “${a.decisionNote}”` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export default function InvoiceDetail() {
  return (
    <BillingGate perm="invoice.read">
      <Detail />
    </BillingGate>
  );
}
