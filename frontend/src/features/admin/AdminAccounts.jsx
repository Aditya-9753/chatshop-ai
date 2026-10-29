import React, { useState } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import api from "../../services/api.service";
import { useToast } from "../../components/Toast";
import { Alert, Button, Card, CardHeader, ConfirmDialog, Input, Modal, Skeleton } from "../../components/ui";
import { formatDate } from "../../utils/format";
import { useLoad } from "../billing/components";

/**
 * Admins with their own login: each signs in with their own email, sees
 * their own name and gets the limited Admin panel. Super Admin only.
 */
function AdminModal({ admin, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: admin?.name || "", email: admin?.email || "", phone: admin?.phone && admin.phone !== "-" ? admin.phone : "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      if (admin) await api.put(`/admin/admins/${admin._id}`, { name: form.name, phone: form.phone, ...(form.password ? { password: form.password } : {}) });
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
      description={admin ? "A new password signs them out everywhere." : "They sign in at /admin/login with this email and see their own name."}
      footer={
        <Button loading={saving} onClick={submit}>
          {admin ? "Save" : "Add admin"}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
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
        description="Each admin has their own login and name, and opens the limited Admin panel"
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
