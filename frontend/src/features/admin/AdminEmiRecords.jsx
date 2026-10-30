import React, { useState } from "react";
import { CalendarClock, FileText, Printer, Wallet } from "lucide-react";
import { Button, DataTable, DetailRow, Drawer, SectionLabel, Select, Skeleton, Tabs } from "../../components/ui";
import { formatDateTime } from "../../utils/format";
import { BucketBadge, FINANCE_LABELS, METHOD_LABELS, Money, StateBadge, useLoad } from "../billing/components";
import { emiApi, inr } from "../billing/api";
import { printTaxInvoice } from "../billing/printInvoice";

// Every shop's EMI & billing records, read only, for both admin panels.

const S = (path) => `/super${path}`;

// Shop picker shared by the record tabs ("" = every shop)
export function ShopFilter({ value, onChange }) {
  const { data } = useLoad(() => emiApi.get(S("/tenants")), []);
  return (
    <Select
      aria-label="Shop"
      className="w-56"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[{ value: "", label: "All shops" }, ...(data || []).map((t) => ({ value: t._id, label: t.name }))]}
    />
  );
}

const shopCell = (r) => (
  <span className="block max-w-44">
    <span className="block truncate text-fg">{r.tenantName}</span>
    <span className="block truncate text-xs text-fg-muted">{r.storeName}</span>
  </span>
);

