import React, { useEffect, useRef, useState } from "react";
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

function EmbeddedSignup({ accountConfig, onChanged }) {
  const toast = useToast();
  const [signupConfig, setSignupConfig] = useState(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [assets, setAssets] = useState(null);
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(accountConfig?.setupStatus === "pending");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const exchangedSignup = useRef("");

  useEffect(() => {
    let active = true;
    api.get("/whatsapp/embedded-signup/config")
      .then((response) => active && setSignupConfig(response.data))
      .catch((requestError) => active && setError(requestError.message || "Couldn't load Meta setup"));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!signupConfig?.enabled) return undefined;
    let active = true;
    const initialize = () => {
      if (!window.FB || !active) return;
      window.FB.init({
        appId: signupConfig.appId,
        cookie: true,
        xfbml: false,
        version: signupConfig.graphVersion,
      });
      setSdkReady(true);
    };

    if (window.FB) {
      initialize();
    } else {
      window.fbAsyncInit = initialize;
      if (!document.getElementById("facebook-jssdk")) {
        const script = document.createElement("script");
        script.id = "facebook-jssdk";
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.onerror = () => setError("Meta's JavaScript SDK couldn't load. Check network settings and try again.");
        document.head.appendChild(script);
      }
    }

    return () => { active = false; };
  }, [signupConfig]);

  useEffect(() => {
    if (!authCode || !assets?.phoneNumberId || !assets?.businessAccountId) return;
    const requestKey = `${authCode}:${assets.phoneNumberId}`;
    if (exchangedSignup.current === requestKey) return;
    exchangedSignup.current = requestKey;
    let active = true;
    setBusy(true);
    setError("");
    api.post("/whatsapp/embedded-signup/exchange", {
      code: authCode,
      phoneNumberId: assets.phoneNumberId,
      businessAccountId: assets.businessAccountId,
    })
      .then(() => {
        if (!active) return;
        setPending(true);
        toast.success("Meta account authorized. Enter the phone's six-digit verification PIN to finish.");
      })
      .catch((requestError) => active && setError(requestError.message || "Meta account authorization failed"))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [authCode, assets]);

  useEffect(() => {
    const receiveSignupEvent = (event) => {
      if (!["https://www.facebook.com", "https://web.facebook.com", "https://business.facebook.com"].includes(event.origin)) return;
      let payload = event.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "FINISH") {
        setAssets({
          phoneNumberId: String(payload.data?.phone_number_id || ""),
          businessAccountId: String(payload.data?.waba_id || ""),
        });
      } else if (payload.event === "CANCEL" || payload.event === "ERROR") {
        setError("Meta setup was cancelled or could not be completed. You can try again.");
      }
    };
    window.addEventListener("message", receiveSignupEvent);
    return () => window.removeEventListener("message", receiveSignupEvent);
  }, []);

  const startSignup = () => {
    setError("");
    setAssets(null);
    setAuthCode("");
    exchangedSignup.current = "";
    if (!window.FB || !signupConfig?.enabled) {
      setError("Meta Embedded Signup isn't configured. Use the manual connection form below.");
      return;
    }
    window.FB.login((response) => {
      const code = response?.authResponse?.code;
      if (!code) {
        setError("Meta didn't return an authorization code. Make sure the business completes the signup window.");
        return;
      }
      setAuthCode(code);
    }, {
      config_id: signupConfig.configId,
      response_type: "code",
      override_default_response_type: true,
      extras: { sessionInfoVersion: "3" },
    });
  };

  const finishSetup = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/whatsapp/embedded-signup/complete", { pin });
      setPin("");
      setPending(false);
      toast.success("WhatsApp connected");
      onChanged();
    } catch (requestError) {
      setError(requestError.message || "Couldn't finish WhatsApp setup");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line p-5">
      <div>
        <h4 className="text-sm font-semibold text-fg">Connect with Meta</h4>
        <p className="mt-1 text-caption text-fg-muted">
          Embedded Signup needs ChatShop's Meta Tech Provider approval and app configuration. If unavailable, connect manually below.
        </p>
      </div>
      {pending || accountConfig?.setupStatus === "pending" ? (
        <form onSubmit={finishSetup} className="flex flex-wrap items-end gap-3">
          <Input
            label="WhatsApp two-step verification PIN"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <Button type="submit" loading={busy} disabled={pin.length !== 6}>Finish setup</Button>
        </form>
      ) : (
        <div>
          <Button variant="secondary" loading={busy} disabled={!signupConfig?.enabled || !sdkReady} onClick={startSignup}>
            {signupConfig?.enabled ? "Continue with Meta" : "Embedded Signup not configured"}
          </Button>
        </div>
      )}
      {!signupConfig?.enabled && (
        <Alert tone="info">
          Server setup requires META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID and an approved Meta Embedded Signup configuration.
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
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

      {platform === "whatsapp" && connected && config.webhookSubscribed === false && (
        <Alert tone="warning" className="mx-5 mb-4">
          The number can send messages, but Meta has not confirmed this app's webhook subscription. Reconnect with the WhatsApp Business Account ID or subscribe the app to the account in Meta Business Settings.
        </Alert>
      )}

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

      {platform === "whatsapp" && !connected && (
        <EmbeddedSignup accountConfig={config} onChanged={onChanged} />
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
