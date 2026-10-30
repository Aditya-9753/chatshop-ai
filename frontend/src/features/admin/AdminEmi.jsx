import React, { useEffect, useState } from "react";
import { AlertTriangle, Building2, Play, Send, ShieldAlert } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  Tabs,
  Textarea,
} from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { Invoices, Contracts, Payments } from "./AdminEmiRecords";
import { Requests, Staff } from "./AdminEmiAccess";
import { formatDateTime } from "../../utils/format";
import { ErrorList, StateBadge, useLoad } from "../billing/components";
import { emiApi, fromPaise, inr, toPaise } from "../billing/api";

const S = (path) => `/super${path}`;

function Overview() {
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/dashboard")), []);
  if (error) return <ErrorState description={error.message} onRetry={reload} />;
  const d = data;
  return (
    <>
    {d?.pendingRequests > 0 && (
      <Alert tone="warning" className="mb-4" title={`${d.pendingRequests} request${d.pendingRequests === 1 ? "" : "s"} waiting for approval`}>
        Shops asking for EMI & billing and new staff are in the Requests tab.
      </Alert>
    )}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Shops using billing" loading={loading} value={d ? d.tenants.active : "—"} deltaNote={d && `${d.tenants.suspended} suspended · ${d.stores} store${d.stores === 1 ? "" : "s"}`} />
      <StatCard label="Billed, last 30 days" loading={loading} value={d ? inr(d.gmv30d.gross, { whole: true }) : "—"} deltaNote={d && `${d.gmv30d.invoices} invoices`} />
      <StatCard label="EMI book outstanding" loading={loading} value={d ? inr(d.emiBook.outstanding, { whole: true }) : "—"} deltaNote={d && `${d.emiBook.contracts} contracts · ${d.emiBook.overduePct}% overdue`} />
      <StatCard label="Overdue EMI contracts" loading={loading} value={d ? d.emiBook.overdueContracts : "—"} deltaNote={d && `${d.failedReminders} failed reminder${d.failedReminders === 1 ? "" : "s"}`} />
    </div>
    </>
  );
}

