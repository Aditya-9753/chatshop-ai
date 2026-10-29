import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, KeyRound, Pencil, Plus, Store as StoreIcon, UserPlus, Users } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DataTable,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
} from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api.service";
import { formatDateTime } from "../../utils/format";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, ErrorList, StateBadge, useLoad } from "../../features/billing/components";
import { emiApi, fromPaise, inr, toPaise } from "../../features/billing/api";

const ROLE_OPTIONS = [
  { value: "STORE_ADMIN", label: "Store Admin" },
  { value: "CASHIER", label: "Cashier" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "AGENT", label: "Collection agent" },
];
const roleLabel = (r) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r;

function useSaver() {
  const toast = useToast();
  const [state, setState] = useState({ saving: false, error: null });
  const run = async (fn, message) => {
    setState({ saving: true, error: null });
    try {
      const res = await fn();
      toast.success(message);
      setState({ saving: false, error: null });
      return res;
    } catch (error) {
      setState({ saving: false, error });
      return null;
    }
  };
  return { ...state, run };
}

// ---------- Shop details (printed on invoices) ----------

function ShopTab() {
  const { tenant, can, reload } = useBilling();
  const [form, setForm] = useState({ name: tenant.name || "", legalName: tenant.legalName || "", gstin: tenant.gstin || "", stateCode: tenant.stateCode || "", address: tenant.address || "", phone: tenant.phone || "" });
  const saver = useSaver();
  const editable = can("settings.tenant");
  return (
    <Card>
      <CardHeader title="Shop details" description="Printed at the top of every GST invoice" />
      <CardBody className="grid gap-3 sm:grid-cols-2">
        <Input label="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!editable} />
        <Input label="Legal name" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} disabled={!editable} />
        <Input label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} maxLength={15} disabled={!editable} />
        <Input label="GST state code" value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.replace(/\D/g, "") })} maxLength={2} disabled={!editable} />
        <Textarea label="Address" rows={2} className="sm:col-span-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!editable} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!editable} />
        {saver.error && <ErrorList error={saver.error} className="sm:col-span-2" />}
        {editable && (
          <div className="sm:col-span-2">
            <Button loading={saver.saving} onClick={async () => (await saver.run(() => emiApi.put("/tenant", { ...form, gstin: form.gstin || "" }), "Shop details saved")) && reload()}>
              Save
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------- Stores ----------

function StoreModal({ store, onClose, onDone }) {
  const [form, setForm] = useState(store ? { name: store.name, stateCode: store.stateCode, invoicePrefix: store.invoicePrefix, address: store.address || "", phone: store.phone || "", gstin: store.gstin || "", active: store.active !== false } : { name: "", stateCode: "", invoicePrefix: "", address: "", phone: "", gstin: "", active: true });
  const saver = useSaver();
  const submit = async () => {
    const body = store ? { name: form.name, stateCode: form.stateCode, address: form.address, phone: form.phone, gstin: form.gstin, active: form.active } : form;
    const res = await saver.run(() => (store ? emiApi.patch(`/stores/${store._id}`, body) : emiApi.post("/stores", body)), store ? "Store saved" : "Store added");
    if (res) {
      onClose();
      onDone();
    }
  };
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={store ? `Edit ${store.name}` : "Add store"} description="Each store has its own invoice and receipt series." footer={<Button loading={saver.saving} onClick={submit}>{store ? "Save" : "Add store"}</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Store name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="sm:col-span-2" />
        <Input label="Invoice prefix" required hint={store ? "Cannot change after the first invoice" : "2–6 letters, e.g. BPL"} value={form.invoicePrefix} disabled={Boolean(store)} maxLength={6} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
        <Input label="GST state code" required maxLength={2} value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.replace(/\D/g, "") })} />
        <Input label="GSTIN (if different)" maxLength={15} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Textarea label="Address" rows={2} className="sm:col-span-2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        {store && <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} label="Store is open" description="Closed stores cannot bill." />}
        {saver.error && <ErrorList error={saver.error} className="sm:col-span-2" />}
      </div>
    </Modal>
  );
}

