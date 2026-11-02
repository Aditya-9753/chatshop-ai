import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useToast } from "../../../components/Toast";
import { Alert, Badge, Button, Card, CardBody, CardHeader, ErrorState, Input, Select, Skeleton, Switch, Textarea } from "../../../components/ui";
import { API_CONFIG } from "../../../config/api.config";
import { platformAdminApi } from "../../platformBilling/api";
import { useData } from "./shared";

const TEXT = ["legalName", "gstin", "stateCode", "address", "email", "phone", "invoicePrefix", "sac"];
const NUMBERS = ["gstRatePct", "graceDays", "reminderDays", "paymentTermsDays"];

const GATEWAY_TEXT = {
  RAZORPAY: ["success", "Razorpay connected"],
  MOCK: ["warning", "Test gateway (no real money)"],
  NONE: ["danger", "Online payment off"],
};

export default function BillingSettings() {
  const toast = useToast();
  const { data, error, reload } = useData(() => platformAdminApi.settings(), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    if (data) setForm({ ...Object.fromEntries(TEXT.map((k) => [k, data[k] || ""])), ...Object.fromEntries(NUMBERS.map((k) => [k, String(data[k] ?? "")])), pricesIncludeGst: Boolean(data.pricesIncludeGst) });
  }, [data]);

  if (error) return <ErrorState title="Couldn't load settings" description={error} onRetry={reload} />;
  if (!form) return <Skeleton className="h-96 rounded-xl" />;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await platformAdminApi.saveSettings({ ...Object.fromEntries(TEXT.map((k) => [k, form[k].trim()])), ...Object.fromEntries(NUMBERS.map((k) => [k, Number(form[k])])), pricesIncludeGst: form.pricesIncludeGst });
      toast.success("Billing settings saved");
      reload();
    } catch (e) {
      setProblem(e.message);
    } finally {
      setBusy(false);
    }
  };

  const [tone, label] = GATEWAY_TEXT[data.gateway] || GATEWAY_TEXT.NONE;
  const webhookUrl = `${API_CONFIG.BASE_URL.replace(/\/$/, "")}/webhooks/razorpay`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader title="ChatShop AI on invoices" description="The supplier printed on every invoice to a shop. Saved invoices keep the details they were issued with." />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Legal name" value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} />
          <Input label="GSTIN" hint="Blank: not registered, no GST charged" value={form.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
          <Input label="State code" hint="Set from the GSTIN when there is one" value={form.stateCode} onChange={(e) => set({ stateCode: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          <Input label="Invoice prefix" hint="CSA → CSA-26-27-000001" value={form.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value.toUpperCase() })} />
          <Textarea label="Address" className="sm:col-span-2" rows={2} value={form.address} onChange={(e) => set({ address: e.target.value })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="GST" description="Have a tax advisor confirm the rate, SAC code and whether plan prices include GST." />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="GST rate" value={form.gstRatePct} onChange={(e) => set({ gstRatePct: e.target.value })} options={[0, 5, 12, 18, 28].map((r) => ({ value: String(r), label: `${r}%` }))} />
          <Input label="SAC code" hint="Printed on each line" value={form.sac} onChange={(e) => set({ sac: e.target.value })} />
          <div className="sm:col-span-2">
            <Switch
              label="Plan prices include GST"
              description={form.pricesIncludeGst ? "A ₹1,000 plan costs the shop ₹1,000, of which part is GST." : "A ₹1,000 plan costs the shop ₹1,000 plus GST."}
              checked={form.pricesIncludeGst}
              onCheckedChange={(pricesIncludeGst) => set({ pricesIncludeGst })}
            />
          </div>
          {!form.gstin && <Alert tone="info" className="sm:col-span-2">No GSTIN, so invoices are issued without GST until you add one.</Alert>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Renewals and dues" />
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Grace days" hint="Access after a paid plan's end date" inputMode="numeric" value={form.graceDays} onChange={(e) => set({ graceDays: e.target.value })} />
          <Input label="Reminder days" hint="Email this many days before the end" inputMode="numeric" value={form.reminderDays} onChange={(e) => set({ reminderDays: e.target.value })} />
          <Input label="Payment terms" hint="Days until a manual invoice is due" inputMode="numeric" value={form.paymentTermsDays} onChange={(e) => set({ paymentTermsDays: e.target.value })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Payment gateway" action={<Badge tone={tone} dot>{label}</Badge>} />
        <CardBody className="flex flex-col gap-2 text-caption text-fg-muted">
          <p>Keys live on the server, never here: set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET in the backend's environment.</p>
          <p>
            In the Razorpay dashboard add a webhook to <code className="rounded bg-surface-2 px-1 py-0.5 text-fg">{webhookUrl}</code> with the events payment.captured, payment.failed, order.paid, refund.processed and refund.failed, using the same webhook secret.
          </p>
          <p>Webhook secret: {data.webhookSecretSet ? <Badge tone="success">set</Badge> : <Badge tone="danger">not set</Badge>}</p>
        </CardBody>
      </Card>

      {problem && <Alert tone="danger">{problem}</Alert>}
      <Button icon={Save} className="self-start" loading={busy} onClick={save}>
        Save settings
      </Button>
    </div>
  );
}
