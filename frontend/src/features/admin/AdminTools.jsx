import React, { useCallback, useEffect, useState } from "react";
import { Activity, Database, Download, Mail, Megaphone, Server, UserPlus, Webhook } from "lucide-react";
import adminService from "../../services/admin.service";
import { useToast } from "../../components/Toast";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  cn,
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui";
import { formatDateTime } from "../../utils/format";

const PLAN_OPTIONS = [
  { value: "", label: "No plan yet" },
  { value: "starter", label: "Starter" },
  { value: "business", label: "Business" },
  { value: "premium", label: "Premium" },
  { value: "one-time", label: "One-time" },
];

// Admin creates a shop account (the old "Add User" quick action)
export function AddShopModal({ open, onOpenChange, onCreated }) {
  const toast = useToast();
  const empty = { name: "", businessName: "", email: "", phone: "", password: "", plan: "starter" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setError("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return setError("Name and email are required");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    setSaving(true);
    try {
      const response = await adminService.createShop({ ...form, plan: form.plan || undefined });
      toast.success(`${response.data.name} can now log in with ${response.data.email}`);
      onCreated?.(response.data);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Couldn't create the shop");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add a shop"
      description="Creates a login for a shop owner. Share the email and password with them."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="add-shop-form" loading={saving}>
            Create shop
          </Button>
        </>
      }
    >
      <form id="add-shop-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Owner name" required value={form.name} onChange={set("name")} autoFocus />
          <Input label="Business name" value={form.businessName} onChange={set("businessName")} hint="Optional" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" required value={form.email} onChange={set("email")} autoComplete="off" />
          <Input label="Phone" type="tel" value={form.phone} onChange={set("phone")} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Password" type="text" required value={form.password} onChange={set("password")} hint="At least 6 characters" autoComplete="new-password" />
          <Select label="Plan" value={form.plan} onChange={set("plan")} options={PLAN_OPTIONS} hint="Starts today for 30 days" />
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}

/**
 * Message to shops: everyone (the old "Broadcast") or chosen shops (the
 * old "Send Message"). Shown in their dashboard and emailed if SMTP is set.
 */
export function BroadcastModal({ open, onOpenChange, recipients = [], onSent }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const toEveryone = recipients.length === 0;

  useEffect(() => {
    if (open) {
      setTitle("");
      setMessage("");
      setError("");
    }
  }, [open]);

  const send = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return setError("Write a title and a message");
    setSending(true);
    try {
      const response = await adminService.broadcast({ title, message, recipients: recipients.map((r) => r._id) });
      const { recipients: count, announcement } = response.data;
      toast.success(
        `Sent to ${count} shop${count === 1 ? "" : "s"}`,
        {
          description: announcement.emailSkipped
            ? "Shown in their dashboard. Email isn't set up on the server, so no email went out."
            : "Shown in their dashboard. Emails are going out in the background; see Settings → Messages to shops.",
        }
      );
      onSent?.();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Couldn't send the message");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={toEveryone ? "Broadcast to every shop" : `Message ${recipients.map((r) => r.name).join(", ")}`}
      description="Appears as a banner in the shop's dashboard, and is emailed when email is set up on the server."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="broadcast-form" icon={Megaphone} loading={sending}>
            {toEveryone ? "Send to all shops" : "Send message"}
          </Button>
        </>
      }
    >
      <form id="broadcast-form" onSubmit={send} noValidate className="flex flex-col gap-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance tonight" autoFocus />
        <Textarea label="Message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write what the shops need to know…" />
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}

const EXPORTS = [
  { kind: "shops", label: "Shops" },
  { kind: "orders", label: "Orders" },
  { kind: "customers", label: "Customers" },
  { kind: "products", label: "Products" },
];

// Real CSV downloads (the old "Export Data")
export function ExportMenu({ size = "md", variant = "secondary" }) {
  const toast = useToast();
  const run = async (kind) => {
    try {
      await adminService.exportCsv(kind);
    } catch (err) {
      toast.error(err.message || "Export failed");
    }
  };
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <Button variant={variant} size={size} icon={Download}>
          Export data
        </Button>
      </DropdownTrigger>
      <DropdownContent>
        {EXPORTS.map((e) => (
          <DropdownItem key={e.kind} icon={Download} onSelect={() => run(e.kind)}>
            {e.label} (CSV)
          </DropdownItem>
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

// The old "Quick Actions" card, with every button doing something real
export function QuickActions({ onChanged }) {
  const [addOpen, setAddOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  return (
    <Card>
      <CardHeader title="Quick actions" />
      <CardBody className="grid grid-cols-1 gap-2">
        <Button variant="secondary" icon={UserPlus} onClick={() => setAddOpen(true)} className="justify-start">
          Add shop
        </Button>
        <Button variant="secondary" icon={Megaphone} onClick={() => setBroadcastOpen(true)} className="justify-start">
          Broadcast to all shops
        </Button>
        <ExportMenu />
      </CardBody>
      <AddShopModal open={addOpen} onOpenChange={setAddOpen} onCreated={onChanged} />
      <BroadcastModal open={broadcastOpen} onOpenChange={setBroadcastOpen} />
    </Card>
  );
}

export const formatUptime = (seconds = 0) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

export function useSystemStatus() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await adminService.getSystemStatus();
      setStatus(response.data);
    } catch (err) {
      setError(err.message || "Couldn't check the system");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { status, error, load };
}

function StatusRow({ icon: Icon, label, ok, value }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-fg">
        <Icon className="h-4 w-4 text-fg-muted" aria-hidden="true" />
        {label}
      </span>
      <span className={cn("flex items-center gap-1.5 text-caption font-medium", ok ? "text-success-fg" : "text-warning-fg")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-success" : "bg-warning")} aria-hidden="true" />
        {value}
      </span>
    </li>
  );
}

// Live server and database health (the old "System Status", now real)
export function SystemStatusCard() {
  const { status, error, load } = useSystemStatus();
  return (
    <Card>
      <CardHeader
        title="System status"
        description={status ? `Checked ${formatDateTime(status.checkedAt)}` : "Live check"}
        action={
          <button onClick={load} className="text-xs font-medium text-accent hover:underline">
            Check again
          </button>
        }
      />
      <div className="px-5 pb-4">
        {error ? (
          <ErrorState title="Server not reachable" description={error} onRetry={load} className="py-4" />
        ) : !status ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            <StatusRow icon={Server} label="Server" ok value={`Online · up ${formatUptime(status.server.uptimeSeconds)}`} />
            <StatusRow
              icon={Database}
              label="Database"
              ok={status.database.connected}
              value={status.database.connected ? `Connected · ${status.database.pingMs ?? "?"} ms` : status.database.state}
            />
            <StatusRow
              icon={Mail}
              label="Email (SMTP)"
              ok={status.email.working}
              value={status.email.working ? "Working" : status.email.configured ? "Login rejected" : "Not set up"}
            />
            <StatusRow icon={Webhook} label="Webhook signatures" ok={status.webhooks.signatureSecretSet} value={status.webhooks.signatureSecretSet ? "Secret set" : "META_APP_SECRET missing"} />
            <StatusRow icon={Activity} label="Version" ok value={`v${status.server.version} · ${status.server.environment}`} />
          </ul>
        )}
      </div>
    </Card>
  );
}

