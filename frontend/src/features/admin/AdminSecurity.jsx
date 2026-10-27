import React, { useCallback, useEffect, useState } from "react";
import { History, ShieldCheck, ShieldOff } from "lucide-react";
import api from "../../services/api.service";
import authService from "../../services/auth.service";
import adminService from "../../services/admin.service";
import { API_ENDPOINTS } from "../../config/api.config";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { Alert, Badge, Button, Card, CardBody, CardHeader, DataTable, Input, Modal, PageHeader } from "../../components/ui";
import { SecuritySettings } from "../settings/AccountSettings";
import { formatDateTime } from "../../utils/format";

const ACTION_LABELS = {
  "auth.login": "Logged in",
  "auth.password_change": "Changed password",
  "2fa.enable": "Turned on two-factor login",
  "2fa.disable": "Turned off two-factor login",
  "shop.signup": "Shop signed up",
  "shop.create": "Admin added a shop",
  "shop.update": "Admin changed a shop",
  "shop.delete": "Admin deleted a shop",
  "settings.update": "Changed platform settings",
  "broadcast.send": "Sent a message to shops",
  "data.export": "Exported data",
  "data.backup": "Downloaded a backup",
  "cache.clear": "Cleared the cache",
};

// Two-factor login with an authenticator app (was "Coming soon")
function TwoFactorCard({ enabled, onChange }) {
  const toast = useToast();
  const [setup, setSetup] = useState(null); // { qrCode, secret }
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const response = await authService.setupTwoFactor();
      setSetup(response.data);
      setCode("");
      setError("");
    } catch (err) {
      toast.error(err.message || "Couldn't start the setup");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (action) => {
    setBusy(true);
    setError("");
    try {
      if (action === "enable") await authService.enableTwoFactor(code);
      else await authService.disableTwoFactor(code);
      toast.success(action === "enable" ? "Two-factor login is on" : "Two-factor login is off");
      setSetup(null);
      setDisabling(false);
      onChange(action === "enable");
    } catch (err) {
      setError(err.message || "That code isn't right");
    } finally {
      setBusy(false);
    }
  };

  const codeInput = (
    <Input
      label="6-digit code from the app"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
      inputClassName="font-mono tracking-[0.3em]"
      autoFocus
    />
  );

  return (
    <Card>
      <CardHeader
        title="Two-factor login"
        description="Ask for a code from an authenticator app (Google Authenticator, Microsoft Authenticator…) after the password."
        action={enabled ? <Badge tone="success" dot>On</Badge> : <Badge>Off</Badge>}
      />
      <CardBody>
        {enabled ? (
          <Button variant="secondary" icon={ShieldOff} onClick={() => { setDisabling(true); setCode(""); setError(""); }}>
            Turn off
          </Button>
        ) : (
          <Button icon={ShieldCheck} loading={busy && !setup} onClick={start}>
            Set up two-factor login
          </Button>
        )}
      </CardBody>

      <Modal
        open={!!setup}
        onOpenChange={(open) => !open && setSetup(null)}
        title="Set up two-factor login"
        description="1. Scan the QR code with your authenticator app. 2. Enter the code it shows."
        footer={
          <Button onClick={() => confirm("enable")} loading={busy} disabled={code.replace(/\s/g, "").length !== 6}>
            Turn on
          </Button>
        }
      >
        {setup && (
          <div className="flex flex-col items-center gap-4">
            <img src={setup.qrCode} alt="QR code for your authenticator app" className="h-48 w-48 rounded-lg border border-line bg-white p-2" />
            <p className="text-center text-xs text-fg-muted">
              Can't scan? Enter this key: <code className="font-mono text-fg">{setup.secret}</code>
            </p>
            <div className="w-full">{codeInput}</div>
            {error && <Alert tone="danger" className="w-full">{error}</Alert>}
          </div>
        )}
      </Modal>

      <Modal
        open={disabling}
        onOpenChange={setDisabling}
        size="sm"
        title="Turn off two-factor login?"
        description="Enter a current code from your app to confirm."
        footer={
          <Button variant="danger" onClick={() => confirm("disable")} loading={busy} disabled={code.replace(/\s/g, "").length !== 6}>
            Turn off
          </Button>
        }
      >
        {codeInput}
        {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
      </Modal>
    </Card>
  );
}

// Who did what, newest first (was "Security Audit Logs - Coming soon")
function AuditLog() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const response = await adminService.getAuditLog(500);
      setRows(response.data || []);
      setState({ loading: false, error: null });
    } catch (err) {
      setState({ loading: false, error: err.message || "Please try again." });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    { key: "createdAt", header: "When", sortable: true, sortValue: (r) => new Date(r.createdAt), cell: (r) => <span className="whitespace-nowrap text-fg-muted">{formatDateTime(r.createdAt)}</span> },
    { key: "action", header: "What", sortable: true, cell: (r) => <span className="font-medium">{ACTION_LABELS[r.action] || r.action}</span> },
    { key: "actor", header: "Who", hideBelow: "sm", cell: (r) => r.actorEmail || "—" },
    { key: "target", header: "On", hideBelow: "md", cell: (r) => <span className="text-fg-muted">{[r.target, r.details].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "ip", header: "IP", hideBelow: "lg", cell: (r) => <span className="font-mono text-caption text-fg-muted">{r.ip || "—"}</span> },
  ];

  return (
    <div>
      <h2 className="mb-3 mt-2 flex items-center gap-2 text-sm font-semibold text-fg">
        <History className="h-4 w-4 text-fg-muted" aria-hidden="true" /> Security audit log
      </h2>
      <DataTable
        columns={columns}
        rows={rows}
        loading={state.loading}
        error={state.error}
        onRetry={load}
        searchable
        searchPlaceholder="Search action, email or IP"
        searchText={(r) => `${ACTION_LABELS[r.action] || r.action} ${r.actorEmail || ""} ${r.target || ""} ${r.ip || ""}`}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        empty={{ icon: History, title: "Nothing logged yet", description: "Logins, admin changes and exports are recorded here." }}
        pageSize={15}
      />
    </div>
  );
}

export default function AdminSecurity() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api
      .get(API_ENDPOINTS.USER.PROFILE)
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(user || {}));
  }, [user]);

  return (
    <div>
      <PageHeader title="Security" description="Your admin password, two-factor login and the audit log." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SecuritySettings profile={profile || user || {}} allowDelete={false} />
        <div>
          <TwoFactorCard
            enabled={!!profile?.twoFactor?.enabled}
            onChange={(enabled) => setProfile((p) => ({ ...p, twoFactor: { ...(p?.twoFactor || {}), enabled } }))}
          />
        </div>
      </div>
      <div className="mt-8">
        <AuditLog />
      </div>
    </div>
  );
}
