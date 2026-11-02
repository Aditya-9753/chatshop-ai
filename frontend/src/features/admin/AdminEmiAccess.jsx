import React, { useEffect, useState } from "react";
import { Building2, Check, Plus, UserPlus, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Input, Modal, Select, Skeleton, Switch, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { formatDateTime } from "../../utils/format";
import { ErrorList, StateBadge, useLoad } from "../billing/components";
import { emiApi } from "../billing/api";
import { ShopFilter } from "./AdminEmiRecords";

// Who may use EMI & billing: shops wait for the Super Admin; staff are
// approved by their own shop owner.
// The limited Admin panel sees the same lists, without the buttons.

const S = (path) => `/super${path}`;
const ROLE_LABELS = { STORE_ADMIN: "Store Admin", CASHIER: "Cashier", ACCOUNTANT: "Accountant", AGENT: "Collection agent" };

const rolesText = (u) => (u.emiRoles || []).map((r) => `${r.roleName || ROLE_LABELS[r.role] || r.role} · ${r.storeName}`).join(", ");

// Approve right away; a rejection asks for the reason the shop will see
function DecideModal({ target, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await emiApi.patch(S(`/tenants/${target.row._id}`), { status: "REJECTED", reason: note });
      toast.success("Rejected");
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
      title={`Reject ${target.row.name}?`}
      description="The shop sees this reason instead of EMI & billing."
      size="sm"
      footer={
        <Button variant="danger" loading={saving} disabled={note.trim().length < 3} onClick={submit}>
          Reject
        </Button>
      }
    >
      <Textarea label="Reason" required value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <ErrorList error={error} className="mt-3" />}
    </Modal>
  );
}