function Tenants() {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/tenants")), []);
  const [suspending, setSuspending] = useState(null);
  const [reason, setReason] = useState("");

  const setStatus = async (tenant, status, why) => {
    try {
      await emiApi.patch(S(`/tenants/${tenant._id}`), { status, reason: why });
      toast.success(status === "SUSPENDED" ? `${tenant.name} suspended` : `${tenant.name} active again`);
      setSuspending(null);
      setReason("");
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: "name", header: "Shop", cell: (r) => (
      <span>
        <span className="block font-medium text-fg">{r.name}</span>
        <span className="block text-xs text-fg-muted">{r.owner?.email}{r.gstin ? ` · ${r.gstin}` : ""}</span>
      </span>
    ) },
    { key: "stores", header: "Stores", align: "right", hideBelow: "md" },
    { key: "gross", header: "Billed", align: "right", cell: (r) => inr(r.gross, { whole: true }) },
    { key: "outstanding", header: "EMI book", align: "right", hideBelow: "sm", cell: (r) => inr(r.outstanding, { whole: true }) },
    { key: "overdueContracts", header: "Overdue", align: "right", hideBelow: "lg", cell: (r) => (r.overdueContracts ? <Badge tone="danger">{r.overdueContracts}</Badge> : "—") },
    { key: "status", header: "Status", cell: (r) => <StateBadge status={r.status} label={r.status === "ACTIVE" ? "Active" : undefined} /> },
    {
      key: "action",
      header: "",
      sortable: false,
      cell: (r) =>
        r.status === "ACTIVE" ? (
          <Button size="sm" variant="danger-ghost" onClick={() => setSuspending(r)}>
            Suspend
          </Button>
        ) : (
          <Button size="sm" variant={r.status === "SUSPENDED" ? "secondary" : "primary"} onClick={() => setStatus(r, "ACTIVE")}>
            {r.status === "SUSPENDED" ? "Reactivate" : "Approve"}
          </Button>
        ),
    },
  ].filter((c) => isSuperAdmin || c.key !== "action");

  return (
    <>
      <DataTable columns={columns} rows={data || []} loading={loading && !data} error={error?.message} onRetry={reload} searchable searchText={(r) => `${r.name} ${r.owner?.email} ${r.gstin}`} searchPlaceholder="Shop, email or GSTIN" empty={{ icon: Building2, title: "No shops use billing yet", description: "A shop appears here the first time it opens EMI & billing." }} />
      <Modal
        open={Boolean(suspending)}
        onOpenChange={(open) => !open && setSuspending(null)}
        title={`Suspend ${suspending?.name}?`}
        description="The shop and its staff lose access to EMI & billing until reactivated. Their data stays."
        size="sm"
        footer={
          <Button variant="danger" disabled={reason.trim().length < 3} onClick={() => setStatus(suspending, "SUSPENDED", reason)}>
            Suspend
          </Button>
        }
      >
        <Textarea label="Reason (shown to the shop)" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}

function PlatformRules() {
  const toast = useToast();
  const canEdit = useAuth().isSuperAdmin;
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/settings")), []);
  const [form, setForm] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    const e = data.effective;
    setForm({
      interestMode: e.gst.interestMode,
      interestTiming: e.gst.interestTiming,
      cashLimit: String(fromPaise(e.cashLimitPerTxn)),
      kycAbove: String(fromPaise(e.kycRequiredAbove)),
      minRate: String(e.emi.minRatePct),
      maxRate: String(e.emi.maxRatePct),
      defaultRate: String(e.emi.defaultRatePct),
      tenures: e.emi.allowedTenures.join(", "),
      maxPrincipal: String(fromPaise(e.emi.maxPrincipal)),
      approvalAbove: String(fromPaise(e.emi.approvalAbove)),
      foreclosure: String(e.emi.foreclosureChargePct),
    });
  }, [data]);

  if (error) return <ErrorState description={error.message} onRetry={reload} />;
  if (loading || !form) return <Skeleton className="h-80 w-full" />;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await emiApi.put(S("/settings"), {
        gst: { interestMode: form.interestMode, interestTiming: form.interestTiming },
        cashLimitPerTxn: toPaise(form.cashLimit),
        kycRequiredAbove: toPaise(form.kycAbove),
        emi: {
          minRatePct: Number(form.minRate),
          maxRatePct: Number(form.maxRate),
          defaultRatePct: Number(form.defaultRate),
          allowedTenures: form.tenures.split(/[\s,]+/).filter(Boolean).map(Number),
          maxPrincipal: toPaise(form.maxPrincipal),
          approvalAbove: toPaise(form.approvalAbove),
          foreclosureChargePct: Number(form.foreclosure),
        },
      });
      toast.success("Platform rules saved");
      reload();
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert tone={canEdit ? "warning" : "info"} title={canEdit ? "These apply to every shop" : "View only"}>
        {canEdit
          ? "Shops can change their own rate, tenures, limits, late fees and card fees only inside these ranges. Interest GST changes apply to new EMIs only."
          : "Only the Super Admin can change platform rules."}
      </Alert>
      {/* A disabled fieldset makes every control inside read only */}
      <fieldset disabled={!canEdit} className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="GST on EMI interest" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Select label="Mode" value={form.interestMode} onChange={set("interestMode")} options={[{ value: "TAXABLE_INCLUSIVE", label: "Included in interest" }, { value: "TAXABLE_EXCLUSIVE", label: "Added on top" }, { value: "EXEMPT", label: "Exempt" }]} />
            <Select label="When booked" value={form.interestTiming} onChange={set("interestTiming")} options={[{ value: "PER_INSTALLMENT", label: "With each EMI" }, { value: "UPFRONT", label: "All at the sale" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Compliance limits" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Input label="Cash per sale below (₹)" value={form.cashLimit} onChange={set("cashLimit")} hint="Income Tax 269ST: ₹2,00,000" />
            <Input label="KYC needed above (₹)" value={form.kycAbove} onChange={set("kycAbove")} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Shop EMI ranges" />
          <CardBody className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Input label="Min rate %" value={form.minRate} onChange={set("minRate")} />
            <Input label="Max rate %" value={form.maxRate} onChange={set("maxRate")} />
            <Input label="Default rate %" value={form.defaultRate} onChange={set("defaultRate")} />
            <Input label="Tenures (months)" value={form.tenures} onChange={set("tenures")} hint="Comma separated" />
            <Input label="Max EMI amount (₹)" value={form.maxPrincipal} onChange={set("maxPrincipal")} />
            <Input label="Approval above (₹)" value={form.approvalAbove} onChange={set("approvalAbove")} />
            <Input label="Foreclosure charge %" value={form.foreclosure} onChange={set("foreclosure")} />
          </CardBody>
        </Card>
      </fieldset>
      {saveError && <ErrorList error={saveError} />}
      {canEdit && (
        <div>
          <Button loading={saving} onClick={save}>
            Save platform rules
          </Button>
        </div>
      )}
    </div>
  );
}

function Risk() {
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/risk/multi-store-customers")), []);
  if (error) return <ErrorState description={error.message} onRetry={reload} />;
  if (loading && !data) return <Skeleton className="h-40 w-full" />;
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="info">Borrowers with live EMIs at more than one store, matched by PAN or mobile number. Several loans at once is a stacking risk.</Alert>
      {data.length === 0 ? (
        <Card className="p-6 text-center text-caption text-fg-muted">No borrower has live EMIs at more than one store.</Card>
      ) : (
        data.map((g) => (
          <Card key={g.key}>
            <CardHeader
              title={g.key}
              description={`${g.stores} stores · ${inr(g.outstanding, { whole: true })} outstanding · max ${g.maxDpd} days past due`}
              action={g.maxDpd > 30 ? <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> High risk</Badge> : <Badge tone="warning">Watch</Badge>}
            />
            <ul className="divide-y divide-line border-t border-line text-sm">
              {g.contracts.map((c) => (
                <li key={c.contractNo} className="flex flex-wrap justify-between gap-2 px-5 py-2">
                  <span>
                    {c.customer} · {c.tenant} / {c.store}
                  </span>
                  <span className="tabular-nums text-fg-muted">
                    {c.contractNo} · {inr(c.outstanding, { whole: true })} · {c.dpd}d
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

function Audit() {
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/audit"), { limit: 300 }), []);
  const columns = [
    { key: "createdAt", header: "When", cell: (r) => formatDateTime(r.createdAt) },
    { key: "actorEmail", header: "Who", hideBelow: "sm" },
    { key: "action", header: "Action", cell: (r) => <span className="font-mono text-xs">{r.action}</span> },
    { key: "entity", header: "Record", hideBelow: "md", cell: (r) => (r.entity ? `${r.entity}${r.entityId ? ` …${String(r.entityId).slice(-6)}` : ""}` : "—") },
    { key: "reason", header: "Reason / details", hideBelow: "lg", cell: (r) => <span className="block max-w-72 truncate">{r.reason || r.details || "—"}</span> },
  ];
  return <DataTable columns={columns} rows={data || []} loading={loading && !data} error={error?.message} onRetry={reload} searchable searchText={(r) => `${r.action} ${r.actorEmail} ${r.reason || ""} ${r.details || ""}`} searchPlaceholder="Action, person or reason" empty={{ icon: ShieldAlert, title: "No EMI activity yet" }} pageSize={20} />;
}

function Jobs() {
  const toast = useToast();
  const [asOf, setAsOf] = useState("");
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);
  const run = async (kind) => {
    setRunning(kind);
    try {
      const res = kind === "overdue" ? await emiApi.post(S("/jobs/overdue/run"), asOf ? { asOf } : {}) : await emiApi.post(S("/jobs/notifications/run"), {});
      setResult({ kind, data: res.data });
      toast.success("Done");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRunning(null);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Overdue job" description="Runs by itself every day at 9:00 IST. Safe to run again: late fees are charged only once." />
        <CardBody className="flex flex-wrap items-end gap-3">
          <Input type="date" label="As of (optional)" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-48" />
          <Button icon={Play} loading={running === "overdue"} onClick={() => run("overdue")}>
            Run now
          </Button>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="WhatsApp reminders" description="Queued reminders go out every 5 minutes through each shop's WhatsApp." />
        <CardBody>
          <Button icon={Send} variant="secondary" loading={running === "notify"} onClick={() => run("notify")}>
            Send queued now
          </Button>
        </CardBody>
      </Card>
      {result && (
        <Card className="lg:col-span-2 p-4">
          <pre className="overflow-x-auto font-mono text-xs text-fg">{JSON.stringify(result.data, null, 2)}</pre>
        </Card>
      )}
    </div>
  );
}

// Both admin panels see every tab except Audit and Jobs (Super Admin only,
// like the rest of the admin panel); changes are Super Admin only too.
const TABS = [
  { value: "overview", label: "Overview", component: Overview },
  { value: "requests", label: "Requests", component: Requests },
  { value: "tenants", label: "Shops", component: Tenants },
  { value: "staff", label: "Staff", component: Staff },
  { value: "invoices", label: "Invoices", component: Invoices },
  { value: "contracts", label: "EMI contracts", component: Contracts },
  { value: "payments", label: "Payments", component: Payments },
  { value: "risk", label: "Risk", component: Risk },
  { value: "rules", label: "Platform rules", component: PlatformRules },
  { value: "audit", label: "Audit", component: Audit, superOnly: true },
  { value: "jobs", label: "Jobs", component: Jobs, superOnly: true },
];

export default function AdminEmi() {
  const { isSuperAdmin } = useAuth();
  const tabs = TABS.filter((t) => isSuperAdmin || !t.superOnly);
  const [tab, setTab] = useState("overview");
  const Current = (tabs.find((t) => t.value === tab) || tabs[0]).component;
  return (
    <>
      <PageHeader title="EMI & Billing" description={`Counter sales and Shop EMI across every shop${isSuperAdmin ? "" : " (view only)"}`} />
      <Tabs className="mb-5" tabs={tabs} value={tab} onChange={setTab} label="EMI sections" />
      <Current />
    </>
  );
}
