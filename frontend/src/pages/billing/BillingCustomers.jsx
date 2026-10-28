import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MessageSquare, Plus, Trash2, Users } from "lucide-react";
import { Button, DataTable, Drawer, Input, PageHeader, SectionLabel, Select, Skeleton, Tabs, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, ErrorList, KycBadge, Money, StateBadge, useLoad } from "../../features/billing/components";
import { emiApi } from "../../features/billing/api";

const B = "/dashboard/billing";
const DOC_TYPES = [
  { value: "PAN", label: "PAN" },
  { value: "AADHAAR", label: "Aadhaar (last 4 digits)" },
  { value: "VOTER_ID", label: "Voter ID" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVING_LICENCE", label: "Driving licence" },
  { value: "OTHER", label: "Other" },
];

function CustomerDrawer({ id, onClose, onChanged }) {
  const { can } = useBilling();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useLoad(() => (id ? emiApi.get(`/customers/${id}`) : Promise.resolve({ data: null })), [id]);
  const [details, setDetails] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = data?.customer;
    if (!c) return;
    setDetails({ name: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", stateCode: c.stateCode || "", gstin: c.gstin || "" });
    setKyc({ pan: c.pan || "", riskGrade: c.riskGrade || "B", docs: c.kycDocs?.length ? c.kycDocs.map(({ type, number }) => ({ type, number })) : [{ type: "PAN", number: c.pan || "" }] });
  }, [data]);

  const save = async (fn, message) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      toast.success(message);
      reload();
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const c = data?.customer;
  const saveKyc = (kycStatus) =>
    save(
      () =>
        emiApi.patch(`/customers/${id}/kyc`, {
          kycStatus,
          pan: kyc.pan || undefined,
          riskGrade: kyc.riskGrade,
          docs: kyc.docs.filter((d) => d.number.trim().length >= 4),
        }),
      kycStatus === "VERIFIED" ? "KYC verified" : "KYC updated"
    );

  return (
    <Drawer open={Boolean(id)} onOpenChange={(open) => !open && onClose()} title={c?.name || "Customer"} description={c && <KycBadge status={c.kycStatus} />}>
      {loading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        c &&
        details &&
        kyc && (
          <div className="flex flex-col gap-6">
            {data.conversationId && user?.role !== "staff" && (
              <Button as={Link} to={`/dashboard/messages?customer=${c._id}`} variant="secondary" icon={MessageSquare} size="sm" className="self-start">
                Open WhatsApp chat
              </Button>
            )}

            <section className="flex flex-col gap-3">
              <SectionLabel>Details</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} disabled={!can("customer.create")} />
                <Input label="Mobile" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} disabled={!can("customer.create")} />
                <Input label="GST state code" maxLength={2} value={details.stateCode} onChange={(e) => setDetails({ ...details, stateCode: e.target.value.replace(/\D/g, "") })} disabled={!can("customer.create")} />
                <Input label="GSTIN (business buyer)" value={details.gstin} onChange={(e) => setDetails({ ...details, gstin: e.target.value.toUpperCase() })} disabled={!can("customer.create")} />
                <Textarea label="Address" rows={2} className="sm:col-span-2" value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} disabled={!can("customer.create")} />
              </div>
              {can("customer.create") && (
                <Button size="sm" variant="secondary" className="self-start" loading={saving} onClick={() => save(() => emiApi.patch(`/customers/${id}`, details), "Customer saved")}>
                  Save details
                </Button>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionLabel>KYC</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="PAN" maxLength={10} value={kyc.pan} onChange={(e) => setKyc({ ...kyc, pan: e.target.value.toUpperCase() })} disabled={!can("customer.kyc")} />
                <Select label="Risk grade" value={kyc.riskGrade} onChange={(e) => setKyc({ ...kyc, riskGrade: e.target.value })} options={["A", "B", "C", "D"].map((g) => ({ value: g, label: `Grade ${g}` }))} disabled={!can("customer.kyc")} />
              </div>
              {kyc.docs.map((doc, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <Select aria-label="Document type" value={doc.type} onChange={(e) => setKyc({ ...kyc, docs: kyc.docs.map((d, j) => (j === i ? { ...d, type: e.target.value } : d)) })} options={DOC_TYPES} disabled={!can("customer.kyc")} />
                  <Input aria-label="Document number" placeholder="Number" value={doc.number} onChange={(e) => setKyc({ ...kyc, docs: kyc.docs.map((d, j) => (j === i ? { ...d, number: e.target.value } : d)) })} disabled={!can("customer.kyc")} />
                  <Button size="icon" variant="ghost" icon={Trash2} aria-label="Remove document" disabled={!can("customer.kyc")} onClick={() => setKyc({ ...kyc, docs: kyc.docs.filter((_, j) => j !== i) })} />
                </div>
              ))}
              {can("customer.kyc") && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" icon={Plus} onClick={() => setKyc({ ...kyc, docs: [...kyc.docs, { type: "AADHAAR", number: "" }] })}>
                    Add document
                  </Button>
                  <span className="flex-1" />
                  <Button size="sm" variant="danger-ghost" loading={saving} onClick={() => saveKyc("REJECTED")}>
                    Reject
                  </Button>
                  <Button size="sm" icon={BadgeCheck} loading={saving} onClick={() => saveKyc("VERIFIED")}>
                    Mark verified
                  </Button>
                </div>
              )}
            </section>

            {error && <ErrorList error={error} />}

            <section className="flex flex-col gap-2">
              <SectionLabel>Invoices</SectionLabel>
              {data.invoices.length === 0 && <p className="text-caption text-fg-muted">None yet.</p>}
              {data.invoices.map((inv) => (
                <Link key={inv._id} to={`${B}/invoices/${inv._id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <span>
                    {inv.invoiceNo} <span className="text-fg-muted">· {inv.date}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StateBadge status={inv.status} />
                    <Money value={inv.grossTotal} whole />
                  </span>
                </Link>
              ))}
            </section>

            <section className="flex flex-col gap-2">
              <SectionLabel>EMI contracts</SectionLabel>
              {data.contracts.length === 0 && <p className="text-caption text-fg-muted">None.</p>}
              {data.contracts.map((ct) => (
                <Link key={ct._id} to={`${B}/emi/${ct._id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  <span>{ct.contractNo}</span>
                  <span className="flex items-center gap-2">
                    <StateBadge status={ct.status} />
                    <span className="text-caption text-fg-muted">
                      <Money value={ct.principal - ct.paidPrincipal} whole /> left
                    </span>
                  </span>
                </Link>
              ))}
            </section>

            {data.orders.length > 0 && (
              <section className="flex flex-col gap-1">
                <SectionLabel>All orders (WhatsApp, Instagram, store)</SectionLabel>
                <p className="text-caption text-fg-muted">
                  {data.orders.length} order{data.orders.length === 1 ? "" : "s"} · {c.totalOrders} in total · ₹{Math.round(c.totalSpent || 0).toLocaleString("en-IN")} spent
                </p>
              </section>
            )}
          </div>
        )
      )}
    </Drawer>
  );
}