export function Requests() {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/requests")), []);
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState(null);

  const approve = async (row) => {
    setBusy(row._id);
    try {
      await emiApi.patch(S(`/tenants/${row._id}`), { status: "ACTIVE" });
      toast.success(`${row.name} can use EMI & billing now`);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorList error={error} />;
  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  const actions = (row) =>
    isSuperAdmin ? (
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" icon={X} onClick={() => setRejecting({ row })}>
          Reject
        </Button>
        <Button size="sm" icon={Check} loading={busy === row._id} onClick={() => approve(row)}>
          Approve
        </Button>
      </div>
    ) : (
      <Badge tone="warning">Waiting for Super Admin</Badge>
    );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Shops asking for EMI & billing" description="A shop's request is sent the first time its owner opens EMI & billing" />
        {data.shops.length === 0 ? (
          <EmptyState icon={Building2} title="No shop is waiting" className="py-8" />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {data.shops.map((t) => (
              <li key={t._id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{t.name}</span>
                  <span className="block text-caption text-fg-muted">
                    {t.owner?.name} · {t.owner?.email} · {t.owner?.phone || "no phone"}
                    {t.gstin ? ` · GSTIN ${t.gstin}` : " · no GSTIN"} · asked {formatDateTime(t.createdAt)}
                  </span>
                </span>
                {actions(t)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {rejecting && <DecideModal target={rejecting} onClose={() => setRejecting(null)} onDone={reload} />}
    </div>
  );
}

// `shopAdmin`: an Admin who looks after one shop adds staff to that shop only
function AddStaffModal({ onClose, onDone, shopAdmin }) {
  const toast = useToast();
  const tenants = useLoad(() => emiApi.get(S("/tenants")), []);
  const [form, setForm] = useState({ tenantId: "", name: "", email: "", phone: "", password: "", role: "CASHIER", storeId: "" });
  // Their one shop is chosen for them
  useEffect(() => {
    if (shopAdmin && tenants.data?.[0] && !form.tenantId) setForm((f) => ({ ...f, tenantId: tenants.data[0]._id }));
  }, [shopAdmin, tenants.data, form.tenantId]);
  // The shop's stores and the roles its owner made
  const options = useLoad(() => (form.tenantId ? emiApi.get(S("/shop-roles"), { tenantId: form.tenantId }) : Promise.resolve({ data: null })), [form.tenantId]);
  const roleOptions = [
    ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
    ...(options.data?.roles || []).map((r) => ({ value: `CUSTOM:${r._id}`, label: `${r.name} (shop's own role)` })),
  ];
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await emiApi.post(S("/staff"), {
        tenantId: form.tenantId,
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        roles: [
          form.role.startsWith("CUSTOM:")
            ? { role: "CUSTOM", customRoleId: form.role.slice(7), storeId: form.storeId || null }
            : { role: form.role, storeId: form.storeId || null },
        ],
      });
      toast.success(`${form.name} added and approved`);
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
      title={shopAdmin ? "Add staff to your shop" : "Add staff to a shop"}
      description="Staff you add here are approved straight away. They sign in at /login and see only the billing pages of their role."
      footer={
        <Button loading={saving} disabled={!form.tenantId || (shopAdmin && tenants.data?.[0]?.status !== "ACTIVE")} onClick={submit}>
          Add staff
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {shopAdmin ? (
          <p className="text-caption text-fg-muted sm:col-span-2">
            Shop: <span className="font-medium text-fg">{tenants.data?.[0]?.name || "…"}</span>
            {tenants.data?.[0] && tenants.data[0].status !== "ACTIVE" && " · EMI & billing isn't approved for this shop yet, so staff can't be added"}
          </p>
        ) : (
          <Select
            label="Shop"
            required
            className="sm:col-span-2"
            value={form.tenantId}
            onChange={(e) => setForm({ ...form, tenantId: e.target.value, storeId: "", role: "CASHIER" })}
            options={[{ value: "", label: "Choose a shop" }, ...(tenants.data || []).filter((t) => t.status === "ACTIVE").map((t) => ({ value: t._id, label: t.name }))]}
          />
        )}
        <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Email (login)" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" type="password" required hint="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={roleOptions} />
        <Select
          label="Store"
          value={form.storeId}
          onChange={(e) => setForm({ ...form, storeId: e.target.value })}
          options={[{ value: "", label: "All stores" }, ...(options.data?.stores || []).map((st) => ({ value: st._id, label: `${st.name} (${st.invoicePrefix})` }))]}
        />
        {error && <ErrorList error={error} className="sm:col-span-2" />}
      </div>
    </Modal>
  );
}

export function Staff() {
  const toast = useToast();
  // The Super Admin manages every shop's staff; an Admin, their own shop's
  const { isSuperAdmin, isShopAdmin } = useAuth();
  const canManage = isSuperAdmin || isShopAdmin;
  const [shop, setShop] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const { data, loading, error, reload } = useLoad(() => emiApi.get(S("/staff"), { tenantId: shop || undefined, status: status || undefined }), [shop, status]);

  const toggle = async (u) => {
    try {
      await emiApi.patch(S(`/staff/${u._id}`), { staffActive: !u.staffActive });
      toast.success(u.staffActive ? `${u.name} switched off and signed out` : `${u.name} can sign in again`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: "name", header: "Staff", cell: (r) => (
      <span>
        <span className="block font-medium text-fg">{r.name}</span>
        <span className="block text-xs text-fg-muted">{r.email}</span>
      </span>
    ) },
    { key: "tenantName", header: "Shop" },
    { key: "roles", header: "Roles", sortable: false, hideBelow: "md", cell: (r) => <span className="text-caption">{rolesText(r)}</span> },
    { key: "approvalStatus", header: "Approval", cell: (r) => <StateBadge status={r.approvalStatus || "APPROVED"} label={{ PENDING: "Waiting for owner", APPROVED: "Approved", REJECTED: "Rejected" }[r.approvalStatus || "APPROVED"]} /> },
    {
      key: "staffActive",
      header: "Sign-in",
      cell: (r) => (canManage ? <Switch checked={r.staffActive} onCheckedChange={() => toggle(r)} label={r.staffActive ? "On" : "Off"} /> : r.staffActive ? "On" : "Off"),
    },
  ];

  return (
    <>
      {canManage && (
        <div className="mb-3 flex justify-end">
          <Button icon={UserPlus} onClick={() => setAdding(true)}>
            {isShopAdmin ? "Add staff" : "Add staff to a shop"}
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        searchable
        searchPlaceholder="Name, email or shop"
        searchText={(r) => `${r.name} ${r.email} ${r.tenantName}`}
        toolbar={
          <>
            <ShopFilter value={shop} onChange={setShop} />
            <Select
              aria-label="Approval"
              className="w-40"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "", label: "Any approval" },
                { value: "PENDING", label: "Waiting for owner" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
              ]}
            />
          </>
        }
        empty={{ icon: Plus, title: "No staff", description: "Staff that shops add, or that you add here, appear in this list." }}
        pageSize={20}
      />
      {adding && <AddStaffModal shopAdmin={isShopAdmin} onClose={() => setAdding(false)} onDone={reload} />}
    </>
  );
}
