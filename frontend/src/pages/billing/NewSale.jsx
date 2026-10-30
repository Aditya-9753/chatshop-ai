import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, FileText, Minus, Plus, Printer, Search, Smartphone, Trash2, UserPlus, X } from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  cn,
} from "../../components/ui";
import { useToast } from "../../components/Toast";
import { assetUrl } from "../../config/api.config";
import { useBilling } from "../../features/billing/BillingContext";
import { BillingGate, ErrorList, KycBadge, METHOD_OPTIONS, Money, StoreSwitcher, useLoad } from "../../features/billing/components";
import { emiApi, fromPaise, inr, newKey, toPaise } from "../../features/billing/api";

const B = "/dashboard/billing";
const STEPS = ["Customer", "Items", "Payment", "Review"];

function Steps({ step }) {
  return (
    <ol className="mb-6 flex items-center gap-2 overflow-x-auto scrollbar-none" aria-label="Sale steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                state === "done" && "bg-success-soft text-success-fg",
                state === "current" && "bg-accent text-accent-fg",
                state === "todo" && "bg-surface-2 text-fg-muted"
              )}
            >
              {n}
            </span>
            <span className={cn("whitespace-nowrap text-sm", state === "current" ? "font-medium text-fg" : "text-fg-muted")}>{label}</span>
            {n < STEPS.length && <span className="mx-1 h-px w-6 bg-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Step 1: customer ----------

function CustomerStep({ customer, setCustomer }) {
  const { can } = useBilling();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", pan: "", stateCode: "", address: "" });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pan, setPan] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await emiApi.get("/customers", { q: term, limit: 8 });
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const create = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await emiApi.post("/customers", form);
      setCustomer(res.data);
      setAdding(false);
      toast.success("Customer added");
    } catch (error) {
      // The number is already known (maybe from WhatsApp): show that customer
      if (error.status === 409) {
        setAdding(false);
        setQ(form.phone.replace(/\D/g, "").slice(-10));
        toast.error(`${error.message}. Pick them from the list.`);
      } else {
        setFormError(error);
      }
    } finally {
      setSaving(false);
    }
  };

  const verifyKyc = async () => {
    setVerifying(true);
    try {
      const res = await emiApi.patch(`/customers/${customer._id}/kyc`, {
        kycStatus: "VERIFIED",
        pan: pan.toUpperCase(),
        docs: [{ type: "PAN", number: pan.toUpperCase() }],
      });
      setCustomer(res.data);
      toast.success("KYC verified");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setVerifying(false);
    }
  };

  if (customer) {
    return (
      <Card>
        <CardBody className="pt-5">
          <div className="flex items-start gap-3">
            <Avatar name={customer.name} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{customer.name}</p>
              <p className="text-caption text-fg-muted">
                {customer.phone}
                {customer.pan ? ` · PAN ${customer.pan}` : ""}
              </p>
              <div className="mt-2">
                <KycBadge status={customer.kycStatus} />
              </div>
            </div>
            <Button variant="ghost" size="sm" icon={X} onClick={() => setCustomer(null)}>
              Change
            </Button>
          </div>
          {customer.kycStatus !== "VERIFIED" && (
            <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-caption text-fg-muted">EMI and sales above ₹2,00,000 need a verified KYC.</p>
              {can("customer.kyc") && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Input label="PAN" placeholder="ABCDE1234F" value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} className="sm:w-48" />
                  <Button variant="secondary" icon={BadgeCheck} loading={verifying} disabled={!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)} onClick={verifyKyc}>
                    Mark KYC verified
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Who is buying?" description="Search by name, mobile or PAN. A WhatsApp customer is found by their number." action={can("customer.create") && <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setAdding(true)}>New customer</Button>} />
      <CardBody>
        <Input icon={Search} placeholder="Name, mobile or PAN" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search customers" />
        <ul className="mt-3 flex flex-col">
          {searching && <Skeleton className="h-12 w-full" />}
          {!searching &&
            results.map((c) => (
              <li key={c._id}>
                <button onClick={() => setCustomer(c)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2 transition-colors">
                  <Avatar name={c.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
                    <span className="block truncate text-caption text-fg-muted">{c.phone || "No phone"}</span>
                  </span>
                  <KycBadge status={c.kycStatus} />
                </button>
              </li>
            ))}
          {!searching && q.trim().length >= 2 && results.length === 0 && <li className="px-2 py-3 text-caption text-fg-muted">No customer found. Add them as a new customer.</li>}
        </ul>
      </CardBody>

      <Modal
        open={adding}
        onOpenChange={setAdding}
        title="New customer"
        description="The mobile number becomes their WhatsApp contact too."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-customer" loading={saving}>
              Add customer
            </Button>
          </>
        }
      >
        <form id="new-customer" onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Input label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="sm:col-span-2" />
          <Input label="Mobile" required inputMode="tel" placeholder="98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="PAN" placeholder="ABCDE1234F" maxLength={10} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
          <Input label="GST state code" hint="2 digits, e.g. 23 for MP. Decides CGST+SGST or IGST." maxLength={2} value={form.stateCode} onChange={(e) => setForm({ ...form, stateCode: e.target.value.replace(/\D/g, "") })} />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          {formError && <ErrorList error={formError} className="sm:col-span-2" />}
        </form>
      </Modal>
    </Card>
  );
}

// ---------- Step 2: items ----------

function ItemsStep({ store, stock, lines, setLines, canDiscount }) {
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(null); // product being added
  const [imei, setImei] = useState("");
  const inCart = new Set(lines.map((l) => l.imei).filter(Boolean));

  const products = (stock.data || []).filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  const add = (product, chosenImei) => {
    if (product.serialized) {
      setLines([...lines, { key: newKey(), productId: product._id, name: product.name, imei: chosenImei, qty: 1, listPrice: product.price, price: product.price, serialized: true, gstRatePct: product.gstRatePct, hsn: product.hsn }]);
    } else {
      const existing = lines.find((l) => l.productId === product._id);
      if (existing) {
        setLines(lines.map((l) => (l === existing ? { ...l, qty: Math.min(l.qty + 1, product.available) } : l)));
      } else {
        setLines([...lines, { key: newKey(), productId: product._id, name: product.name, qty: 1, listPrice: product.price, price: product.price, serialized: false, gstRatePct: product.gstRatePct, hsn: product.hsn, max: product.available }]);
      }
    }
    setPicking(null);
    setImei("");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Cart" description={`Billing from ${store.name}`} />
        <CardBody className="px-0">
          {lines.length === 0 ? (
            <p className="px-5 text-caption text-fg-muted">Add products from the list below.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((line) => (
                <li key={line.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{line.name}</p>
                    <p className="text-caption text-fg-muted">
                      {line.imei ? `IMEI ${line.imei}` : `HSN ${line.hsn || "—"}`} · GST {line.gstRatePct}%
                    </p>
                  </div>
                  {!line.serialized && (
                    <div className="flex items-center gap-1">
                      <Button size="icon-sm" variant="ghost" icon={Minus} aria-label="One less" onClick={() => setLines(lines.map((l) => (l === line ? { ...l, qty: Math.max(1, l.qty - 1) } : l)))} />
                      <span className="w-6 text-center text-sm tabular-nums">{line.qty}</span>
                      <Button size="icon-sm" variant="ghost" icon={Plus} aria-label="One more" disabled={line.qty >= (line.max || 1)} onClick={() => setLines(lines.map((l) => (l === line ? { ...l, qty: l.qty + 1 } : l)))} />
                    </div>
                  )}
                  {canDiscount ? (
                    <Input
                      aria-label={`Selling price for ${line.name}`}
                      inputMode="decimal"
                      className="w-32"
                      inputClassName="text-right tabular-nums"
                      defaultValue={fromPaise(line.price)}
                      onBlur={(e) => {
                        const price = Math.min(toPaise(e.target.value) || line.listPrice, line.listPrice);
                        e.target.value = fromPaise(price);
                        setLines(lines.map((l) => (l === line ? { ...l, price } : l)));
                      }}
                      hint={line.price < line.listPrice ? `List ${inr(line.listPrice, { whole: true })}` : undefined}
                    />
                  ) : (
                    <Money value={line.price * line.qty} className="w-28 text-right text-sm font-medium" />
                  )}
                  <Button size="icon-sm" variant="ghost" icon={Trash2} aria-label={`Remove ${line.name}`} onClick={() => setLines(lines.filter((l) => l !== line))} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Products in stock" description="Phones are sold by IMEI from this store's stock." />
        <CardBody>
          <Input icon={Search} placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
          {stock.loading && !stock.data ? (
            <Skeleton className="mt-3 h-24 w-full" />
          ) : products.length === 0 ? (
            <EmptyState icon={Smartphone} title="No products" description="Add products in Products, and IMEIs in Stock & IMEI." />
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {products.map((p) => {
                const free = p.serialized ? p.imeis.filter((i) => !inCart.has(i)) : null;
                const available = p.serialized ? free.length : p.available - (lines.find((l) => l.productId === p._id)?.qty || 0);
                return (
                  <li key={p._id} className="flex items-center gap-3 rounded-lg border border-line p-2.5">
                    {p.image ? (
                      <img src={assetUrl(p.image)} alt="" className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-2">
                        <Smartphone className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{p.name}</span>
                      <span className="block text-caption text-fg-muted">
                        <Money value={p.price} whole /> · {available > 0 ? `${available} in stock` : "Out of stock"}
                      </span>
                    </span>
                    <Button size="sm" variant="secondary" icon={Plus} disabled={available <= 0} onClick={() => (p.serialized ? setPicking({ ...p, free }) : add(p))}>
                      Add
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(picking)}
        onOpenChange={(open) => !open && setPicking(null)}
        title={`Which ${picking?.name}?`}
        description="Pick the IMEI on the box, or scan/type it."
        size="sm"
        footer={
          <Button disabled={!picking?.free.includes(imei)} onClick={() => add(picking, imei)}>
            Add to cart
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="IMEI" autoFocus value={imei} onChange={(e) => setImei(e.target.value.trim())} error={imei && picking && !picking.free.includes(imei) ? "Not in this store's stock" : undefined} />
          <div className="flex flex-wrap gap-1.5">
            {(picking?.free || []).slice(0, 30).map((i) => (
              <button key={i} onClick={() => setImei(i)} className={cn("rounded-md border px-2 py-1 font-mono text-xs", imei === i ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-line text-fg-muted hover:border-line-strong")}>
                {i}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Step 3: payment & finance ----------

function PaymentStep({ total, rules, finance, setFinance, payments, setPayments, emi, setEmi, paid }) {
  const financed = finance === "NONE" ? 0 : Math.max(0, total - paid);
  const [schedule, setSchedule] = useState({ data: null, error: null, loading: false });

  useEffect(() => {
    if (finance !== "SHOP_EMI" || financed <= 0 || !emi.tenureMonths) {
      setSchedule({ data: null, error: null, loading: false });
      return undefined;
    }
    setSchedule((s) => ({ ...s, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await emiApi.post("/emi/preview", { principal: financed, tenureMonths: Number(emi.tenureMonths), annualRatePct: emi.annualRatePct === "" ? undefined : Number(emi.annualRatePct) });
        setSchedule({ data: res.data, error: null, loading: false });
      } catch (error) {
        setSchedule({ data: null, error, loading: false });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [finance, financed, emi.tenureMonths, emi.annualRatePct]);

  const setRow = (row, patch) => setPayments(payments.map((p) => (p === row ? { ...p, ...patch } : p)));
  // Fill a payment with whatever the other payments leave unpaid
  const fill = (row) => setRow(row, { amount: String(fromPaise(Math.max(0, total - (paid - toPaise(row.amount))))) });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="How is it being paid?" />
        <CardBody>
          <Tabs
            variant="pill"
            value={finance}
            onChange={setFinance}
            label="Finance"
            tabs={[
              { value: "NONE", label: "Full payment" },
              { value: "SHOP_EMI", label: "Shop EMI" },
            ]}
          />

          <div className="mt-5 flex flex-col gap-3">
            <p className="text-caption font-medium text-fg">{finance === "NONE" ? "Payments" : "Down payment (optional)"}</p>
            {payments.map((row) => (
              <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[160px_1fr_1fr_auto] sm:items-end">
                <Select aria-label="Method" value={row.method} onChange={(e) => setRow(row, { method: e.target.value })} options={METHOD_OPTIONS} />
                <Input aria-label="Amount in rupees" inputMode="decimal" placeholder="Amount ₹" value={row.amount} onChange={(e) => setRow(row, { amount: e.target.value.replace(/[^\d.]/g, "") })}
                  suffix={finance === "NONE" && <button type="button" onClick={() => fill(row)} className="rounded px-1.5 py-0.5 text-xs text-accent hover:bg-accent-soft">Rest</button>}
                />
                {row.method !== "CASH" && <Input aria-label="Reference" placeholder="UPI / card ref" value={row.txnRef} onChange={(e) => setRow(row, { txnRef: e.target.value })} className="col-span-2 sm:col-span-1" />}
                {row.method === "CASH" && <span className="hidden sm:block" />}
                <Button size="icon" variant="ghost" icon={Trash2} aria-label="Remove payment" onClick={() => setPayments(payments.filter((p) => p !== row))} />
              </div>
            ))}
            <div>
              <Button size="sm" variant="ghost" icon={Plus} disabled={payments.length >= 5} onClick={() => setPayments([...payments, { key: newKey(), method: "UPI", amount: "", txnRef: "" }])}>
                Add payment
              </Button>
            </div>
            {rules && payments.some((p) => p.method === "CASH") && (
              <p className="text-xs text-fg-muted">Cash must stay below {inr(rules.cashLimitPerTxn, { whole: true })} per sale (Income Tax 269ST).</p>
            )}
          </div>
        </CardBody>
      </Card>

      {finance === "SHOP_EMI" && (
        <Card>
          <CardHeader title="Shop EMI" description={`Financed: ${inr(financed)} · reducing balance, first EMI a month from today`} />
          <CardBody className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Tenure"
                value={emi.tenureMonths}
                onChange={(e) => setEmi({ ...emi, tenureMonths: e.target.value })}
                options={[{ value: "", label: "Choose months" }, ...(rules?.emi.allowedTenures || []).map((t) => ({ value: String(t), label: `${t} months` }))]}
              />
              <Input
                label="Interest rate (% per year)"
                inputMode="decimal"
                placeholder={rules ? String(rules.emi.defaultRatePct) : ""}
                value={emi.annualRatePct}
                onChange={(e) => setEmi({ ...emi, annualRatePct: e.target.value.replace(/[^\d.]/g, "") })}
                hint={rules && `Allowed ${rules.emi.minRatePct}%–${rules.emi.maxRatePct}%`}
              />
            </div>
            {schedule.error && <ErrorList error={schedule.error} />}
            {schedule.loading && <Skeleton className="h-16 w-full" />}
            {schedule.data && !schedule.loading && (
              <div className="rounded-lg border border-line">
                <div className="grid grid-cols-2 gap-3 border-b border-line p-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-fg-muted">Monthly EMI</p>
                    <p className="text-lg font-semibold tabular-nums text-fg">{inr(schedule.data.emi)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Total interest</p>
                    <p className="text-sm font-medium tabular-nums text-fg">{inr(schedule.data.totalInterest)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Total payable</p>
                    <p className="text-sm font-medium tabular-nums text-fg">{inr(schedule.data.totalPayable)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">Approval</p>
                    <p className="text-sm font-medium text-fg">{schedule.data.needsApproval ? "Store Admin needed" : "Not needed"}</p>
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface-2 text-xs text-fg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">#</th>
                        <th className="px-3 py-2 text-left font-medium">Due</th>
                        <th className="px-3 py-2 text-right font-medium">Principal</th>
                        <th className="px-3 py-2 text-right font-medium">Interest</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {schedule.data.installments.map((i) => (
                        <tr key={i.no} className="border-t border-line">
                          <td className="px-3 py-1.5 text-fg-muted">{i.no}</td>
                          <td className="px-3 py-1.5">{i.dueDate}</td>
                          <td className="px-3 py-1.5 text-right">{inr(i.principal)}</td>
                          <td className="px-3 py-1.5 text-right">{inr(i.interest + i.interestGst)}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{inr(i.amountDue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ---------- Step 4: review ----------

function Review({ preview, customer }) {
  if (!preview) return <Skeleton className="h-64 w-full" />;
  if (!preview.ok) {
    return (
      <Card>
        <CardHeader title="Fix these before the sale" />
        <CardBody>
          <ErrorList error={{ errors: preview.errors }} />
        </CardBody>
      </Card>
    );
  }
  const inv = preview.invoice;
  return (
    <Card>
      <CardHeader title="Check and confirm" description={`${customer.name} · ${inv.interState ? "IGST (inter-state)" : "CGST + SGST"}`} />
      <CardBody className="flex flex-col gap-4">
        <table className="w-full text-sm">
          <thead className="text-xs text-fg-muted">
            <tr className="border-b border-line">
              <th className="py-2 text-left font-medium">Item</th>
              <th className="py-2 text-right font-medium">Taxable</th>
              <th className="py-2 text-right font-medium">GST</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2">
                  <span className="block text-fg">{l.name}{l.qty > 1 ? ` × ${l.qty}` : ""}</span>
                  {l.imei && <span className="block text-xs text-fg-muted">IMEI {l.imei}</span>}
                </td>
                <td className="py-2 text-right">{inr(l.taxable)}</td>
                <td className="py-2 text-right">{inr(l.cgst + l.sgst + l.igst)}</td>
                <td className="py-2 text-right font-medium">{inr(l.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="grid grid-cols-2 gap-y-1.5 text-sm sm:ml-auto sm:w-80">
          <dt className="text-fg-muted">Taxable value</dt>
          <dd className="text-right tabular-nums">{inr(inv.taxable)}</dd>
          {inv.igst > 0 ? (
            <>
              <dt className="text-fg-muted">IGST</dt>
              <dd className="text-right tabular-nums">{inr(inv.igst)}</dd>
            </>
          ) : (
            <>
              <dt className="text-fg-muted">CGST</dt>
              <dd className="text-right tabular-nums">{inr(inv.cgst)}</dd>
              <dt className="text-fg-muted">SGST</dt>
              <dd className="text-right tabular-nums">{inr(inv.sgst)}</dd>
            </>
          )}
          {inv.discount > 0 && (
            <>
              <dt className="text-fg-muted">Discount given</dt>
              <dd className="text-right tabular-nums">{inr(inv.discount)}</dd>
            </>
          )}
          <dt className="border-t border-line pt-1.5 font-semibold text-fg">Invoice total</dt>
          <dd className="border-t border-line pt-1.5 text-right font-semibold tabular-nums">{inr(inv.grossTotal)}</dd>
          <dt className="text-fg-muted">Paid now</dt>
          <dd className="text-right tabular-nums">{inr(inv.paidAtSale)}</dd>
          {inv.financed > 0 && (
            <>
              <dt className="text-fg-muted">{inv.financeType === "NBFC" ? "NBFC loan" : "On Shop EMI"}</dt>
              <dd className="text-right tabular-nums">{inr(inv.financed)}</dd>
            </>
          )}
        </dl>
        {preview.emi && (
          <Alert tone="info" title={`${preview.emi.tenureMonths} EMIs of ${inr(preview.emi.emi)} at ${preview.emi.annualRatePct}%`}>
            Total interest {inr(preview.emi.totalInterest)}. {preview.needsApproval ? "This EMI is above the approval limit: a Store Admin must approve it before it starts." : "Starts right away."}
          </Alert>
        )}
        {preview.payments.some((p) => p.mdr.mdr > 0) && (
          <p className="text-xs text-fg-muted">
            Card fees: {preview.payments.filter((p) => p.mdr.mdr > 0).map((p) => `${inr(p.mdr.mdr)} + GST ${inr(p.mdr.gstOnMdr)}`).join(", ")}. Booked when the money settles.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function Done({ result, onNew }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardBody className="flex flex-col items-center gap-3 pt-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-fg">Invoice {result.invoiceNo}</h2>
        <p className="text-sm text-fg-muted">
          {inr(result.grossTotal)} ·{" "}
          {result.status === "PENDING_APPROVAL"
            ? "waiting for EMI approval"
            : result.status === "NBFC_PENDING"
              ? "NBFC payout pending"
              : result.status === "EMI_ACTIVE"
                ? "EMI started"
                : "paid"}
        </p>
        {result.duplicate && <Badge tone="warning">This sale was already saved; nothing was charged twice</Badge>}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button as={Link} to={`${B}/invoices/${result.invoiceId}?print=1`} icon={Printer} variant="secondary">
            Print invoice
          </Button>
          <Button as={Link} to={`${B}/invoices/${result.invoiceId}`} icon={FileText} variant="secondary">
            Open invoice
          </Button>
          <Button onClick={onNew} icon={Plus}>
            New sale
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Sale() {
  const { store } = useBilling();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([]);
  const [finance, setFinance] = useState("NONE");
  const [payments, setPayments] = useState([]);
  const [emi, setEmi] = useState({ tenureMonths: "", annualRatePct: "" });
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [result, setResult] = useState(null);
  const keyRef = useRef(newKey());

  const stock = useLoad(() => emiApi.get(`/stores/${store._id}/stock`), [store._id]);
  const rules = useLoad(() => emiApi.get(`/stores/${store._id}/sale-rules`), [store._id]);

  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const paid = payments.reduce((s, p) => s + toPaise(p.amount), 0);
  const financed = finance === "NONE" ? 0 : Math.max(0, total - paid);
  const balance = total - paid - financed;

  const body = useMemo(
    () => ({
      customerId: customer?._id,
      items: lines.map((l) => ({ productId: l.productId, imei: l.imei, qty: l.qty, price: l.price !== l.listPrice ? l.price : undefined })),
      payments: payments.filter((p) => toPaise(p.amount) > 0).map((p) => ({ method: p.method, amount: toPaise(p.amount), txnRef: p.txnRef || undefined })),
      finance:
        finance === "SHOP_EMI"
          ? { type: "SHOP_EMI", principal: financed, tenureMonths: Number(emi.tenureMonths) || undefined, annualRatePct: emi.annualRatePct === "" ? undefined : Number(emi.annualRatePct) }
          : { type: "NONE" },
    }),
    [customer, lines, payments, finance, financed, emi]
  );

  // Any change after review is a different sale: a new idempotency key
  useEffect(() => {
    keyRef.current = newKey();
    setPreview(null);
  }, [body]);

  // Entering payment with nothing filled in: suggest one UPI payment
  useEffect(() => {
    if (step === 3 && payments.length === 0) {
      setPayments([{ key: newKey(), method: "UPI", amount: finance === "NONE" && total ? String(fromPaise(total)) : "", txnRef: "" }]);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 4) return;
    let live = true;
    emiApi
      .post(`/stores/${store._id}/checkout/preview`, body)
      .then((res) => live && setPreview(res.data))
      .catch((error) => live && setPreview({ ok: false, errors: error.errors || [error.message] }));
    return () => {
      live = false;
    };
  }, [step, body, store._id]);

  const confirm = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await emiApi.post(`/stores/${store._id}/checkout`, body, keyRef.current);
      setResult(res.data);
      toast.success(`Invoice ${res.data.invoiceNo} saved`);
      stock.reload();
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(1);
    setCustomer(null);
    setLines([]);
    setFinance("NONE");
    setPayments([]);
    setEmi({ tenureMonths: "", annualRatePct: "" });
    setPreview(null);
    setResult(null);
    setSaveError(null);
    keyRef.current = newKey();
  };

  if (result) {
    return (
      <>
        <PageHeader title="Sale saved" />
        <Done result={result} onNew={reset} />
      </>
    );
  }

  const canNext =
    (step === 1 && customer) ||
    (step === 2 && lines.length > 0) ||
    (step === 3 && balance === 0 && (finance !== "SHOP_EMI" || (emi.tenureMonths && financed > 0)));

  return (
    <>
      <PageHeader title="New sale" description="GST invoice with full payment or Shop EMI" actions={<StoreSwitcher />} />
      <Steps step={step} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {step === 1 && <CustomerStep customer={customer} setCustomer={setCustomer} />}
          {step === 2 && <ItemsStep store={store} stock={stock} lines={lines} setLines={setLines} canDiscount={rules.data?.canDiscount} />}
          {step === 3 && (
            <PaymentStep
              total={total}
              rules={rules.data}
              finance={finance}
              setFinance={setFinance}
              payments={payments}
              setPayments={setPayments}
              emi={emi}
              setEmi={setEmi}
              paid={paid}
            />
          )}
          {step === 4 && <Review preview={preview} customer={customer} />}
          {saveError && <ErrorList error={saveError} className="mt-4" />}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader title="Summary" />
            <CardBody>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Customer</dt>
                  <dd className="truncate pl-4 text-right text-fg">{customer?.name || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Items</dt>
                  <dd className="tabular-nums">{lines.reduce((s, l) => s + l.qty, 0)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <dt className="font-medium text-fg">Total</dt>
                  <dd className="font-semibold tabular-nums">{inr(total)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Paid now</dt>
                  <dd className="tabular-nums">{inr(paid)}</dd>
                </div>
                {finance !== "NONE" && (
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Shop EMI</dt>
                    <dd className="tabular-nums">{inr(financed)}</dd>
                  </div>
                )}
                {step >= 3 && balance !== 0 && (
                  <div className={cn("flex justify-between rounded-md px-2 py-1", balance > 0 ? "bg-warning-soft text-warning-fg" : "bg-danger-soft text-danger-fg")}>
                    <dt>{balance > 0 ? "Still to pay" : "Paid too much"}</dt>
                    <dd className="tabular-nums">{inr(Math.abs(balance))}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 flex gap-2">
                {step > 1 && (
                  <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(step - 1)} aria-label="Back">
                    Back
                  </Button>
                )}
                {step < 4 ? (
                  <Button className="flex-1" iconRight={ArrowRight} disabled={!canNext} onClick={() => setStep(step + 1)}>
                    Continue
                  </Button>
                ) : (
                  <Button className="flex-1" loading={saving} disabled={!preview?.ok} onClick={confirm}>
                    Confirm sale
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

export default function NewSale() {
  return (
    <BillingGate perm="invoice.create">
      <Sale />
    </BillingGate>
  );
}
