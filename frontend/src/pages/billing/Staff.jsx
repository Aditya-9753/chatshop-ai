import React, { useState } from "react";
import { Check, Pencil, Plus, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { Alert, Badge, Button, Card, Checkbox, DataTable, EmptyState, Input, Modal, PageHeader, Select, Skeleton, Switch, Tabs, Textarea } from "../../components/ui";
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
// What the built-in roles do, shown next to the owner's own roles
const BUILT_IN_WORK = {
  STORE_ADMIN: "Everything in billing for their store, and adds staff for it",
  CASHIER: "New sale, invoices, EMI collections, stock",
  ACCOUNTANT: "Invoices, payments and settlement, accounts and GST",
  AGENT: "EMI collections for the customers assigned to them",
};
const APPROVAL_LABELS = { PENDING: "Waiting for owner", APPROVED: "Approved", REJECTED: "Not approved" };

// A role picked in a form: a built-in role, or "CUSTOM:<id>" for the owner's own
const keyOf = (r) => (r.role === "CUSTOM" ? `CUSTOM:${r.customRoleId}` : r.role);
const fromKey = (key) => (key.startsWith("CUSTOM:") ? { role: "CUSTOM", customRoleId: key.slice(7) } : { role: key });
const roleOptionsOf = (customRoles) => [...ROLE_OPTIONS, ...customRoles.map((c) => ({ value: `CUSTOM:${c._id}`, label: c.name }))];

function StaffModal({ member, customRoles, onClose, onDone }) {
  const { allStores, isOwner } = useBilling();
  const toast = useToast();
  const [form, setForm] = useState({
    name: member?.name || "",
    email: member?.email || "",
    phone: member?.phone && member.phone !== "-" ? member.phone : "",
    password: "",
    roles: member?.emiRoles?.length ? member.emiRoles.map((r) => ({ key: keyOf(r), storeId: r.storeId || "" })) : [{ key: "CASHIER", storeId: allStores[0]?._id || "" }],
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const roles = form.roles.map((r) => ({ ...fromKey(r.key), storeId: r.storeId || null }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (member) {
        await emiApi.patch(`/users/${member._id}`, { name: form.name, phone: form.phone || undefined, roles, ...(form.password ? { password: form.password } : {}) });
      } else {
        await emiApi.post("/users", { ...form, phone: form.phone || undefined, roles });
      }
      toast.success(member ? "Staff updated" : isOwner ? "Staff added. They can sign in now." : "Staff added. They can sign in once the shop owner approves them.");
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
      title={member ? `${member.name}: role and store` : "Add staff"}
      description={
        member
          ? "Change their role or store at any time. They are signed out and see the new role's pages at their next sign-in."
          : isOwner
            ? "Pick their role and store. They sign in at the normal login page and only see the pages of their role."
            : "The shop owner approves new staff; after that they sign in at the normal login page and only see the pages of their role."
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
              <Select aria-label="Role" value={r.key} onChange={(e) => setForm({ ...form, roles: form.roles.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} options={roleOptionsOf(customRoles).filter((o) => isOwner || o.value !== "STORE_ADMIN")} />
              <Select aria-label="Store" value={r.storeId} onChange={(e) => setForm({ ...form, roles: form.roles.map((x, j) => (j === i ? { ...x, storeId: e.target.value } : x)) })} options={storeOptions} />
              <Button size="icon" variant="ghost" aria-label="Remove role" disabled={form.roles.length === 1} onClick={() => setForm({ ...form, roles: form.roles.filter((_, j) => j !== i) })}>
                ×
              </Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => setForm({ ...form, roles: [...form.roles, { key: "CASHIER", storeId: allStores[0]?._id || "" }] })}>
            Add role
          </Button>
        </div>
        {error && <ErrorList error={error} className="sm:col-span-2" />}
      </div>
    </Modal>
  );
}

// The owner turns down staff a Store Admin asked for, with a reason they see at login
function RejectModal({ member, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await emiApi.post(`/users/${member._id}/decide`, { decision: "REJECTED", note });
      toast.success(`${member.name} not approved`);
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
      title={`Don't approve ${member.name}?`}
      description="They can't sign in. The reason is shown to them at login."
      footer={
        <Button variant="danger" loading={saving} disabled={!note.trim()} onClick={submit}>
          Don't approve
        </Button>
      }
    >
      <Textarea label="Reason" required rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <ErrorList error={error} className="mt-3" />}
    </Modal>
  );
}

// The owner's own role: a name and the work it may do, picked from the list
function RoleModal({ role, abilities, onClose, onDone }) {
  const toast = useToast();
  const [name, setName] = useState(role?.name || "");
  const [picked, setPicked] = useState(new Set(role?.abilities || []));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const toggle = (key, on) => {
    const next = new Set(picked);
    on ? next.add(key) : next.delete(key);
    setPicked(next);
  };
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { name, abilities: [...picked] };
      if (role) await emiApi.put(`/roles/${role._id}`, body);
      else await emiApi.post("/roles", body);
      toast.success(role ? `${name} saved. Staff with it get the new work right away.` : `${name} created. Give it to staff from the Staff tab.`);
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
      title={role ? `Edit ${role.name}` : "New role"}
      description="Name the role and tick the work it does. Staff with this role see only these pages, plus My work and My account."
      footer={
        <Button loading={saving} disabled={name.trim().length < 2 || picked.size === 0} onClick={submit}>
          {role ? "Save role" : "Create role"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Role name" required placeholder="e.g. Counter helper, Stock manager" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <fieldset>
          <legend className="mb-2 text-caption font-medium text-fg">Work this role does</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {abilities.map((a) => (
              <div key={a.key} className="rounded-lg border border-line p-3">
                <Checkbox checked={picked.has(a.key)} onCheckedChange={(on) => toggle(a.key, on)} label={a.label} />
                <p className="mt-1 pl-6 text-xs text-fg-muted">{a.detail}</p>
              </div>
            ))}
          </div>
        </fieldset>
        {error && <ErrorList error={error} />}
      </div>
    </Modal>
  );
}

function RolesTab({ rolesLoad }) {
  const { isOwner } = useBilling();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const { data, loading, error, reload } = rolesLoad;
  if (error) return <ErrorList error={error} />;
  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  const workOf = (role) => role.abilities.map((k) => data.abilities.find((a) => a.key === k)?.label || k);

  const remove = async (role) => {
    try {
      await emiApi.del(`/roles/${role._id}`);
      toast.success(`${role.name} deleted`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-caption text-fg-muted">
          Make your own roles with your own names, pick the work each one does, then give them to staff. Changes apply to everyone with the role straight away.
        </p>
        {isOwner && (
          <Button icon={Plus} onClick={() => setEditing("new")}>
            New role
          </Button>
        )}
      </div>

      <Card>
        {data.roles.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No roles of your own yet" description={isOwner ? "Create one, e.g. “Counter helper” with New sale and See stock." : "The shop owner can create roles here."} className="py-8" />
        ) : (
          <ul className="divide-y divide-line">
            {data.roles.map((role) => (
              <li key={role._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">
                    {role.name} <span className="font-normal text-fg-muted">· {role.staffCount} staff</span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {workOf(role).map((w) => (
                      <Badge key={w} tone="accent">
                        {w}
                      </Badge>
                    ))}
                  </span>
                </span>
                {isOwner && (
                  <span className="flex gap-1.5">
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(role)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger-ghost" icon={Trash2} disabled={role.staffCount > 0} title={role.staffCount ? "Give its staff another role first" : undefined} onClick={() => remove(role)}>
                      Delete
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="px-5 pt-4 text-caption font-medium text-fg-muted">Built-in roles</p>
        <ul className="divide-y divide-line">
          {ROLE_OPTIONS.map((r) => (
            <li key={r.value} className="flex flex-col px-5 py-3 sm:flex-row sm:gap-4">
              <span className="w-40 shrink-0 text-sm font-medium text-fg">{r.label}</span>
              <span className="text-caption text-fg-muted">{BUILT_IN_WORK[r.value]}</span>
            </li>
          ))}
        </ul>
      </Card>
      {editing && <RoleModal role={editing === "new" ? null : editing} abilities={data.abilities} onClose={() => setEditing(null)} onDone={reload} />}
    </div>
  );
}

function Page() {
  const { can, allStores, isOwner } = useBilling();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/users"), []);
  const rolesLoad = useLoad(() => emiApi.get("/roles"), []);
  const customRoles = rolesLoad.data?.roles || [];
  const [tab, setTab] = useState("staff");
  const [editing, setEditing] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const approve = async (m) => {
    try {
      await emiApi.post(`/users/${m._id}/decide`, { decision: "APPROVED" });
      toast.success(`${m.name} approved. They can sign in now.`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };
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
  const rows = all.filter((m) => (!role || m.emiRoles.some((r) => keyOf(r) === role)) && (!approval || statusOf(m) === approval));
  const roleOptions = roleOptionsOf(customRoles);
  const roleLabel = (r) => roleOptions.find((o) => o.value === keyOf(r))?.label || (r.role === "CUSTOM" ? "Deleted role" : r.role);

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
            {roleLabel(x)} · {storeName(x.storeId)}
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
          {isOwner && statusOf(r) !== "APPROVED" && (
            <span className="mt-1.5 flex gap-1.5">
              <Button size="sm" icon={Check} onClick={() => approve(r)}>
                Approve
              </Button>
              {statusOf(r) === "PENDING" && (
                <Button size="sm" variant="ghost" icon={X} onClick={() => setRejecting(r)}>
                  Reject
                </Button>
              )}
            </span>
          )}
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
        description="Store Admins, cashiers, accountants, collection agents and roles you make yourself. Each has their own login and only sees the work of their role."
        actions={
          can("user.manage") && tab === "staff" && (
            <Button icon={UserPlus} onClick={() => setEditing("new")}>
              Add staff
            </Button>
          )
        }
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        label="Staff sections"
        tabs={[
          { value: "staff", label: "Staff" },
          { value: "roles", label: `Roles${customRoles.length ? ` (${customRoles.length})` : ""}` },
        ]}
      />

      {tab === "roles" ? (
        <RolesTab rolesLoad={rolesLoad} />
      ) : (
        <>
          <Card className="mb-4 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
            <Stat label="Staff">{all.length}</Stat>
            <Stat label="Can sign in">{all.filter((m) => statusOf(m) === "APPROVED" && m.staffActive).length}</Stat>
            <Stat label="Waiting for owner">{all.filter((m) => statusOf(m) === "PENDING").length}</Stat>
            <Stat label="Switched off">{all.filter((m) => !m.staffActive).length}</Stat>
          </Card>

          {isOwner && all.some((m) => statusOf(m) === "PENDING") && (
            <Alert tone="warning" className="mb-4" title="Staff waiting for you">
              A Store Admin added staff who can sign in only after you approve them. Approve or reject them in the Approval column.
            </Alert>
          )}

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
                  options={[{ value: "", label: "Any role" }, ...roleOptions]}
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
            empty={{ icon: Users, title: "No staff yet", description: "Add cashiers, accountants and collection agents, each with their own login." }}
            pageSize={15}
          />
        </>
      )}
      {editing && (
        <StaffModal
          member={editing === "new" ? null : editing}
          customRoles={customRoles}
          onClose={() => setEditing(null)}
          onDone={() => {
            reload();
            rolesLoad.reload();
          }}
        />
      )}
      {rejecting && <RejectModal member={rejecting} onClose={() => setRejecting(null)} onDone={reload} />}
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