function StoresTab() {
  const { allStores, can, reload } = useBilling();
  const [editing, setEditing] = useState(null);
  return (
    <Card>
      <CardHeader title="Stores" description="Branches of this shop" action={can("store.manage") && <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>Add store</Button>} />
      <ul className="divide-y divide-line border-t border-line">
        {allStores.map((s) => (
          <li key={s._id} className="flex items-center gap-3 px-5 py-3">
            <StoreIcon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-fg">{s.name}</span>
              <span className="block text-caption text-fg-muted">
                Prefix {s.invoicePrefix} · state {s.stateCode}
                {s.address ? ` · ${s.address}` : ""}
              </span>
            </span>
            {s.active === false && <Badge tone="neutral">Closed</Badge>}
            {can("store.manage") && <Button size="icon-sm" variant="ghost" icon={Pencil} aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)} />}
          </li>
        ))}
      </ul>
      {editing && <StoreModal store={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={reload} />}
    </Card>
  );
}

// ---------- Staff ----------

function StaffModal({ member, onClose, onDone }) {
  const { allStores, isOwner } = useBilling();
  const [form, setForm] = useState({
    name: member?.name || "",
    email: member?.email || "",
    phone: member?.phone || "",
    password: "",
    roles: member?.emiRoles?.length ? member.emiRoles.map((r) => ({ role: r.role, storeId: r.storeId || "" })) : [{ role: "CASHIER", storeId: allStores[0]?._id || "" }],
  });
  const saver = useSaver();
  const roles = form.roles.map((r) => ({ role: r.role, storeId: r.storeId || null }));
  const submit = async () => {
    const res = await saver.run(
      () =>
        member
          ? emiApi.patch(`/users/${member._id}`, { name: form.name, phone: form.phone || undefined, roles, ...(form.password ? { password: form.password } : {}) })
          : emiApi.post("/users", { ...form, phone: form.phone || undefined, roles }),
      member ? "Staff updated" : "Staff added. They can sign in once the Super Admin approves them."
    );
    if (res) {
      onClose();
      onDone();
    }
  };
  const storeOptions = [...(isOwner ? [{ value: "", label: "All stores" }] : []), ...allStores.map((s) => ({ value: s._id, label: s.name }))];
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={member ? `Edit ${member.name}` : "Add staff"} description={member ? "Staff sign in at the normal login page and only see EMI & billing." : "The Super Admin approves new staff; after that they sign in at the normal login page and only see EMI & billing."} footer={<Button loading={saver.saving} onClick={submit}>{member ? "Save" : "Add staff"}</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Email (login)" required type="email" disabled={Boolean(member)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label={member ? "New password (optional)" : "Password"} required={!member} type="password" hint="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-caption font-medium text-fg">Roles</p>
          {form.roles.map((r, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <Select aria-label="Role" value={r.role} onChange={(e) => setForm({ ...form, roles: form.roles.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} options={ROLE_OPTIONS.filter((o) => isOwner || o.value !== "STORE_ADMIN")} />
              <Select aria-label="Store" value={r.storeId} onChange={(e) => setForm({ ...form, roles: form.roles.map((x, j) => (j === i ? { ...x, storeId: e.target.value } : x)) })} options={storeOptions} />
              <Button size="icon" variant="ghost" aria-label="Remove role" disabled={form.roles.length === 1} onClick={() => setForm({ ...form, roles: form.roles.filter((_, j) => j !== i) })}>
                ×
              </Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setForm({ ...form, roles: [...form.roles, { role: "CASHIER", storeId: allStores[0]?._id || "" }] })}>
            Add role
          </Button>
        </div>
        {saver.error && <ErrorList error={saver.error} className="sm:col-span-2" />}
      </div>
    </Modal>
  );
}

function StaffTab() {
  const { can, allStores } = useBilling();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/users"), []);
  const [editing, setEditing] = useState(null);
  const storeName = (id) => (id ? allStores.find((s) => s._id === id)?.name || "Store" : "All stores");

  const toggle = async (m) => {
    try {
      await emiApi.patch(`/users/${m._id}`, { staffActive: !m.staffActive });
      toast.success(m.staffActive ? `${m.name} switched off and signed out` : `${m.name} can sign in again`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: "name", header: "Name", cell: (r) => (
      <span>
        <span className="block font-medium text-fg">{r.name}</span>
        <span className="block text-xs text-fg-muted">{r.email}</span>
      </span>
    ) },
    { key: "roles", header: "Roles", sortable: false, cell: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.emiRoles.map((role, i) => (
          <Badge key={i} tone="neutral">
            {roleLabel(role.role)} · {storeName(role.storeId)}
          </Badge>
        ))}
      </span>
    ) },
    {
      key: "approvalStatus",
      header: "Approval",
      cell: (r) => (
        <span>
          <StateBadge status={r.approvalStatus || "APPROVED"} label={{ PENDING: "Waiting for Super Admin", APPROVED: "Approved", REJECTED: "Not approved" }[r.approvalStatus || "APPROVED"]} />
          {r.approvalStatus === "REJECTED" && r.approvalNote && <span className="mt-0.5 block text-xs text-fg-muted">{r.approvalNote}</span>}
        </span>
      ),
    },
    { key: "staffActive", header: "Sign-in", cell: (r) => (can("user.manage") ? <Switch checked={r.staffActive} onCheckedChange={() => toggle(r)} label={r.staffActive ? "On" : "Off"} /> : r.staffActive ? "On" : "Off") },
    { key: "edit", header: "", sortable: false, cell: (r) => can("user.manage") && <Button size="icon-sm" variant="ghost" icon={Pencil} aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)} /> },
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        {can("user.manage") && (
          <Button icon={UserPlus} onClick={() => setEditing("new")}>
            Add staff
          </Button>
        )}
      </div>
      <DataTable columns={columns} rows={data || []} loading={loading && !data} error={error?.message} onRetry={reload} empty={{ icon: Users, title: "No staff yet", description: "Add cashiers, accountants and collection agents. Each gets their own login." }} />
      {editing && <StaffModal member={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={reload} />}
    </>
  );
}

// ---------- EMI rules ----------

function RulesTab() {
  const { can, allStores } = useBilling();
  const [scope, setScope] = useState("TENANT"); // or a store id
  const storeId = scope === "TENANT" ? null : scope;
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/settings/effective", { storeId: storeId || undefined }), [storeId]);
  const [form, setForm] = useState(null);
  const saver = useSaver();
  const editable = scope === "TENANT" ? can("settings.tenant") : can("settings.store");

  useEffect(() => {
    if (!data) return;
    const e = data.effective;
    setForm({
      defaultRatePct: String(e.emi.defaultRatePct),
      allowedTenures: e.emi.allowedTenures,
      maxPrincipal: String(fromPaise(e.emi.maxPrincipal)),
      approvalAbove: String(fromPaise(e.emi.approvalAbove)),
      minDownPaymentPct: String(e.emi.minDownPaymentPct),
      graceDays: String(e.lateFee.graceDays),
      lateType: e.lateFee.type,
      flat: String(fromPaise(e.lateFee.flat)),
      pct: String(e.lateFee.pct),
      cap: String(fromPaise(e.lateFee.cap)),
      credit: String(e.mdrPct.credit),
      debit: String(e.mdrPct.debit),
      upi: String(e.mdrPct.upi),
      remindersEnabled: e.reminders.enabled,
      daysBefore: String(e.reminders.daysBefore),
      channel: e.reminders.channel,
    });
  }, [data]);

  if (error) return <ErrorList error={error} />;
  if (loading || !form) return <Skeleton className="h-96 w-full" />;
  const p = data.platform;
  const num = (v) => Number(v);
  const save = async () => {
    const patch = {
      emi: { defaultRatePct: num(form.defaultRatePct), allowedTenures: [...form.allowedTenures].sort((a, b) => a - b), maxPrincipal: toPaise(form.maxPrincipal), approvalAbove: toPaise(form.approvalAbove), minDownPaymentPct: num(form.minDownPaymentPct) },
      lateFee: { graceDays: num(form.graceDays), type: form.lateType, flat: toPaise(form.flat), pct: num(form.pct), cap: toPaise(form.cap) },
      mdrPct: { credit: num(form.credit), debit: num(form.debit), upi: num(form.upi) },
      reminders: { enabled: form.remindersEnabled, daysBefore: num(form.daysBefore), channel: form.channel },
    };
    const res = await saver.run(() => (storeId ? emiApi.put(`/settings/store/${storeId}`, patch) : emiApi.put("/settings/tenant", patch)), "EMI rules saved");
    if (res) reload();
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value.replace(/[^\d.]/g, "") });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Rules for"
          className="w-64"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          options={[{ value: "TENANT", label: "Whole shop" }, ...allStores.map((s) => ({ value: s._id, label: `${s.name} only` }))]}
        />
        {storeId && editable && Object.keys(data.storeOverride || {}).length > 0 && (
          <Button variant="ghost" onClick={async () => (await saver.run(() => emiApi.del(`/settings/store/${storeId}`), "Store now follows the shop's rules")) && reload()}>
            Use shop rules for this store
          </Button>
        )}
      </div>
      <Alert tone="info">
        Set by the platform (Super Admin): rate {p.emi.minRatePct}%–{p.emi.maxRatePct}%, tenures {p.emi.allowedTenures.join(", ")} months, EMI up to {inr(p.emi.maxPrincipal, { whole: true })}, cash below {inr(p.cashLimitPerTxn, { whole: true })} per sale, KYC above {inr(p.kycRequiredAbove, { whole: true })}, foreclosure charge {p.emi.foreclosureChargePct}%, interest GST {p.gst.interestMode.replace(/_/g, " ").toLowerCase()}.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Shop EMI" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Input label="Default rate (% p.a.)" value={form.defaultRatePct} onChange={set("defaultRatePct")} disabled={!editable} />
            <Input label="Min down payment (%)" value={form.minDownPaymentPct} onChange={set("minDownPaymentPct")} disabled={!editable} />
            <Input label="Max EMI amount (₹)" value={form.maxPrincipal} onChange={set("maxPrincipal")} disabled={!editable} />
            <Input label="Needs approval above (₹)" value={form.approvalAbove} onChange={set("approvalAbove")} disabled={!editable} />
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-caption font-medium text-fg">Tenures offered</p>
              <div className="flex flex-wrap gap-4">
                {p.emi.allowedTenures.map((t) => (
                  <Checkbox
                    key={t}
                    label={`${t} months`}
                    disabled={!editable}
                    checked={form.allowedTenures.includes(t)}
                    onCheckedChange={(v) => setForm({ ...form, allowedTenures: v ? [...form.allowedTenures, t] : form.allowedTenures.filter((x) => x !== t) })}
                  />
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Late fee" description="Charged once per installment after the grace days" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Input label="Grace days" value={form.graceDays} onChange={set("graceDays")} disabled={!editable} />
            <Select label="Type" value={form.lateType} onChange={(e) => setForm({ ...form, lateType: e.target.value })} options={[{ value: "FLAT", label: "Flat amount" }, { value: "PERCENT", label: "% of overdue" }]} disabled={!editable} />
            {form.lateType === "FLAT" ? (
              <Input label="Flat fee (₹)" value={form.flat} onChange={set("flat")} disabled={!editable} />
            ) : (
              <Input label="Fee (%)" value={form.pct} onChange={set("pct")} disabled={!editable} />
            )}
            <Input label="Cap (₹)" value={form.cap} onChange={set("cap")} disabled={!editable} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Card & UPI fees (MDR)" description="What the gateway keeps; 18% GST is added on the fee" />
          <CardBody className="grid gap-3 sm:grid-cols-3">
            <Input label="Credit card %" value={form.credit} onChange={set("credit")} disabled={!editable} />
            <Input label="Debit card %" value={form.debit} onChange={set("debit")} disabled={!editable} />
            <Input label="UPI %" value={form.upi} onChange={set("upi")} disabled={!editable} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reminders" description="Sent from your WhatsApp; they show in the inbox" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Switch checked={form.remindersEnabled} onCheckedChange={(v) => setForm({ ...form, remindersEnabled: v })} label="Send EMI reminders" disabled={!editable} />
            </div>
            <Input label="Days before due" value={form.daysBefore} onChange={set("daysBefore")} disabled={!editable} />
            <Select label="Channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} options={[{ value: "WHATSAPP", label: "WhatsApp" }, { value: "SMS", label: "SMS (no provider yet)" }]} disabled={!editable} />
          </CardBody>
        </Card>
      </div>

      {saver.error && <ErrorList error={saver.error} />}
      {editable && (
        <div>
          <Button loading={saver.saving} onClick={save}>
            Save rules
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Reminder log ----------

function RemindersTab() {
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/notifications"), []);
  const columns = [
    { key: "createdAt", header: "Queued", cell: (r) => formatDateTime(r.createdAt) },
    { key: "customer", header: "Customer", sortValue: (r) => r.customer?.name, cell: (r) => r.customer?.name },
    { key: "template", header: "Message", cell: (r) => r.template.replace(/_/g, " ").toLowerCase() },
    { key: "status", header: "Status", cell: (r) => (
      <span>
        <StateBadge status={r.status} />
        {r.error && <span className="mt-0.5 block text-xs text-fg-muted">{r.error}</span>}
      </span>
    ) },
  ];
  return <DataTable columns={columns} rows={data || []} loading={loading && !data} error={error?.message} onRetry={reload} empty={{ icon: Bell, title: "No reminders yet", description: "The daily job queues reminders before due dates and when EMIs go overdue." }} pageSize={20} />;
}

// ---------- My account (staff) ----------

function AccountTab() {
  const { user } = useAuth();
  const { roles, tenant } = useBilling();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const saver = useSaver();
  return (
    <Card className="max-w-lg">
      <CardHeader title={user?.name} description={`${user?.email} · ${roles.map((r) => r.label).join(", ")} at ${tenant?.name}`} />
      <CardBody className="flex flex-col gap-3">
        <Input label="Current password" type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <Input label="New password" type="password" hint="At least 8 characters" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        {saver.error && <ErrorList error={saver.error} />}
        <Button icon={KeyRound} className="self-start" loading={saver.saving} disabled={form.newPassword.length < 8 || !form.currentPassword} onClick={async () => (await saver.run(() => api.put("/users/password", form), "Password changed")) && setForm({ currentPassword: "", newPassword: "" })}>
          Change password
        </Button>
      </CardBody>
    </Card>
  );
}

function Page() {
  const { can } = useBilling();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = [
    can("settings.read") && { value: "shop", label: "Shop" },
    can("store.read") && { value: "stores", label: "Stores" },
    can("user.read") && { value: "staff", label: "Staff" },
    can("settings.read") && { value: "rules", label: "EMI rules" },
    can("report.store") && { value: "reminders", label: "Reminders" },
    user?.role === "staff" && { value: "account", label: "My account" },
  ].filter(Boolean);
  const tab = tabs.find((t) => t.value === params.get("tab"))?.value || tabs[0]?.value;

  return (
    <>
      <PageHeader title="Billing settings" description="Shop details, stores, staff and the EMI rules" />
      <Tabs className="mb-5" tabs={tabs} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} label="Settings sections" />
      {tab === "shop" && <ShopTab />}
      {tab === "stores" && <StoresTab />}
      {tab === "staff" && <StaffTab />}
      {tab === "rules" && <RulesTab />}
      {tab === "reminders" && <RemindersTab />}
      {tab === "account" && <AccountTab />}
    </>
  );
}

// Staff without settings access still reach "My account" here
export default function BillingSettings() {
  return (
    <BillingGate>
      <Page />
    </BillingGate>
  );
}
