import React, { useState } from "react";
import { History, Pencil, Plus } from "lucide-react";
import { useToast } from "../../../components/Toast";
import { Alert, Badge, Button, Card, CardBody, ErrorState, Input, Modal, Select, Skeleton, Switch, Textarea } from "../../../components/ui";
import { formatDate } from "../../../utils/format";
import { inr } from "../../billing/api";
import { INTERVAL_LABELS, INTERVAL_NAMES, platformAdminApi } from "../../platformBilling/api";
import { paiseToRupees, rupeesToPaise, useData } from "./shared";

const LIMITS = [
  ["products", "Products"],
  ["staff", "Staff accounts"],
  ["invoicesPerMonth", "Invoices a month"],
];

const toForm = (p) => ({
  code: p?.code || "",
  name: p?.name || "",
  description: p?.description || "",
  price: paiseToRupees(p?.pricePaise),
  compareAt: paiseToRupees(p?.compareAtPaise || undefined),
  interval: p?.interval || "MONTHLY",
  features: (p?.features || []).join("\n"),
  limits: Object.fromEntries(LIMITS.map(([k]) => [k, p?.limits?.[k] ?? ""])),
  isActive: p ? p.isActive : true,
  sortOrder: String(p?.sortOrder ?? 10),
});

const toBody = (f, isNew) => ({
  ...(isNew && { code: f.code.trim().toLowerCase() }),
  name: f.name.trim(),
  description: f.description.trim() || undefined,
  pricePaise: rupeesToPaise(f.price) ?? 0,
  compareAtPaise: rupeesToPaise(f.compareAt) ?? 0,
  interval: f.interval,
  features: f.features.split("\n").map((x) => x.trim()).filter(Boolean),
  limits: Object.fromEntries(LIMITS.map(([k]) => [k, f.limits[k] === "" ? null : Number(f.limits[k])])),
  isActive: f.isActive,
  sortOrder: Number(f.sortOrder) || 0,
});

function PlanEditor({ plan, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !plan;
  const [form, setForm] = useState(toForm(plan));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = toBody(form, isNew);
      const { data } = isNew ? await platformAdminApi.createPlan(body) : await platformAdminApi.updatePlan(plan.code, body);
      toast.success(isNew ? `Plan ${data.name} added` : data.version !== plan.version ? `Saved as version ${data.version}` : "Saved");
      onSaved();
    } catch (e) {
      setError(e.errors?.join(" · ") || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={isNew ? "New plan" : `Edit ${plan.name}`}
      description={isNew ? "Shops can buy it from Settings → Plan & billing once it's shown." : "Changing the price, interval, limits, features or name saves a new version. Shops already on the plan keep what they paid for until they renew; old invoices never change."}
      footer={
        <Button loading={busy} disabled={!form.name || form.price === "" || (isNew && !form.code)} onClick={save}>
          {isNew ? "Add plan" : "Save"}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isNew && <Input label="Code" hint="Lowercase, never changes (e.g. growth-yearly)" value={form.code} onChange={(e) => set({ code: e.target.value })} />}
        <Input label="Name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
        <Select label="Billed" value={form.interval} onChange={(e) => set({ interval: e.target.value })} options={Object.entries(INTERVAL_NAMES).map(([value, label]) => ({ value, label }))} />
        <Input label="Price ₹" hint="Before GST unless Billing settings say prices include GST" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} />
        <Input label="Was ₹ (struck through)" inputMode="decimal" value={form.compareAt} onChange={(e) => set({ compareAt: e.target.value })} />
        <Input label="Order on the page" inputMode="numeric" value={form.sortOrder} onChange={(e) => set({ sortOrder: e.target.value })} />
        <Textarea label="Description" className="sm:col-span-2" rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        <Textarea label="Features (one per line)" className="sm:col-span-2" rows={4} value={form.features} onChange={(e) => set({ features: e.target.value })} />
        {LIMITS.map(([k, label]) => (
          <Input key={k} label={`${label} limit`} hint="Blank: unlimited" inputMode="numeric" value={form.limits[k]} onChange={(e) => set({ limits: { ...form.limits, [k]: e.target.value } })} />
        ))}
        <div className="sm:col-span-2">
          <Switch label="Shown to shops" description="Hidden plans can't be bought; shops already on them keep them." checked={form.isActive} onCheckedChange={(isActive) => set({ isActive })} />
        </div>
        {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
      </div>
    </Modal>
  );
}

function HistoryDialog({ code, onClose }) {
  const { data } = useData(() => platformAdminApi.planHistory(code), [code]);
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Versions of ${code}`} description="Every invoice keeps the version it was sold at.">
      {!data ? (
        <Skeleton className="h-24" />
      ) : (
        <ul className="divide-y divide-line text-sm">
          {data.map((v) => (
            <li key={v._id} className="flex items-center justify-between gap-3 py-2">
              <span>
                v{v.version} · {v.name} {v.isCurrent && <Badge tone="accent">Current</Badge>}
                <span className="block text-caption text-fg-muted">From {formatDate(v.createdAt)}</span>
              </span>
              <span className="tabular-nums">
                {inr(v.pricePaise)}
                {INTERVAL_LABELS[v.interval]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function Plans() {
  const { data, error, reload } = useData(() => platformAdminApi.plans(), []);
  const [editing, setEditing] = useState(undefined); // undefined: closed, null: new plan
  const [history, setHistory] = useState(null);

  if (error) return <ErrorState title="Couldn't load plans" description={error} onRetry={reload} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-caption text-fg-muted">What shops pay ChatShop. Limits are checked on the server when a shop adds products, staff or invoices.</p>
        <Button icon={Plus} onClick={() => setEditing(null)}>
          New plan
        </Button>
      </div>
      {!data ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <Card key={p.code}>
              <CardBody className="flex h-full flex-col gap-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-fg">{p.name}</p>
                    <p className="text-caption text-fg-muted">
                      {p.code} · v{p.version}
                    </p>
                  </div>
                  {p.isActive ? <Badge tone="success">Shown</Badge> : <Badge>Hidden</Badge>}
                </div>
                <p className="text-xl font-semibold tabular-nums">
                  {inr(p.pricePaise)}
                  <span className="text-caption font-normal text-fg-muted">{INTERVAL_LABELS[p.interval]}</span>
                </p>
                <p className="text-caption text-fg-muted">
                  {LIMITS.map(([k, label]) => `${label}: ${p.limits?.[k] ?? "unlimited"}`).join(" · ")}
                </p>
                <ul className="flex-1 list-disc pl-4 text-caption text-fg">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" icon={History} onClick={() => setHistory(p.code)}>
                    Versions
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <PlanEditor
          plan={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            reload();
          }}
        />
      )}
      {history && <HistoryDialog code={history} onClose={() => setHistory(null)} />}
    </div>
  );
}