function List() {
  const [kycFilter, setKycFilter] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/customers", { q: term || undefined, kyc: kycFilter || undefined, limit: 200 }), [term, kycFilter]);

  const columns = [
    { key: "name", header: "Customer", cell: (r) => <span className="font-medium text-fg">{r.name}</span> },
    { key: "phone", header: "Mobile", hideBelow: "sm" },
    { key: "pan", header: "PAN", hideBelow: "md", cell: (r) => r.pan || <span className="text-fg-muted">—</span> },
    { key: "kycStatus", header: "KYC", cell: (r) => <KycBadge status={r.kycStatus} /> },
    { key: "riskGrade", header: "Risk", hideBelow: "lg", cell: (r) => r.riskGrade || "—" },
    { key: "totalSpent", header: "Spent", align: "right", hideBelow: "md", cell: (r) => `₹${Math.round(r.totalSpent || 0).toLocaleString("en-IN")}` },
  ];

  return (
    <>
      <PageHeader title="Customer KYC" description="Verify PAN and documents before EMI or NBFC finance. WhatsApp customers are here too." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          variant="pill"
          value={kycFilter}
          onChange={setKycFilter}
          label="KYC status"
          tabs={[
            { value: "", label: "All" },
            { value: "VERIFIED", label: "Verified" },
            { value: "PENDING", label: "Pending" },
            { value: "NONE", label: "No KYC" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
        <Input aria-label="Search customers" placeholder="Name, mobile or PAN" value={q} onChange={(e) => setQ(e.target.value)} className="sm:w-72" />
      </div>
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        onRowClick={(r) => setOpenId(r._id)}
        empty={{ icon: Users, title: "No customers found", description: "Customers are added from New sale, or arrive from WhatsApp." }}
        pageSize={15}
      />
      <CustomerDrawer id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
    </>
  );
}

export default function BillingCustomers() {
  return (
    <BillingGate perm="customer.read">
      <List />
    </BillingGate>
  );
}
