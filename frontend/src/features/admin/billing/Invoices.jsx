import React, { useEffect, useMemo, useState } from "react";
import { Ban, FileText, Plus, Printer, Trash2, Wallet } from "lucide-react";
import { useToast } from "../../../components/Toast";
import { Alert, Button, DataTable, DetailRow, Drawer, Input, Modal, SectionLabel, Select, Textarea } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";
import { inr, newKey } from "../../billing/api";
import { GATEWAY_LABELS, platformAdminApi } from "../../platformBilling/api";
import { printPlatformInvoice } from "../../platformBilling/printPlatformInvoice";
import { istToday, rupeesToPaise, StatusBadge, useData } from "./shared";

const blankLine = () => ({ id: newKey(), kind: "SUBSCRIPTION", planCode: "", periodStart: istToday(), periodEnd: istToday(30), description: "", qty: "1", price: "", discount: "" });

const toBody = (form) => ({
  merchantId: form.merchantId,
  dueDate: form.dueDate || undefined,
  notes: form.notes || undefined,
  lines: form.lines.map((l) =>
    l.kind === "SUBSCRIPTION"
      ? { kind: l.kind, planCode: l.planCode, periodStart: l.periodStart, periodEnd: l.periodEnd, unitPricePaise: rupeesToPaise(l.price), discountPaise: rupeesToPaise(l.discount), description: l.description || undefined }
      : { kind: l.kind, description: l.description, qty: Number(l.qty) || 1, unitPricePaise: rupeesToPaise(l.price), discountPaise: rupeesToPaise(l.discount) }
  ),
});

function Totals({ doc }) {
  const gst = doc.gstRegistered;
  return (
    <dl className="ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm">
      <dt className="text-fg-muted">Taxable</dt>
      <dd className="text-right tabular-nums">{inr(doc.taxablePaise)}</dd>
      {gst && doc.igstPaise > 0 && (
        <>
          <dt className="text-fg-muted">IGST</dt>
          <dd className="text-right tabular-nums">{inr(doc.igstPaise)}</dd>
        </>
      )}
      {gst && !doc.igstPaise && (
        <>
          <dt className="text-fg-muted">CGST + SGST</dt>
          <dd className="text-right tabular-nums">{inr(doc.cgstPaise + doc.sgstPaise)}</dd>
        </>
      )}
      <dt className="border-t border-line pt-1 font-semibold">Total</dt>
      <dd className="border-t border-line pt-1 text-right font-semibold tabular-nums">{inr(doc.grandTotalPaise)}</dd>
    </dl>
  );
}

