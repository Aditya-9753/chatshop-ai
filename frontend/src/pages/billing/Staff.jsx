import React, { useState } from "react";
import { Pencil, Plus, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, DataTable, Input, Modal, PageHeader, Select, Switch } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, ErrorList, StateBadge, Stat, useLoad } from "../../features/billing/components";
import { emiApi } from "../../features/billing/api";

const ROLE_OPTIONS = [
  { value: "STORE_ADMIN", label: "Store Admin" },
  { value: "CASHIER", label: "Cashier" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "AGENT", label: "Collection agent" },
];
const roleLabel = (r) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r;
const APPROVAL_LABELS = { PENDING: "Waiting for Super Admin", APPROVED: "Approved", REJECTED: "Not approved" };

function StaffModal({ member, onClose, onDone }) {
  const { allStores, isOwner } = useBilling();
  const toast = useToast();
  const [form, setForm] = useState({
    name: member?.name || "",
    email: member?.email || "",
    phone: member?.phone && member.phone !== "-" ? member.phone : "",
    password: "",
    roles: member?.emiRoles?.length ? member.emiRoles.map((r) => ({ role: r.role, storeId: r.storeId || "" })) : [{ role: "CASHIER", storeId: allStores[0]?._id || "" }],
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const roles = form.roles.map((r) => ({ role: r.role, storeId: r.storeId || null }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (member) {
        await emiApi.patch(`/users/${member._id}`, { name: form.name, phone: form.phone || undefined, roles, ...(form.password ? { password: form.password } : {}) });
      } else {
        await emiApi.post("/users", { ...form, phone: form.phone || undefined, roles });
      }
      toast.success(member ? "Staff updated" : "Staff added. They can sign in once the Super Admin approves them.");
      onClose();
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const storeOptions = [...(isOwner ? [{ value: "", label: "All stores" }] : []), ...allStores.map((s) => ({ value: s._id, label: s.name }))];
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={member ? `Edit ${member.name}` : "Add staff"}
      description={
        member
          ? "Staff sign in at the normal login page and only see EMI & billing."
          : "The Super Admin approves new staff; after that they sign in at the normal login page and only see EMI & billing."
      }
      footer={
        <Button loading={saving} onClick={submit}>
          {member ? "Save" : "Add staff"}
        </Button>
      }
    >
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
        {error && <ErrorList error={error} className="sm:col-span-2" />}
      </div>
    </Modal>
  );
}

function Page() {
  const { can, allStores } = useBilling();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/users"), []);
  const [editing, setEditing] = useState(null);
  const [role, setRole] = useState("");
  const [approval, setApproval] = useState("");
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

  const all = data || [];
  const statusOf = (m) => m.approvalStatus || "APPROVED";
  const rows = all.filter((m) => (!role || m.emiRoles.some((r) => r.role === role)) && (!approval || statusOf(m) === approval));

  const columns = [
    { key: "name", header: "Name", cell: (r) => (
      <span>
        <span className="block font-medium text-fg">{r.name}</span>
        <span className="block text-xs text-fg-muted">
          {r.email}
          {r.phone && r.phone !== "-" ? ` · ${r.phone}` : ""}
        </span>
      </span>
    ) },
    { key: "roles", header: "Roles", sortable: false, cell: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.emiRoles.map((x, i) => (
          <Badge key={i} tone="neutral">
            {roleLabel(x.role)} · {storeName(x.storeId)}
          </Badge>
        ))}
      </span>
    ) },
    {
      key: "approvalStatus",
      header: "Approval",
      sortValue: statusOf,
      cell: (r) => (
        <span>
          <StateBadge status={statusOf(r)} label={APPROVAL_LABELS[statusOf(r)]} />
          {statusOf(r) === "REJECTED" && r.approvalNote && <span className="mt-0.5 block text-xs text-fg-muted">{r.approvalNote}</span>}
        </span>
      ),
    },
    { key: "staffActive", header: "Sign-in", cell: (r) => (can("user.manage") ? <Switch checked={r.staffActive} onCheckedChange={() => toggle(r)} label={r.staffActive ? "On" : "Off"} /> : r.staffActive ? "On" : "Off") },
    { key: "edit", header: "", sortable: false, cell: (r) => can("user.manage") && <Button size="icon-sm" variant="ghost" icon={Pencil} aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)} /> },
  ];

  return (
    <>
      <PageHeader
        title="Staff"
        description="Store Admins, cashiers, accountants and collection agents. Each has their own login and only sees EMI & billing."
        actions={
          can("user.manage") && (
            <Button icon={UserPlus} onClick={() => setEditing("new")}>
              Add staff
            </Button>
          )
        }
      />

      <Card className="mb-4 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Staff">{all.length}</Stat>
        <Stat label="Can sign in">{all.filter((m) => statusOf(m) === "APPROVED" && m.staffActive).length}</Stat>
        <Stat label="Waiting for Super Admin">{all.filter((m) => statusOf(m) === "PENDING").length}</Stat>
        <Stat label="Switched off">{all.filter((m) => !m.staffActive).length}</Stat>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        error={error?.message}
        onRetry={reload}
        searchable
        searchPlaceholder="Name, email or phone"
        searchText={(r) => `${r.name} ${r.email} ${r.phone || ""}`}
        toolbar={
          <>
            <Select
              aria-label="Role"
              className="w-44"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={[{ value: "", label: "Any role" }, ...ROLE_OPTIONS]}
            />
            <Select
              aria-label="Approval"
              className="w-48"
              value={approval}
              onChange={(e) => setApproval(e.target.value)}
              options={[{ value: "", label: "Any approval" }, ...Object.entries(APPROVAL_LABELS).map(([value, label]) => ({ value, label }))]}
            />
          </>
        }
        empty={{ icon: Users, title: "No staff yet", description: "Add cashiers, accountants and collection agents. The Super Admin approves them before they can sign in." }}
        pageSize={15}
      />
      {editing && <StaffModal member={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={reload} />}
    </>
  );
}

export default function Staff() {
  return (
    <BillingGate perm="user.read">
      <Page />
    </BillingGate>
  );
}