function InvoiceDrawer({ id, onClose }) {
  const { data, loading } = useLoad(() => (id ? emiApi.get(S(`/invoices/${id}`)) : Promise.resolve({ data: null })), [id]);
  const inv = data?.invoice;
  return (
    <Drawer
      open={Boolean(id)}
      onOpenChange={(open) => !open && onClose()}
      title={inv ? `Invoice ${inv.invoiceNo}` : "Invoice"}
      description={inv && `${inv.tenantName} · ${inv.storeName} · ${inv.date}`}
      footer={inv && <Button icon={Printer} onClick={() => printTaxInvoice(data)}>Print GST invoice</Button>}
    >
      {loading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        inv && (
          <div className="flex flex-col gap-5">
            <dl className="divide-y divide-line">
              <DetailRow label="Status"><StateBadge status={inv.status} /></DetailRow>
              <DetailRow label="Customer">{inv.customer?.name} · {inv.customer?.phone}</DetailRow>
              <DetailRow label="Payment">{FINANCE_LABELS[inv.financeType]}</DetailRow>
              <DetailRow label="Taxable">{inr(inv.taxable)}</DetailRow>
              <DetailRow label={inv.igst ? "IGST" : "CGST + SGST"}>{inr(inv.igst || inv.cgst + inv.sgst)}</DetailRow>
              <DetailRow label="Total"><strong>{inr(inv.grossTotal)}</strong></DetailRow>
              {inv.cancelReason && <DetailRow label="Cancelled because">{inv.cancelReason}</DetailRow>}
            </dl>
            <section>
              <SectionLabel>Items</SectionLabel>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {inv.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {l.name}
                      {l.imei && <span className="block font-mono text-xs text-fg-muted">IMEI {l.imei}</span>}
                    </span>
                    <span className="tabular-nums">{inr(l.gross)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <SectionLabel>Payments</SectionLabel>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {data.payments.length === 0 && <li className="text-caption text-fg-muted">None at the counter.</li>}
                {data.payments.map((p) => (
                  <li key={p._id} className="flex justify-between gap-3">
                    <span>
                      {p.receiptNo} · {METHOD_LABELS[p.method]}
                    </span>
                    <span className="flex items-center gap-2">
                      <StateBadge status={p.status} />
                      <span className="tabular-nums">{inr(p.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            {data.contract && (
              <section>
                <SectionLabel>Shop EMI</SectionLabel>
                <p className="mt-2 text-sm">
                  {data.contract.contractNo}: {inr(data.contract.emiAmount)} × {data.contract.tenureMonths} at {data.contract.annualRatePct}% · {inr(data.contract.principal - data.contract.paidPrincipal)} principal left · <StateBadge status={data.contract.status} />
                </p>
              </section>
            )}
            {data.nbfcCase && (
              <section>
                <SectionLabel>NBFC</SectionLabel>
                <p className="mt-2 text-sm">
                  {data.nbfcCase.partnerName}: loan {inr(data.nbfcCase.loanAmount)}, payout {inr(data.nbfcCase.expectedPayout)} · <StateBadge status={data.nbfcCase.status} />
                </p>
              </section>
            )}
          </div>
        )
      )}
    </Drawer>
  );
}

export function Invoices() {
  const [shop, setShop] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState(null);
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/invoices"), { tenantId: shop || undefined, status: status || undefined }), [shop, status]);
  const columns = [
    { key: "invoiceNo", header: "Invoice", cell: (r) => <span className="font-medium text-fg">{r.invoiceNo}</span> },
    { key: "tenantName", header: "Shop / store", cell: shopCell },
    { key: "date", header: "Date", hideBelow: "md" },
    { key: "customer", header: "Customer", hideBelow: "sm", sortValue: (r) => r.customer?.name, cell: (r) => r.customer?.name || r.customer?.phone },
    { key: "financeType", header: "Payment", hideBelow: "lg", cell: (r) => FINANCE_LABELS[r.financeType] },
    { key: "grossTotal", header: "Amount", align: "right", cell: (r) => <Money value={r.grossTotal} /> },
    { key: "status", header: "Status", cell: (r) => <StateBadge status={r.status} /> },
  ];
  return (
    <>
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        searchable
        searchPlaceholder="Invoice, shop, customer or IMEI"
        searchText={(r) => [r.invoiceNo, r.tenantName, r.customer?.name, r.customer?.phone, ...(r.lines || []).map((l) => l.imei)].join(" ")}
        toolbar={
          <>
            <ShopFilter value={shop} onChange={setShop} />
            <Select
              aria-label="Status"
              className="w-44"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[{ value: "", label: "Any status" }, ...["PAID", "EMI_ACTIVE", "PENDING_APPROVAL", "NBFC_PENDING", "EMI_CLOSED", "FORECLOSED", "CANCELLED"].map((v) => ({ value: v, label: v.replace(/_/g, " ").toLowerCase() }))]}
            />
          </>
        }
        onRowClick={(r) => setOpenId(r._id)}
        empty={{ icon: FileText, title: "No invoices", description: "Counter sales from every shop appear here." }}
        pageSize={15}
      />
      <InvoiceDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function ContractDrawer({ id, onClose }) {
  const { data, loading } = useLoad(() => (id ? emiApi.get(S(`/emi/${id}`)) : Promise.resolve({ data: null })), [id]);
  const c = data?.contract;
  return (
    <Drawer open={Boolean(id)} onOpenChange={(open) => !open && onClose()} title={c?.contractNo || "EMI contract"} description={c && `${c.tenantName} · ${c.storeName} · ${c.customer?.name || ""}`}>
      {loading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        c && (
          <div className="flex flex-col gap-5">
            <dl className="divide-y divide-line">
              <DetailRow label="Status">{c.status === "ACTIVE" ? <BucketBadge bucket={c.bucket} /> : <StateBadge status={c.status} />}</DetailRow>
              <DetailRow label="EMI">{inr(c.emiAmount)} × {c.tenureMonths} at {c.annualRatePct}%</DetailRow>
              <DetailRow label="Principal paid">{inr(c.paidPrincipal)} of {inr(c.principal)}</DetailRow>
              <DetailRow label="Days past due">{c.currentDpd} (max {c.maxDpd})</DetailRow>
              <DetailRow label="Next due">{c.nextDueDate || "—"}</DetailRow>
            </dl>
            <section>
              <SectionLabel>Schedule</SectionLabel>
              <table className="mt-2 w-full text-sm tabular-nums">
                <tbody>
                  {data.installments.map((i) => (
                    <tr key={i._id} className="border-b border-line">
                      <td className="py-1.5 text-fg-muted">{i.no}</td>
                      <td className="py-1.5">{i.dueDate}</td>
                      <td className="py-1.5 text-right">{inr(i.amountDue)}</td>
                      <td className="py-1.5 text-right">{i.unpaid ? inr(i.unpaid) : "—"}</td>
                      <td className="py-1.5 pl-3"><StateBadge status={i.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <SectionLabel>Receipts</SectionLabel>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {data.payments.length === 0 && <li className="text-caption text-fg-muted">No EMI received yet.</li>}
                {data.payments.map((p) => (
                  <li key={p._id} className="flex justify-between">
                    <span>{p.receiptNo} · {METHOD_LABELS[p.method]} · {formatDateTime(p.createdAt)}</span>
                    <span className="tabular-nums">{inr(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )
      )}
    </Drawer>
  );
}

export function Contracts() {
  const [shop, setShop] = useState("");
  const [view, setView] = useState("active");
  const [openId, setOpenId] = useState(null);
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/emi"), { tenantId: shop || undefined, view }), [shop, view]);
  const columns = [
    { key: "contractNo", header: "Contract", cell: (r) => <span className="font-medium text-fg">{r.contractNo}</span> },
    { key: "tenantName", header: "Shop / store", cell: shopCell },
    { key: "customer", header: "Customer", hideBelow: "sm", sortValue: (r) => r.customer?.name, cell: (r) => r.customer?.name },
    { key: "emiAmount", header: "EMI", align: "right", hideBelow: "md", cell: (r) => <Money value={r.emiAmount} /> },
    { key: "outstandingPrincipal", header: "Principal left", align: "right", cell: (r) => <Money value={r.outstandingPrincipal} whole /> },
    { key: "bucket", header: "DPD", sortValue: (r) => r.currentDpd, cell: (r) => (r.status === "ACTIVE" ? <BucketBadge bucket={r.bucket} /> : <StateBadge status={r.status} />) },
  ];
  return (
    <>
      <Tabs
        variant="pill"
        className="mb-3"
        value={view}
        onChange={setView}
        label="Contract view"
        tabs={[
          { value: "active", label: "Active" },
          { value: "overdue", label: "Overdue" },
          { value: "pending", label: "Awaiting approval" },
          { value: "closed", label: "Closed" },
          { value: "all", label: "All" },
        ]}
      />
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        searchable
        searchPlaceholder="Contract, shop or customer"
        searchText={(r) => [r.contractNo, r.tenantName, r.customer?.name, r.customer?.phone].join(" ")}
        toolbar={<ShopFilter value={shop} onChange={setShop} />}
        onRowClick={(r) => setOpenId(r._id)}
        empty={{ icon: CalendarClock, title: "No EMI contracts here" }}
        pageSize={15}
      />
      <ContractDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

export function Payments() {
  const [shop, setShop] = useState("");
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/payments"), { tenantId: shop || undefined, status: status || undefined }), [shop, status]);
  const columns = [
    { key: "receiptNo", header: "Receipt", cell: (r) => <span className="font-medium text-fg">{r.receiptNo}</span> },
    { key: "tenantName", header: "Shop / store", cell: shopCell },
    { key: "createdAt", header: "When", hideBelow: "md", cell: (r) => formatDateTime(r.createdAt) },
    { key: "purpose", header: "For", hideBelow: "lg", cell: (r) => ({ SALE: "At sale", EMI: "EMI", FORECLOSURE: "Foreclosure" })[r.purpose] },
    { key: "method", header: "Method", cell: (r) => METHOD_LABELS[r.method] },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} /> },
    { key: "status", header: "Status", cell: (r) => <StateBadge status={r.status} /> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={data || []}
      loading={loading && !data}
      error={error?.message}
      onRetry={reload}
      searchable
      searchText={(r) => [r.receiptNo, r.tenantName, r.customer?.name, r.txnRef].join(" ")}
      toolbar={
        <>
          <ShopFilter value={shop} onChange={setShop} />
          <Select
            aria-label="Status"
            className="w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "", label: "Any status" },
              { value: "CAPTURED", label: "Awaiting settlement" },
              { value: "SETTLED", label: "Settled" },
              { value: "REVERSED", label: "Reversed" },
            ]}
          />
        </>
      }
      empty={{ icon: Wallet, title: "No payments" }}
      pageSize={20}
    />
  );
}
