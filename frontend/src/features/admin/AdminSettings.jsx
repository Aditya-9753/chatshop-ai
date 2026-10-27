import React, { useCallback, useEffect, useState } from "react";
import { Database, Download, Megaphone, RefreshCw, Save } from "lucide-react";
import adminService from "../../services/admin.service";
import { useToast } from "../../components/Toast";
import { Alert, Button, Card, CardBody, CardHeader, ConfirmDialog, DetailRow, ErrorState, Input, PageHeader, Skeleton, Switch } from "../../components/ui";
import { formatDateTime } from "../../utils/format";
import { BroadcastModal, formatUptime, useSystemStatus } from "./AdminTools";

// Platform name and support contact (the old "General Settings")
function GeneralSettings({ settings, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ platformName: "", supportEmail: "", contactPhone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({ platformName: settings.platformName || "", supportEmail: settings.supportEmail || "", contactPhone: settings.contactPhone || "" });
  }, [settings]);

  const dirty = form.platformName !== (settings.platformName || "") || form.supportEmail !== (settings.supportEmail || "") || form.contactPhone !== (settings.contactPhone || "");

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await adminService.updateSettings(form);
      onSaved(response.data);
      toast.success("Settings saved");
    } catch (err) {
      setError(err.message || "Couldn't save the settings");
    } finally {
      setSaving(false);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <Card as="form" onSubmit={save} noValidate>
      <CardHeader title="General" description="Shown on the website footer, the help widget and the shops' billing page." />
      <CardBody className="flex flex-col gap-4">
        <Input label="Platform name" value={form.platformName} onChange={set("platformName")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Support email" type="email" value={form.supportEmail} onChange={set("supportEmail")} placeholder="support@yourdomain.com" />
          <Input label="Contact phone" type="tel" value={form.contactPhone} onChange={set("contactPhone")} placeholder="+91 …" />
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </CardBody>
      <div className="flex justify-end border-t border-line px-5 py-3">
        <Button type="submit" icon={Save} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

// Admin emails (the old "Notifications"), saved as you toggle
function NotificationSettings({ settings, onSaved, emailConfigured }) {
  const toast = useToast();
  const n = settings.notifications || {};

  const toggle = async (key, value) => {
    try {
      const response = await adminService.updateSettings({ notifications: { [key]: value } });
      onSaved(response.data);
    } catch (err) {
      toast.error(err.message || "Couldn't save");
    }
  };

  return (
    <Card>
      <CardHeader title="Notifications" description="Emails sent to admin accounts." />
      <CardBody className="flex flex-col gap-5">
        {emailConfigured && !emailConfigured.working && (
          <Alert tone="warning">
            {emailConfigured.configured
              ? `The mail server rejected the login in EMAIL_USER / EMAIL_PASSWORD (${emailConfigured.error || "check the app password"}). These are saved, but no email can go out until it's fixed.`
              : "Email isn't set up on the server (EMAIL_USER / EMAIL_PASSWORD), so these are saved but no email can go out yet."}
          </Alert>
        )}
        <Switch label="Email notifications" description="Master switch for every admin email below." checked={n.emailNotifications !== false} onCheckedChange={(v) => toggle("emailNotifications", v)} />
        <Switch label="New shop alerts" description="Email me when a new shop signs up." checked={n.newUserAlerts !== false} onCheckedChange={(v) => toggle("newUserAlerts", v)} disabled={n.emailNotifications === false} />
        <Switch label="Broadcast copies" description="Send me a copy of every broadcast to shops." checked={!!n.systemUpdates} onCheckedChange={(v) => toggle("systemUpdates", v)} disabled={n.emailNotifications === false} />
      </CardBody>
    </Card>
  );
}

const EXPORT_KINDS = ["shops", "orders", "customers", "products"];

// Export all data, backup and cache (the old "Data Management"), all real
function DataManagement() {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const run = async (key, action, done) => {
    setBusy(key);
    try {
      const result = await action();
      if (done) toast.success(done(result));
    } catch (err) {
      toast.error(err.message || "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Data management" />
      <CardBody className="flex flex-col divide-y divide-line">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <p className="text-sm font-medium text-fg">Export all data</p>
            <p className="text-caption text-fg-muted">Four CSV files: shops, orders, customers and products.</p>
          </div>
          <Button
            variant="secondary"
            icon={Download}
            loading={busy === "export"}
            onClick={() =>
              run("export", async () => {
                for (const kind of EXPORT_KINDS) await adminService.exportCsv(kind);
              }, () => "Downloaded 4 CSV files")
            }
          >
            Export all
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-medium text-fg">Backup database</p>
            <p className="text-caption text-fg-muted">One JSON file with every collection. Passwords, 2FA secrets and access tokens are left out.</p>
          </div>
          <Button variant="secondary" icon={Database} loading={busy === "backup"} onClick={() => run("backup", () => adminService.backup(), () => "Backup downloaded")}>
            Download backup
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <p className="text-sm font-medium text-fg">Clear cache</p>
            <p className="text-caption text-fg-muted">Admin reports are cached for a minute. Clear to recalculate them now.</p>
          </div>
          <Button variant="secondary" icon={RefreshCw} loading={busy === "cache"} onClick={() => setConfirmClear(true)}>
            Clear cache
          </Button>
        </div>
      </CardBody>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear the report cache?"
        description="Nothing is deleted. Reports are recalculated the next time they load."
        confirmLabel="Clear cache"
        tone="accent"
        onConfirm={() => {
          setConfirmClear(false);
          run("cache", () => adminService.clearCache(), (res) => `Cache cleared (${res.data.cleared} entries)`);
        }}
      />
    </Card>
  );
}

// Live version, environment and uptime (the old "System Info")
function SystemInfo() {
  const { status, error, load } = useSystemStatus();
  return (
    <Card>
      <CardHeader
        title="System info"
        action={
          <button onClick={load} className="text-xs font-medium text-accent hover:underline">
            Refresh
          </button>
        }
      />
      <CardBody>
        {error ? (
          <ErrorState description={error} onRetry={load} className="py-4" />
        ) : !status ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <dl className="divide-y divide-line/60">
            <DetailRow label="Version">v{status.server.version}</DetailRow>
            <DetailRow label="Environment">{status.server.environment}</DetailRow>
            <DetailRow label="Uptime">{formatUptime(status.server.uptimeSeconds)}</DetailRow>
            <DetailRow label="Started">{formatDateTime(status.server.startedAt)}</DetailRow>
            <DetailRow label="Node.js">{status.server.nodeVersion}</DetailRow>
            <DetailRow label="Memory">{status.server.memoryMb} MB</DetailRow>
            <DetailRow label="Database">
              {status.database.name} · {status.database.state}
              {status.database.pingMs != null && ` · ${status.database.pingMs} ms`}
            </DetailRow>
            <DetailRow label="Email (SMTP)">{status.email.working ? "Working" : status.email.configured ? "Login rejected" : "Not set up"}</DetailRow>
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

// Past broadcasts and messages to shops
function BroadcastHistory() {
  const [items, setItems] = useState(null);
  const [composing, setComposing] = useState(false);
  const load = useCallback(() => {
    adminService
      .getAnnouncements()
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  return (
    <Card>
      <CardHeader
        title="Messages to shops"
        description="Broadcasts and direct messages, newest first."
        action={
          <Button size="sm" icon={Megaphone} onClick={() => setComposing(true)}>
            New broadcast
          </Button>
        }
      />
      <div className="px-5 pb-4">
        {!items ? (
          <Skeleton className="h-20 w-full" />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-caption text-fg-muted">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {items.slice(0, 10).map((a) => (
              <li key={a._id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-fg">{a.title}</p>
                  <span className="shrink-0 text-xs text-fg-muted">{formatDateTime(a.createdAt)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-caption text-fg-muted">{a.message}</p>
                <p className="mt-1 text-xs text-fg-muted">
                  To {a.recipients?.length ? a.recipients.map((r) => r.name).join(", ") : "every shop"} ·{" "}
                  {a.emailSkipped
                    ? "dashboard only (email not set up)"
                    : a.emailStatus === "sending"
                      ? "emails sending…"
                      : `emailed ${a.emailedCount}${a.emailFailedCount ? `, ${a.emailFailedCount} failed` : ""}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BroadcastModal open={composing} onOpenChange={setComposing} onSent={load} />
    </Card>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const { status } = useSystemStatus();

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await adminService.getSettings();
      setSettings(response.data);
    } catch (err) {
      setError(err.message || "Please try again.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Settings" description="Platform details, admin emails, data and system information." />
      {error ? (
        <Card>
          <ErrorState description={error} onRetry={load} />
        </Card>
      ) : !settings ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="flex flex-col gap-6">
            <GeneralSettings settings={settings} onSaved={setSettings} />
            <NotificationSettings settings={settings} onSaved={setSettings} emailConfigured={status?.email} />
            <DataManagement />
          </div>
          <div className="flex flex-col gap-6">
            <SystemInfo />
            <BroadcastHistory />
          </div>
        </div>
      )}
    </div>
  );
}