function NewInvoice({ open, onOpenChange, onIssued }) {
  const toast = useToast();
  const shops = useData(() => platformAdminApi.shops(), []);
  const plans = useData(() => platformAdminApi.plans(), []);
  const [form, setForm] = useState({ merchantId: "", lines: [blankLine()], dueDate: "", notes: "" });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [key, setKey] = useState(newKey());

  useEffect(() => {
    if (open) {
      setForm({ merchantId: "", lines: [blankLine()], dueDate: "", notes: "" });
      setPreview(null);
      setError(null);
      setKey(newKey()); // one issue per dialog, even if "Issue" is pressed twice
    }
  }, [open]);

  const setLine = (id, patch) => {
    setPreview(null);
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  };
  const set = (patch) => {
    setPreview(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  const call = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.errors?.join(" · ") || e.message);
    } finally {
      setBusy(null);
    }
  };

  const shopOptions = (shops.data || []).map((u) => ({ value: u._id, label: `${u.businessInfo?.businessName || u.name} · ${u.email}` }));
  const planOptions = (plans.data || []).map((p) => ({ value: p.code, label: `${p.name} (${inr(p.pricePaise, { whole: true })})` }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="New invoice to a shop"
      description="For a negotiated plan, an add-on or a custom service. GST is worked out on the server from Billing settings."
      footer={
        <>
          <Button variant="secondary" loading={busy === "preview"} disabled={!form.merchantId || Boolean(busy)} onClick={() => call("preview", async () => setPreview((await platformAdminApi.previewInvoice(toBody(form))).data))}>
            Preview
          </Button>
          <Button
            loading={busy === "issue"}
            disabled={!preview || Boolean(busy)}
            onClick={() =>
              call("issue", async () => {
                const { data } = await platformAdminApi.issueInvoice(toBody(form), key);
                toast.success(`Invoice ${data.invoiceNo} issued`);
                onIssued(data);
              })
            }
          >
            Issue invoice
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label="Shop" required value={form.merchantId} onChange={(e) => set({ merchantId: e.target.value })} options={[{ value: "", label: shops.data ? "Choose a shop" : "Loading…" }, ...shopOptions]} />
        <div className="flex flex-col gap-3">
          <SectionLabel>Lines</SectionLabel>
          {form.lines.map((l) => (
            <div key={l.id} className="grid grid-cols-2 gap-3 rounded-lg border border-line p-3 sm:grid-cols-6">
              <Select
                label="Type"
                className="col-span-2 sm:col-span-2"
                value={l.kind}
                onChange={(e) => setLine(l.id, { kind: e.target.value })}
                options={[
                  { value: "SUBSCRIPTION", label: "Plan subscription" },
                  { value: "ADDON", label: "Add-on" },
                  { value: "CUSTOM", label: "Custom service" },
                ]}
              />
              {l.kind === "SUBSCRIPTION" ? (
                <>
                  <Select label="Plan" className="col-span-2 sm:col-span-4" value={l.planCode} onChange={(e) => setLine(l.id, { planCode: e.target.value })} options={[{ value: "", label: "Choose a plan" }, ...planOptions]} />
                  <Input label="From" type="date" className="col-span-1 sm:col-span-2" value={l.periodStart} onChange={(e) => setLine(l.id, { periodStart: e.target.value })} />
                  <Input label="To" type="date" className="col-span-1 sm:col-span-2" value={l.periodEnd} onChange={(e) => setLine(l.id, { periodEnd: e.target.value })} />
                  <Input label="Price ₹" hint="Blank: plan price" inputMode="decimal" className="col-span-1" value={l.price} onChange={(e) => setLine(l.id, { price: e.target.value })} />
                  <Input label="Discount ₹" inputMode="decimal" className="col-span-1" value={l.discount} onChange={(e) => setLine(l.id, { discount: e.target.value })} />
                </>
              ) : (
                <>
                  <Input label="Description" className="col-span-2 sm:col-span-4" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />
                  <Input label="Qty" inputMode="numeric" className="col-span-1 sm:col-span-2" value={l.qty} onChange={(e) => setLine(l.id, { qty: e.target.value })} />
                  <Input label="Price ₹ each" inputMode="decimal" className="col-span-1 sm:col-span-2" value={l.price} onChange={(e) => setLine(l.id, { price: e.target.value })} />
                  <Input label="Discount ₹" inputMode="decimal" className="col-span-1 sm:col-span-2" value={l.discount} onChange={(e) => setLine(l.id, { discount: e.target.value })} />
                </>
              )}
              {form.lines.length > 1 && (
                <div className="col-span-2 flex justify-end sm:col-span-6">
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => set({ lines: form.lines.filter((x) => x.id !== l.id) })}>
                    Remove line
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} className="self-start" disabled={form.lines.length >= 20} onClick={() => set({ lines: [...form.lines, { ...blankLine(), kind: "CUSTOM" }] })}>
            Add line
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Due date" type="date" hint="Blank: payment terms from settings" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          <Textarea label="Notes on the invoice" className="sm:col-span-2" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        {preview && (
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 text-caption text-fg-muted">
              Preview · {preview.gstRegistered ? (preview.interState ? "inter-state (IGST)" : "same state (CGST + SGST)") : "no GST (no GSTIN in Billing settings)"} · due {preview.dueDate}
            </p>
            <ul className="mb-3 flex flex-col gap-1 text-sm">
              {preview.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-fg">{l.description}</span>
                  <span className="tabular-nums">{inr(l.totalPaise)}</span>
                </li>
              ))}
            </ul>
            <Totals doc={preview} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function RecordPayment({ invoice, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ method: "BANK", amount: String(invoice.balanceDuePaise / 100), reference: "", receivedOn: istToday(), note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [key] = useState(newKey());
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await platformAdminApi.recordPayment(invoice._id, { method: form.method, amountPaise: rupeesToPaise(form.amount), reference: form.reference || undefined, receivedOn: form.receivedOn, note: form.note || undefined }, key);
      toast.success("Payment recorded");
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <SectionLabel>Record a payment received outside the gateway</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Method"
          value={form.method}
          onChange={(e) => setForm({ ...form, method: e.target.value })}
          options={[
            { value: "BANK", label: "Bank transfer" },
            { value: "UPI", label: "UPI" },
            { value: "CHEQUE", label: "Cheque" },
            { value: "CASH", label: "Cash" },
            { value: "CARD", label: "Card" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Input label="Amount ₹" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Input label="Reference (UTR, cheque no.)" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        <Input label="Received on" type="date" value={form.receivedOn} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button icon={Wallet} className="self-end" loading={busy} disabled={!form.amount} onClick={submit}>
        Record payment
      </Button>
    </div>
  );
}

function InvoiceDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, error, reload } = useData(() => platformAdminApi.invoice(id), [id]);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const inv = data?.invoice;

  const doVoid = async () => {
    setBusy(true);
    try {
      await platformAdminApi.voidInvoice(id, reason);
      toast.success("Invoice voided");
      setVoiding(false);
      reload();
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      title={inv ? `${inv.documentType === "CREDIT_NOTE" ? "Credit note" : "Invoice"} ${inv.invoiceNo}` : "Invoice"}
      description={inv ? `${inv.customerSnapshot?.businessName || inv.customerSnapshot?.name} · ${inv.invoiceDate}` : undefined}
      footer={
        inv && (
          <>
            {inv.documentType === "INVOICE" && inv.status === "ISSUED" && inv.amountPaidPaise === 0 && (
              <Button variant="secondary" icon={Ban} onClick={() => setVoiding(true)}>
                Void
              </Button>
            )}
            <Button icon={Printer} onClick={() => printPlatformInvoice(data) || toast.error("Allow pop-ups to print")}>
              Print
            </Button>
          </>
        )
      }
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {inv && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={inv.status === "VOID" ? "VOID" : inv.paymentStatus} />
            <span className="text-caption text-fg-muted">
              {inv.source === "CHECKOUT" ? "Paid online at checkout" : inv.source === "REFUND" ? "Issued for a refund" : "Issued by the Super Admin"}
            </span>
          </div>
          {inv.status === "VOID" && <Alert tone="danger" title="Void">{inv.voidReason}</Alert>}
          <dl className="divide-y divide-line">
            <DetailRow label="Shop">{inv.customerSnapshot?.legalName || inv.customerSnapshot?.name}</DetailRow>
            <DetailRow label="Shop GSTIN">{inv.customerSnapshot?.gstin || "—"}</DetailRow>
            <DetailRow label="Place of supply">{inv.placeOfSupply || "—"}</DetailRow>
            {inv.documentType === "INVOICE" && <DetailRow label="Due">{inv.dueDate}</DetailRow>}
            {data.original && <DetailRow label="Against invoice">{data.original.invoiceNo}</DetailRow>}
          </dl>
          <div>
            <SectionLabel className="mb-2">Lines</SectionLabel>
            <ul className="flex flex-col gap-2 text-sm">
              {inv.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-fg">{l.description}</span>
                    <span className="block text-caption text-fg-muted">
                      {l.qty} × {inr(l.unitPricePaise)}
                      {l.discountPaise ? ` − ${inr(l.discountPaise)}` : ""}
                      {l.taxRateBps ? ` · GST ${l.taxRateBps / 100}%` : ""}
                    </span>
                  </span>
                  <span className="tabular-nums">{inr(l.totalPaise)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Totals doc={inv} />
            </div>
          </div>
          {inv.documentType === "INVOICE" && (
            <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-2 p-3 text-sm">
              <div>
                <dt className="text-xs text-fg-muted">Paid</dt>
                <dd className="tabular-nums">{inr(inv.amountPaidPaise)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Balance</dt>
                <dd className="font-medium tabular-nums">{inr(inv.balanceDuePaise)}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Credited</dt>
                <dd className="tabular-nums">{inr(inv.creditedPaise)}</dd>
              </div>
            </dl>
          )}
          {data.payments.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Payments</SectionLabel>
              <ul className="divide-y divide-line text-sm">
                {data.payments.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="block font-medium">{p.paymentRef}</span>
                      <span className="block text-caption text-fg-muted">
                        {GATEWAY_LABELS[p.gateway]} {p.method ? `· ${p.method}` : ""} {p.reference ? `· ${p.reference}` : ""} · {formatDateTime(p.capturedAt)}
                      </span>
                    </span>
                    <span className="tabular-nums">{inr(p.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.creditNotes.length > 0 && (
            <div>
              <SectionLabel className="mb-2">Credit notes</SectionLabel>
              <ul className="text-sm">
                {data.creditNotes.map((c) => (
                  <li key={c._id} className="flex justify-between py-1">
                    <span>
                      {c.invoiceNo} · {c.reason}
                    </span>
                    <span className="tabular-nums">{inr(c.grandTotalPaise)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inv.documentType === "INVOICE" && inv.status === "ISSUED" && inv.balanceDuePaise > 0 && (
            <RecordPayment
              invoice={inv}
              onDone={() => {
                reload();
                onChanged();
              }}
            />
          )}
        </div>
      )}
      <Modal
        open={voiding}
        onOpenChange={setVoiding}
        size="sm"
        title="Void this invoice?"
        description="Only an invoice with no money received can be voided. The number stays used; nothing is deleted."
        footer={
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={doVoid}>
            Void invoice
          </Button>
        }
      >
        <Textarea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </Drawer>
  );
}

export default function Invoices() {
  const [filter, setFilter] = useState({ documentType: "", paymentStatus: "", overdue: "" });
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const params = useMemo(() => ({ ...filter, limit: 200 }), [filter]);
  const { data, error, loading, reload } = useData(() => platformAdminApi.invoices(params), [params]);

  const columns = [
    {
      key: "invoiceNo",
      header: "Number",
      cell: (r) => (
        <span className="font-medium text-fg">
          {r.invoiceNo}
          {r.documentType === "CREDIT_NOTE" && <span className="block text-xs font-normal text-fg-muted">Credit note</span>}
        </span>
      ),
    },
    { key: "invoiceDate", header: "Date", hideBelow: "sm" },
    { key: "shop", header: "Shop", sortValue: (r) => r.customerSnapshot?.businessName || r.customerSnapshot?.name, cell: (r) => r.customerSnapshot?.businessName || r.customerSnapshot?.name },
    { key: "source", header: "From", hideBelow: "lg", cell: (r) => ({ CHECKOUT: "Online checkout", MANUAL: "Manual", REFUND: "Refund" })[r.source] },
    { key: "grandTotalPaise", header: "Total", align: "right", cell: (r) => <span className="tabular-nums">{inr(r.grandTotalPaise)}</span> },
    { key: "balanceDuePaise", header: "Due", align: "right", hideBelow: "md", cell: (r) => (r.documentType === "INVOICE" && r.balanceDuePaise ? <span className="tabular-nums">{inr(r.balanceDuePaise)}</span> : "—") },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status === "VOID" ? "VOID" : r.paymentStatus} /> },
  ];

  return (
    <div>
      <DataTable
        columns={columns}
        rows={data?.rows || []}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        onRowClick={(r) => setOpenId(r._id)}
        searchable
        searchPlaceholder="Number or shop"
        searchText={(r) => [r.invoiceNo, r.customerSnapshot?.businessName, r.customerSnapshot?.name, r.customerSnapshot?.email].join(" ")}
        toolbar={
          <>
            <Select
              aria-label="Document"
              className="w-40"
              value={filter.documentType}
              onChange={(e) => setFilter({ ...filter, documentType: e.target.value })}
              options={[
                { value: "", label: "All documents" },
                { value: "INVOICE", label: "Invoices" },
                { value: "CREDIT_NOTE", label: "Credit notes" },
              ]}
            />
            <Select
              aria-label="Payment"
              className="w-40"
              value={filter.overdue ? "overdue" : filter.paymentStatus}
              onChange={(e) => setFilter({ ...filter, paymentStatus: e.target.value === "overdue" ? "" : e.target.value, overdue: e.target.value === "overdue" ? "true" : "" })}
              options={[
                { value: "", label: "Any payment" },
                { value: "UNPAID", label: "Unpaid" },
                { value: "PARTIALLY_PAID", label: "Part paid" },
                { value: "PAID", label: "Paid" },
                { value: "overdue", label: "Overdue" },
              ]}
            />
            <Button icon={Plus} onClick={() => setCreating(true)}>
              New invoice
            </Button>
          </>
        }
        empty={{ icon: FileText, title: "No invoices", description: "Invoices appear when shops pay for a plan, or when you issue one." }}
        pageSize={15}
      />
      <NewInvoice
        open={creating}
        onOpenChange={setCreating}
        onIssued={(inv) => {
          setCreating(false);
          reload();
          setOpenId(inv._id);
        }}
      />
      {openId && <InvoiceDrawer id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  );
}
