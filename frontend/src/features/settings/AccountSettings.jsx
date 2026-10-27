import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Users } from "lucide-react";
import api from "../../services/api.service";
import authService from "../../services/auth.service";
import { API_ENDPOINTS } from "../../config/api.config";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { PasswordInput, PasswordStrength } from "../../components/auth/PasswordInput";
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, cn, EmptyState, Input, Modal, Select, Skeleton, StatusPill, Switch } from "../../components/ui";
import { formatCurrency, formatDate } from "../../utils/format";
import usePublicSettings from "../../hooks/usePublicSettings";

// AI replies: preferences are stored now; auto-reply ships in a later phase
export function AiSettings({ profile, onProfileChange }) {
  const toast = useToast();
  const config = profile.aiConfig || {};

  const save = async (changes) => {
    try {
      const response = await api.put(API_ENDPOINTS.USER.AI_CONFIG, changes);
      onProfileChange({ ...profile, aiConfig: response.data });
      toast.success("AI preferences saved");
    } catch (err) {
      toast.error(err.message || "Couldn't save AI preferences");
    }
  };

  return (
    <Card>
      <CardHeader
        title="AI replies"
        description="How AI-drafted replies should sound."
        action={
          <Badge tone="accent">
            <Sparkles className="h-3 w-3" /> Coming soon
          </Badge>
        }
      />
      <CardBody className="flex flex-col gap-5">
        <Alert tone="info">
          Automatic AI replies aren't live yet. Your choices here are saved and will apply as soon as they launch.
        </Alert>
        <Switch
          label="Enable AI replies"
          description="Let AI answer common questions about price, stock and delivery."
          checked={config.isEnabled !== false}
          onCheckedChange={(isEnabled) => save({ isEnabled })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Reply language"
            value={config.language || "hinglish"}
            onChange={(e) => save({ language: e.target.value })}
            options={[
              { value: "english", label: "English" },
              { value: "hindi", label: "Hindi" },
              { value: "hinglish", label: "Hinglish" },
            ]}
          />
          <Select
            label="Reply speed"
            value={config.responseSpeed || "natural"}
            onChange={(e) => save({ responseSpeed: e.target.value })}
            options={[
              { value: "natural", label: "Natural (short typing delay)" },
              { value: "instant", label: "Instant" },
            ]}
          />
        </div>
      </CardBody>
    </Card>
  );
}

const PLAN_ORDER = ["starter", "business", "premium", "one-time"];

export function BillingSettings({ profile }) {
  const [plans, setPlans] = useState(null);
  const { supportEmail, contactPhone } = usePublicSettings();
  const subscription = profile.subscription || {};

  useEffect(() => {
    api
      .get(API_ENDPOINTS.SUBSCRIPTION.PLANS)
      .then((res) => setPlans(res.data || {}))
      .catch(() => setPlans({}));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Current plan" />
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold capitalize text-fg">{subscription.plan || "No plan"}</p>
            <p className="text-caption text-fg-muted">
              {subscription.endDate ? `Renews or ends on ${formatDate(subscription.endDate)}` : "No active billing period"}
            </p>
          </div>
          <StatusPill status={subscription.status || "inactive"} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Plans" description="Prices per month in INR, excluding GST." />
        <CardBody>
          {!plans ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PLAN_ORDER.filter((key) => plans[key]).map((key) => {
                const plan = plans[key];
                const current = subscription.plan === key;
                return (
                  <div key={key} className={cn("rounded-xl border p-4", current ? "border-accent bg-accent-soft/40" : "border-line")}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-fg">{plan.name}</p>
                      {current && (
                        <Badge tone="accent">
                          <Check className="h-3 w-3" /> Current
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-xl font-semibold tabular-nums text-fg">
                      {formatCurrency(plan.price)}
                      <span className="text-caption font-normal text-fg-muted">{key === "one-time" ? " once" : " /mo"}</span>
                    </p>
                    {plan.originalPrice > plan.price && (
                      <p className="text-xs text-fg-muted line-through">{formatCurrency(plan.originalPrice)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-caption text-fg-muted">
            Online checkout is coming soon. To change your plan now, contact support
            {supportEmail && (
              <>
                {" at "}
                <a href={`mailto:${supportEmail}`} className="font-medium text-accent hover:underline">
                  {supportEmail}
                </a>
              </>
            )}
            {contactPhone && ` or ${contactPhone}`}.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export function TeamSettings({ profile }) {
  return (
    <Card>
      <CardHeader title="Team" description="People who can use this workspace." />
      <div className="flex items-center gap-3 border-y border-line px-5 py-3">
        <Avatar name={profile.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{profile.name}</p>
          <p className="truncate text-caption text-fg-muted">{profile.email}</p>
        </div>
        <Badge>Owner</Badge>
      </div>
      <EmptyState icon={Users} title="Invite your team soon" description="Team members with their own logins and shared inbox assignment are on the roadmap." />
    </Card>
  );
}

export function SecuritySettings({ profile, allowDelete = true }) {
  const toast = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const set = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    setErrors({ ...errors, [field]: undefined });
    setError("");
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.current) next.current = "Enter your current password";
    if (form.next.length < 6) next.next = "Use at least 6 characters";
    else if (form.next === form.current) next.next = "Choose a password you haven't just used";
    if (form.confirm !== form.next) next.confirm = "Passwords don't match";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await authService.changePassword(form.current, form.next);
      setForm({ current: "", next: "", confirm: "" });
      toast.success("Password changed. Other devices have been logged out.");
    } catch (err) {
      setError(err.message || "Couldn't change your password");
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.delete(API_ENDPOINTS.USER.DELETE_ACCOUNT);
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message || "Couldn't delete the account");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card as="form" onSubmit={changePassword} noValidate>
        <CardHeader title="Change password" description="You'll stay logged in here; every other device is logged out." />
        <CardBody className="flex max-w-md flex-col gap-4">
          <input type="text" name="username" autoComplete="username" value={profile.email || ""} readOnly hidden />
          <PasswordInput label="Current password" autoComplete="current-password" value={form.current} onChange={set("current")} error={errors.current} />
          <div>
            <PasswordInput label="New password" autoComplete="new-password" value={form.next} onChange={set("next")} error={errors.next} />
            <PasswordStrength password={form.next} />
          </div>
          <PasswordInput label="Confirm new password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} />
          {error && <Alert tone="danger">{error}</Alert>}
        </CardBody>
        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button type="submit" loading={saving}>
            Update password
          </Button>
        </div>
      </Card>

      {allowDelete && (
      <Card className="border-danger/30">
        <CardHeader title="Delete account" description="Permanently remove your account and workspace. This can't be undone." />
        <CardBody>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </CardBody>
      </Card>
      )}

      <Modal
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          setDeleteText("");
        }}
        size="sm"
        title="Delete your account?"
        description="Your login, settings and channel connections are removed permanently."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={deleteText !== "DELETE"} onClick={deleteAccount}>
              Delete forever
            </Button>
          </>
        }
      >
        <Input label='Type "DELETE" to confirm' value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
      </Modal>
    </div>
  );
}
