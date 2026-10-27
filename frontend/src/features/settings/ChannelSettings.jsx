import React, { useState } from "react";
import { Check, Copy, ExternalLink, Unplug } from "lucide-react";
import api from "../../services/api.service";
import { SERVER_URL } from "../../config/api.config";
import { useToast } from "../../components/Toast";
import { Alert, Button, Card, ChannelIcon, CHANNELS, cn, ConfirmDialog, Input } from "../../components/ui";

// What each channel needs to connect, and where its webhook points
const CHANNEL_SETUP = {
  whatsapp: {
    configKey: "whatsappConfig",
    describe: (c) => c.phoneNumber || c.phoneNumberId,
    help: "From Meta App Dashboard → WhatsApp → API Setup. Use a permanent System User token.",
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    fields: [
      { name: "phoneNumberId", label: "Phone number ID", required: true, mono: true, hint: "Not the phone number itself: the numeric ID Meta shows next to it." },
      { name: "accessToken", label: "Access token", required: true, type: "password", mono: true },
      { name: "businessAccountId", label: "WhatsApp Business Account ID", mono: true, hint: "Optional" },
      { name: "phoneNumber", label: "Display phone number", hint: "Optional. Filled in from Meta when you connect." },
    ],
  },
  instagram: {
    configKey: "instagramConfig",
    describe: (c) => (c.username ? `@${c.username}` : c.businessAccountId),
    help: "Requires an Instagram professional account linked to a Facebook Page.",
    docs: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api",
    fields: [
      { name: "username", label: "Instagram username", required: true },
      { name: "businessAccountId", label: "Instagram account ID", required: true, mono: true },
      { name: "accessToken", label: "Access token", required: true, type: "password", mono: true },
    ],
  },
  facebook: {
    configKey: "facebookConfig",
    describe: (c) => c.pageName || c.pageId,
    help: "Use a Page access token with the pages_messaging permission.",
    docs: "https://developers.facebook.com/docs/messenger-platform/get-started",
    fields: [
      { name: "pageId", label: "Page ID", required: true, mono: true },
      { name: "accessToken", label: "Page access token", required: true, type: "password", mono: true },
      { name: "pageName", label: "Page name", hint: "Optional. Read from Facebook when you connect." },
    ],
  },
};

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <span className="mb-1 block text-xs text-fg-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{value}</code>
        <Button
          variant="ghost"
          size="icon-sm"
          icon={copied ? Check : Copy}
          aria-label={`Copy ${label}`}
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        />
      </div>
    </div>
  );
}

function ChannelCard({ platform, config = {}, onChanged }) {
  const toast = useToast();
  const setup = CHANNEL_SETUP[platform];
  const channel = CHANNELS[platform];
  const connected = !!config.isConnected;
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const connect = async (e) => {
    e.preventDefault();
    const missing = setup.fields.find((f) => f.required && !form[f.name]?.trim());
    if (missing) return setError(`${missing.label} is required`);
    setSaving(true);
    setError("");
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
      await api.post(`/${platform}/connect`, payload);
      toast.success(`${channel.label} connected`);
      setForm({});
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err.message || `Couldn't connect ${channel.label}`);
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    try {
      await api.post(`/${platform}/disconnect`);
      toast.success(`${channel.label} disconnected`);
      setConfirm(false);
      onChanged();
    } catch (err) {
      toast.error(err.message || "Couldn't disconnect");
    }
  };

  const showForm = !connected || editing;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2">
          <ChannelIcon platform={platform} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-fg">{channel.label}</h3>
          <p className="flex items-center gap-1.5 text-caption">
            <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-success" : "bg-fg-subtle")} aria-hidden="true" />
            <span className={connected ? "text-success-fg" : "text-fg-muted"}>{connected ? "Connected" : "Not connected"}</span>
            {connected && setup.describe(config) && <span className="truncate text-fg-muted">· {setup.describe(config)}</span>}
          </p>
        </div>
        {connected && !editing && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Update credentials
            </Button>
            <Button variant="danger-ghost" size="sm" icon={Unplug} onClick={() => setConfirm(true)}>
              Disconnect
            </Button>
          </div>
        )}
      </div>

      {showForm && (
        <form onSubmit={connect} className="flex flex-col gap-4 border-t border-line p-5">
          <p className="text-caption text-fg-muted">
            {setup.help}{" "}
            <a href={setup.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline">
              Setup guide <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {setup.fields.map((field) => (
              <Input
                key={field.name}
                label={field.label}
                type={field.type || "text"}
                required={field.required}
                hint={field.hint}
                autoComplete="off"
                inputClassName={field.mono ? "font-mono text-caption" : undefined}
                value={form[field.name] || ""}
                onChange={(e) => {
                  setForm({ ...form, [field.name]: e.target.value });
                  setError("");
                }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <CopyField label="Webhook callback URL (paste into the Meta dashboard)" value={`${SERVER_URL}/api/${platform}/webhook`} />
            <p className="text-xs text-fg-muted">
              The verify token is the value of <code className="font-mono">{platform.toUpperCase()}_VERIFY_TOKEN</code> in the server's
              environment. Subscribe to the <code className="font-mono">messages</code> field.
            </p>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            {editing && (
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" loading={saving}>
              {connected ? "Save and reconnect" : `Connect ${channel.label}`}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Disconnect ${channel.label}?`}
        description="New messages from this channel will stop arriving, and replies to its customers will fail until you reconnect."
        confirmLabel="Disconnect"
        onConfirm={disconnect}
      />
    </Card>
  );
}

export default function ChannelSettings({ profile, onReload }) {
  return (
    <div className="flex flex-col gap-4">
      {!profile.whatsappConfig?.isConnected && (
        <Alert tone="info" title="Start with WhatsApp">
          Most shops get the majority of their orders on WhatsApp. Once connected, messages arrive in your inbox in real time.
        </Alert>
      )}
      {Object.entries(CHANNEL_SETUP).map(([platform, setup]) => (
        <ChannelCard key={platform} platform={platform} config={profile[setup.configKey]} onChanged={onReload} />
      ))}
    </div>
  );
}
