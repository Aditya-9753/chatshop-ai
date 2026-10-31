import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Alert, Button, Input, SectionLabel, Select, Skeleton } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useBilling } from "../billing/BillingContext";
import { ErrorList, KycBadge, METHOD_OPTIONS, useLoad } from "../billing/components";
import { emiApi, inr, newKey, toPaise } from "../billing/api";

const empty = () => Promise.resolve({ data: null });

/**
 * The Shop EMI part of New order: store, IMEIs for phones, down payment,
 * tenure and rate, with the server's own check and monthly EMI. Reports the
 * sale to make through onChange({ storeId, body, total, ready, missing, key }).
 */
export default function EmiPayment({ customer, items, products, onCustomerChange, onChange }) {
  const billing = useBilling();
  const toast = useToast();
  const [storeId, setStoreId] = useState(billing.store?._id || "");
  const [imeis, setImeis] = useState({});
  const [down, setDown] = useState({ amount: "", method: "UPI", txnRef: "" });
  const [plan, setPlan] = useState({ tenureMonths: "", annualRatePct: "" });
  const [pan, setPan] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [check, setCheck] = useState({ data: null, loading: false });
  const keyRef = useRef(newKey());

  const open = Boolean(billing.me) && billing.can("emi.create") && billing.can("invoice.create");
  useEffect(() => {
    if (!storeId && billing.store) setStoreId(billing.store._id);
  }, [billing.store, storeId]);

  const stock = useLoad(() => (open && storeId ? emiApi.get(`/stores/${storeId}/stock`) : empty()), [open, storeId]);
  const rules = useLoad(() => (open && storeId ? emiApi.get(`/stores/${storeId}/sale-rules`) : empty()), [open, storeId]);
  const emiRules = rules.data?.emi;

  const byId = useMemo(() => new Map(products.map((p) => [p._id, p])), [products]);
  const inStock = useMemo(() => new Map((stock.data || []).map((p) => [String(p._id), p.imeis || []])), [stock.data]);
  const serialized = (item) => Boolean(byId.get(item.productId)?.serialized);

  // Prices in the catalog include GST, as on the GST invoice
  const total = items.reduce((s, item) => s + toPaise(item.price) * item.quantity, 0);
  const downPaise = toPaise(down.amount);
  const imeisOf = (item) => Array.from({ length: item.quantity }, (_, k) => imeis[item.productId]?.[k] || "");
  const allPicked = items.every((item) => !serialized(item) || imeisOf(item).every(Boolean));

  const body = useMemo(
    () => ({
      customerId: customer?._id,
      items: items.flatMap((item) =>
        serialized(item) ? imeisOf(item).map((imei) => ({ productId: item.productId, imei })) : [{ productId: item.productId, qty: item.quantity }]
      ),
      payments: downPaise > 0 ? [{ method: down.method, amount: downPaise, txnRef: down.txnRef || undefined }] : [],
      finance: {
        type: "SHOP_EMI",
        principal: Math.max(0, total - downPaise),
        tenureMonths: Number(plan.tenureMonths) || undefined,
        annualRatePct: plan.annualRatePct === "" ? undefined : Number(plan.annualRatePct),
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customer?._id, items, imeis, downPaise, down.method, down.txnRef, total, plan, byId]
  );

  // The server checks the sale (KYC, down payment, tenure, stock) and works out the EMI
  const complete = open && storeId && customer && items.length > 0 && allPicked && plan.tenureMonths && total > downPaise;
  useEffect(() => {
    keyRef.current = newKey();
    if (!complete) {
      setCheck({ data: null, loading: false });
      return undefined;
    }
    setCheck((c) => ({ ...c, loading: true }));
    const timer = setTimeout(() => {
      emiApi
        .post(`/stores/${storeId}/checkout/preview`, body)
        .then((res) => setCheck({ data: res.data, loading: false }))
        .catch((error) => setCheck({ data: { ok: false, errors: error.errors || [error.message] }, loading: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [complete, storeId, body]);

  const ready = Boolean(complete && check.data?.ok && !check.loading);

  // What still stands between the shop and the order, in plain words
  const missing = !open
    ? [billing.error?.code === "TENANT_PENDING" ? "EMI & billing for your shop is waiting for the Super Admin's approval" : billing.error?.message || "Your role can't sell on EMI"]
    : [
        !customer && "Choose a customer",
        customer && customer.kycStatus !== "VERIFIED" && "Verify the customer's KYC: enter their PAN and press Verify KYC",
        items.length === 0 && "Add at least one item",
        !allPicked && "Pick the IMEI of each phone",
        !plan.tenureMonths && "Choose the tenure (months)",
        total > 0 && downPaise >= total && "Down payment must be less than the order total",
        ...(complete && check.data && !check.data.ok ? check.data.errors : []),
        complete && check.loading && "Working out the EMI, try again in a moment",
      ].filter(Boolean);

  useEffect(() => {
    onChange({ storeId, body, total: check.data?.invoice?.grossTotal ?? total, ready, missing, key: keyRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, body, total, ready, check.data, check.loading, open, customer?.kycStatus]);

  const verifyKyc = async () => {
    setVerifying(true);
    try {
      const res = await emiApi.patch(`/customers/${customer._id}/kyc`, { kycStatus: "VERIFIED", pan: pan.toUpperCase(), docs: [{ type: "PAN", number: pan.toUpperCase() }] });
      onCustomerChange(res.data);
      toast.success("KYC verified");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setVerifying(false);
    }
  };

  if (billing.loading && !billing.me) return <Skeleton className="h-24 w-full" />;
  if (!open) {
    return (
      <Alert tone="warning" title="EMI isn't available yet">
        {billing.error?.message || "Your role can't sell on EMI."}{" "}
        {billing.error?.code === "TENANT_PENDING" ? "The Super Admin opens EMI & billing for your shop; then this option works." : ""}
      </Alert>
    );
  }

  const pickImei = (item, k, value) => {
    const list = imeisOf(item);
    list[k] = value;
    setImeis({ ...imeis, [item.productId]: list });
  };
  const chosen = new Set(Object.values(imeis).flat().filter(Boolean));
  const minDown = emiRules ? Math.ceil((total * emiRules.minDownPaymentPct) / 100) : 0;
  const result = check.data;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <SectionLabel>Shop EMI</SectionLabel>

      {billing.stores.length > 1 && (
        <Select label="Store" value={storeId} onChange={(e) => setStoreId(e.target.value)} options={billing.stores.map((s) => ({ value: s._id, label: s.name }))} />
      )}

      {customer && customer.kycStatus !== "VERIFIED" && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3">
          <p className="flex items-center gap-2 text-sm text-fg">
            KYC <KycBadge status={customer.kycStatus} />
            <span className="text-caption text-fg-muted">EMI needs a verified KYC.</span>
          </p>
          {billing.can("customer.kyc") && (
            <div className="flex items-end gap-2">
              <Input label="PAN" className="flex-1" placeholder="ABCDE1234F" maxLength={10} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} />
              <Button variant="secondary" icon={ShieldCheck} loading={verifying} disabled={!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)} onClick={verifyKyc}>
                Verify KYC
              </Button>
            </div>
          )}
        </div>
      )}

      {items.some(serialized) && (
        <div className="flex flex-col gap-2">
          <p className="text-caption font-medium text-fg">IMEI of each phone</p>
          {stock.loading && !stock.data ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            items.filter(serialized).flatMap((item) =>
              imeisOf(item).map((imei, k) => {
                const options = (inStock.get(item.productId) || []).filter((x) => x === imei || !chosen.has(x));
                return (
                  <Select
                    key={`${item.productId}-${k}`}
                    aria-label={`IMEI for ${item.name} ${k + 1}`}
                    value={imei}
                    onChange={(e) => pickImei(item, k, e.target.value)}
                    options={[{ value: "", label: options.length ? `${item.name}${item.quantity > 1 ? ` #${k + 1}` : ""}: choose IMEI` : `${item.name}: none in stock at this store` }, ...options.map((x) => ({ value: x, label: x }))]}
                  />
                );
              })
            )
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={emiRules?.minDownPaymentPct ? "Down payment ₹" : "Down payment ₹ (optional)"}
          inputMode="decimal"
          value={down.amount}
          onChange={(e) => setDown({ ...down, amount: e.target.value.replace(/[^\d.]/g, "") })}
          hint={emiRules?.minDownPaymentPct ? `At least ${inr(minDown, { whole: true })} (${emiRules.minDownPaymentPct}%)` : "Leave empty if the customer pays nothing now"}
        />
        <Select label="Paid by" value={down.method} onChange={(e) => setDown({ ...down, method: e.target.value })} options={METHOD_OPTIONS} />
        {down.method !== "CASH" && downPaise > 0 && (
          <Input
            label="UPI / card ref (optional)"
            className="col-span-2"
            hint="Only if the customer has already paid. Leave it empty otherwise."
            value={down.txnRef}
            onChange={(e) => setDown({ ...down, txnRef: e.target.value })}
          />
        )}
        <Select
          label="Tenure"
          value={plan.tenureMonths}
          onChange={(e) => setPlan({ ...plan, tenureMonths: e.target.value })}
          options={[{ value: "", label: "Choose months" }, ...(emiRules?.allowedTenures || []).map((t) => ({ value: String(t), label: `${t} months` }))]}
        />
        <Input
          label="Interest % a year"
          inputMode="decimal"
          placeholder={emiRules ? String(emiRules.defaultRatePct) : ""}
          value={plan.annualRatePct}
          onChange={(e) => setPlan({ ...plan, annualRatePct: e.target.value.replace(/[^\d.]/g, "") })}
          hint={emiRules && `${emiRules.minRatePct}%–${emiRules.maxRatePct}%`}
        />
      </div>

      <p className="text-caption text-fg-muted">
        On EMI: {inr(Math.max(0, total - downPaise))} of {inr(total)} (prices include GST, as on the GST invoice).
      </p>

      {check.loading && <Skeleton className="h-14 w-full" />}
      {!check.loading && result?.ok && result.emi && (
        <Alert tone="info" title={`${result.emi.tenureMonths} EMIs of ${inr(result.emi.emi)} at ${result.emi.annualRatePct}%`}>
          Total payable {inr(result.emi.totalPayable)} · first EMI a month from today.
          {result.needsApproval && " This EMI needs a Store Admin's approval before it starts."}
        </Alert>
      )}
      {!check.loading && result && !result.ok && <ErrorList error={{ errors: result.errors }} />}
      {!complete && (
        <p className="text-xs text-fg-muted">
          The monthly EMI shows once the details above are filled in. EMI rules are in{" "}
          <Link className="text-accent hover:underline" to="/dashboard/billing/settings?tab=rules">
            Billing settings
          </Link>
          .
        </p>
      )}
    </section>
  );
}
