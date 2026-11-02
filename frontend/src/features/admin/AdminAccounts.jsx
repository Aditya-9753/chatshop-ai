import React, { useState } from "react";
import { KeyRound, Store, Trash2, UserPlus } from "lucide-react";
import api from "../../services/api.service";
import { useToast } from "../../components/Toast";
import { Alert, Badge, Button, Card, CardHeader, ConfirmDialog, Input, Modal, Select, Skeleton } from "../../components/ui";
import { formatDate } from "../../utils/format";
import { useLoad } from "../billing/components";

/**
 * Admins with their own login: each looks after one shop and sees only that
 * shop's data (orders, customers, products, chats, EMI & billing). Super
 * Admin only.
 */
function AdminModal({ admin, onClose, onDone }) {
  const toast = useToast();
  const shops = useLoad(() => api.get("/admin/users", { params: { limit: 1000 } }), []);
  const [form, setForm] = useState({ name: admin?.name || "", email: admin?.email || "", phone: admin?.phone && admin.phone !== "-" ? admin.phone : "", password: "", shopId: admin?.shop?._id || "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      if (admin) await api.put(`/admin/admins/${admin._id}`, { name: form.name, phone: form.phone, shopId: form.shopId, ...(form.password ? { password: form.password } : {}) });
      else await api.post("/admin/admins", form);
      toast.success(admin ? "Admin saved" : `${form.name} can sign in at /admin/login`);
      onClose();
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={admin ? `Edit ${admin.name}` : "Add admin"}
      description={admin ? "A new password or a different shop signs them out everywhere." : "They sign in at /admin/login and see only the shop you choose."}
      footer={
        <Button loading={saving} disabled={!form.shopId} onClick={submit}>
          {admin ? "Save" : "Add admin"}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Shop they look after"
          required
          className="sm:col-span-2"
          hint="They see only this shop's orders, customers, products, chats and EMI & billing"
          value={form.shopId}
          onChange={(e) => setForm({ ...form, shopId: e.target.value })}
          options={[
            { value: "", label: shops.data ? "Choose a shop" : "Loading shops…" },
            ...(shops.data || []).map((s) => ({ value: s._id, label: `${s.businessInfo?.businessName || s.name} · ${s.email}` })),
          ]}
        />
        <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input label="Email (login)" type="email" required disabled={Boolean(admin)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label={admin ? "New password (optional)" : "Password"} type="password" required={!admin} hint="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && (
          <Alert tone="danger" className="sm:col-span-2">
            {error}
          </Alert>
        )}
      </div>
    </Modal>
  );
}

export default function AdminAccountsCard() {
  const toast = useToast();
  const { data, loading, reload } = useLoad(() => api.get("/admin/admins"), []);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/admin/admins/${removing._id}`);
      toast.success(`${removing.name} removed`);
      setRemoving(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Admin accounts"
        description="Give each shop its own admin: they sign in with their own login and see only that shop's data"
        action={
          <Button size="sm" icon={UserPlus} onClick={() => setEditing("new")}>
            Add admin
          </Button>
        }
      />
      {loading && !data ? (
        <Skeleton className="mx-5 mb-5 h-16" />
      ) : !data?.length ? (
        <p className="px-5 pb-5 text-caption text-fg-muted">No admin accounts yet. Until you add some, the shared Admin panel password below is the only way in, shown as “Admin”.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {data.map((a) => (
            <li key={a._id} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{a.name}</span>
                <span className="block truncate text-caption text-fg-muted">
                  {a.email} · added {formatDate(a.createdAt)}
                </span>
                <span className="mt-1 block">
                  {a.shop ? (
                    <Badge tone="accent">
                      <Store className="h-3 w-3" aria-hidden="true" /> {a.shop.name}
                    </Badge>
                  ) : (
                    <Badge tone="warning">No shop yet: sees nothing until you choose one</Badge>
                  )}
                </span>
              </span>
              <Button size="icon-sm" variant="ghost" icon={KeyRound} aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)} />
              <Button size="icon-sm" variant="ghost" icon={Trash2} aria-label={`Remove ${a.name}`} onClick={() => setRemoving(a)} />
            </li>
          ))}
        </ul>
      )}
      {editing && <AdminModal admin={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDone={reload} />}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        description="Their account is deleted and they are signed out. Their actions stay in the audit log."
        confirmLabel="Remove"
        onConfirm={remove}
        loading={busy}
      />
    </Card>
  );
}
