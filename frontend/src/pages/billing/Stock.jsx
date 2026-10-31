import React, { useState } from "react";
import { Boxes, PackagePlus, Save } from "lucide-react";
import { Alert, Badge, Button, Card, DataTable, Input, Modal, PageHeader, Select, Switch, Tabs, Textarea } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { formatDate } from "../../utils/format";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, ErrorList, Money, Stat, StoreSwitcher, useLoad } from "../../features/billing/components";
import { emiApi } from "../../features/billing/api";

function ReceiveModal({ store, products, open, onOpenChange, onDone }) {
  const toast = useToast();
  const serialized = products.filter((p) => p.serialized);
  const [productId, setProductId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const imeis = [...new Set(text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await emiApi.post(`/stores/${store._id}/inventory`, { productId, imeis });
      const { added, duplicates } = res.data;
      toast.success(`${added} unit${added === 1 ? "" : "s"} added to ${store.name}${duplicates.length ? `; ${duplicates.length} already existed` : ""}`);
      setText("");
      onOpenChange(false);
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Receive stock at ${store.name}`}
      description="Scan or paste IMEIs, one per line. Each becomes a unit you can sell."
      footer={
        <Button loading={saving} disabled={!productId || imeis.length === 0} onClick={submit}>
          Add {imeis.length || ""} unit{imeis.length === 1 ? "" : "s"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label="Product"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          options={[{ value: "", label: serialized.length ? "Choose a phone model" : "No serialized products yet" }, ...serialized.map((p) => ({ value: p._id, label: p.name }))]}
        />
        <Textarea label="IMEIs" rows={6} placeholder={"356938110000001\n356938110000002"} value={text} onChange={(e) => setText(e.target.value)} />
        {error && <ErrorList error={error} />}
      </div>
    </Modal>
  );
}

function GstRow({ product, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ hsn: product.hsn, gstRatePct: product.gstRatePct, serialized: product.serialized });
  const [saving, setSaving] = useState(false);
  const dirty = form.hsn !== product.hsn || Number(form.gstRatePct) !== product.gstRatePct || form.serialized !== product.serialized;
  const save = async () => {
    setSaving(true);
    try {
      await emiApi.patch(`/products/${product._id}/gst`, { hsn: form.hsn, gstRatePct: Number(form.gstRatePct), serialized: form.serialized });
      toast.success(`${product.name} saved`);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <li className="grid grid-cols-2 items-end gap-3 px-5 py-3 sm:grid-cols-[1fr_120px_120px_140px_auto]">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="truncate text-sm font-medium text-fg">{product.name}</p>
        <p className="text-caption text-fg-muted">
          <Money value={product.price} whole /> incl. GST
        </p>
      </div>
      <Input label="HSN" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
      <Select label="GST" value={String(form.gstRatePct)} onChange={(e) => setForm({ ...form, gstRatePct: Number(e.target.value) })} options={[0, 5, 12, 18, 28].map((r) => ({ value: String(r), label: `${r}%` }))} />
      <div className="flex h-9 items-center">
        <Switch checked={form.serialized} onCheckedChange={(v) => setForm({ ...form, serialized: v })} label="By IMEI" />
      </div>
      <Button size="sm" icon={Save} disabled={!dirty} loading={saving} onClick={save}>
        Save
      </Button>
    </li>
  );
}

// What is left and what has sold, per product, at this store
const levelOf = (p) => (p.available === 0 ? "out" : p.available <= 2 ? "low" : "ok");
const LEVELS = {
  out: { tone: "danger", label: "Out of stock" },
  low: { tone: "warning", label: "Low" },
  ok: { tone: "success", label: "In stock" },
};

function Summary({ stock }) {
  const [level, setLevel] = useState("");
  const all = stock.data || [];
  const rows = all.filter((p) => !level || levelOf(p) === level);
  const units = all.reduce((s, p) => s + p.available, 0);
  const value = all.reduce((s, p) => s + p.available * (p.price || 0), 0);
  const sold = all.reduce((s, p) => s + (p.sold || 0), 0);

  const columns = [
    { key: "name", header: "Product", cell: (r) => (
      <span>
        <span className="block max-w-56 truncate font-medium text-fg">{r.name}</span>
        <span className="block text-xs text-fg-muted">{r.category || (r.serialized ? "By IMEI" : "By count")}</span>
      </span>
    ) },
    { key: "available", header: "In stock", align: "right", cell: (r) => <span className="font-semibold tabular-nums text-fg">{r.available}</span> },
    { key: "sold", header: "Sold", align: "right", cell: (r) => <span className="tabular-nums">{r.sold || 0}</span> },
    { key: "price", header: "Price", align: "right", hideBelow: "sm", cell: (r) => <Money value={r.price} whole /> },
    { key: "value", header: "Stock value", align: "right", hideBelow: "md", sortValue: (r) => r.available * (r.price || 0), cell: (r) => <Money value={r.available * (r.price || 0)} whole /> },
    { key: "level", header: "Status", sortValue: (r) => r.available, cell: (r) => <Badge tone={LEVELS[levelOf(r)].tone} dot>{LEVELS[levelOf(r)].label}</Badge> },
  ];

  return (
    <>
      <Card className="mb-4 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <Stat label="Units in stock">{units}</Stat>
        <Stat label="Stock value (incl. GST)"><Money value={value} whole /></Stat>
        <Stat label="Units sold">{sold}</Stat>
        <Stat label="Low or out of stock">{all.filter((p) => levelOf(p) !== "ok").length}</Stat>
      </Card>
      <DataTable
        columns={columns}
        rows={rows}
        loading={stock.loading && !stock.data}
        error={stock.error?.message}
        onRetry={stock.reload}
        searchable
        searchPlaceholder="Product or category"
        searchText={(r) => `${r.name} ${r.category || ""}`}
        toolbar={
          <Select
            aria-label="Stock level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            options={[{ value: "", label: "All products" }, { value: "low", label: "Low (2 or fewer)" }, { value: "out", label: "Out of stock" }, { value: "ok", label: "In stock" }]}
            className="w-44"
          />
        }
        defaultSort={{ key: "available", dir: "asc" }}
        empty={{ icon: Boxes, title: "No products", description: "Add products in Catalog, then receive stock here." }}
        pageSize={20}
      />
    </>
  );
}

function StockPage() {
  const { store, can } = useBilling();
  const [tab, setTab] = useState("summary");
  const [status, setStatus] = useState("IN_STOCK");
  const [receiving, setReceiving] = useState(false);
  const stock = useLoad(() => emiApi.get(`/stores/${store._id}/stock`), [store._id]);
  const units = useLoad(() => emiApi.get(`/stores/${store._id}/inventory`, { status: status || undefined }), [store._id, status]);

  const columns = [
    { key: "imei", header: "IMEI", cell: (r) => <span className="font-mono text-caption text-fg">{r.imei}</span> },
    { key: "productName", header: "Product" },
    { key: "status", header: "Status", cell: (r) => <Badge tone={r.status === "IN_STOCK" ? "success" : "neutral"} dot>{r.status === "IN_STOCK" ? "In stock" : "Sold"}</Badge> },
    { key: "createdAt", header: "Received", hideBelow: "sm", cell: (r) => formatDate(r.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Stock & IMEI"
        description="What is in stock and what has sold, per store. Phones are received and sold by IMEI."
        actions={
          <>
            <StoreSwitcher />
            {can("product.manage") && (
              <Button icon={PackagePlus} onClick={() => setReceiving(true)}>
                Receive stock
              </Button>
            )}
          </>
        }
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        label="Stock view"
        tabs={[
          { value: "summary", label: "Stock summary" },
          { value: "units", label: "Units by IMEI" },
          { value: "gst", label: "Products: HSN & GST" },
        ]}
      />

      {tab === "summary" ? (
        <Summary stock={stock} />
      ) : tab === "units" ? (
        <DataTable
          columns={columns}
          rows={units.data || []}
          loading={units.loading && !units.data}
          error={units.error?.message}
          onRetry={units.reload}
          searchable
          searchPlaceholder="IMEI or product"
          searchText={(r) => `${r.imei} ${r.productName}`}
          toolbar={
            <Select
              aria-label="Unit status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "IN_STOCK", label: "In stock" },
                { value: "SOLD", label: "Sold" },
                { value: "", label: "All units" },
              ]}
              className="w-36"
            />
          }
          empty={{ icon: Boxes, title: "No units here", description: "Receive phones by IMEI to sell them on invoice or EMI." }}
          pageSize={20}
        />
      ) : (
        <Card>
          <Alert tone="info" className="m-4">
            GST rate and HSN print on every invoice. Turn on “By IMEI” for phones and other serialized items; their stock then counts the IMEIs you receive.
          </Alert>
          <ul className="divide-y divide-line">
            {(stock.data || []).map((p) =>
              can("product.manage") ? (
                <GstRow key={p._id} product={p} onSaved={stock.reload} />
              ) : (
                <li key={p._id} className="flex justify-between px-5 py-3 text-sm">
                  <span>{p.name}</span>
                  <span className="text-fg-muted">HSN {p.hsn || "—"} · GST {p.gstRatePct}%</span>
                </li>
              )
            )}
          </ul>
        </Card>
      )}

      <ReceiveModal
        store={store}
        products={stock.data || []}
        open={receiving}
        onOpenChange={setReceiving}
        onDone={() => {
          stock.reload();
          units.reload();
        }}
      />
    </>
  );
}

export default function Stock() {
  return (
    <BillingGate perm="product.read">
      <StockPage />
    </BillingGate>
  );
}
