import React, { useState } from "react";
import { AlertTriangle, Check, CreditCard, FileText, FlaskConical, Printer, Receipt } from "lucide-react";
import { useToast } from "../../components/Toast";
import { Alert, Badge, Button, Card, CardBody, CardHeader, cn, ConfirmDialog, DataTable, EmptyState, ErrorState, Modal, Skeleton } from "../../components/ui";
import { formatDate, formatDateTime } from "../../utils/format";
import usePublicSettings from "../../hooks/usePublicSettings";
import { useLoad } from "../billing/components";
import { inr, newKey } from "../billing/api";
import { GATEWAY_LABELS, INTERVAL_LABELS, PAYMENT_TONES, planApi } from "../platformBilling/api";
import { payWithRazorpay } from "../platformBilling/checkout";
import { printPlatformInvoice } from "../platformBilling/printPlatformInvoice";

const loadAll = async () => {
  const [current, plans, invoices, payments] = await Promise.all([planApi.current(), planApi.plans(), planApi.invoices(), planApi.payments()]);
  return { data: { current: current.data, plans: plans.data, invoices: invoices.data, payments: payments.data } };
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function PaymentBadge({ status }) {
  const [tone, label] = PAYMENT_TONES[status] || ["neutral", status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

// What the plan is doing right now, in one badge and one sentence
function planState(sub) {
  if (!sub.plan || sub.status === "inactive") return { tone: "neutral", label: "No plan", line: "Choose a plan below to start." };
  if (sub.status === "expired") return { tone: "danger", label: "Expired", line: `Ended on ${formatDate(sub.endDate)}. Your data is safe; renew to use ChatShop again.` };
  if (sub.status === "cancelled") return { tone: "danger", label: "Cancelled", line: `Ended on ${formatDate(sub.endDate)}. Choose a plan to come back.` };
  if (sub.inGrace) return { tone: "warning", label: "Renewal due", line: `Ended on ${formatDate(sub.endDate)}. Renew before ${formatDate(sub.graceEndsAt)} to keep access.` };
  if (sub.trial) return { tone: "accent", label: "Free trial", line: `Trial ends on ${formatDate(sub.endDate)} · ${plural(Math.max(0, sub.daysLeft), "day")} left` };
  if (sub.interval === "ONE_TIME") return { tone: "success", label: "Active", line: "Paid once; no renewal needed." };
  if (sub.cancelAtPeriodEnd) return { tone: "warning", label: "Ending", line: `Won't renew. Access until ${formatDate(sub.endDate)}.` };
  return { tone: "success", label: "Active", line: `Paid until ${formatDate(sub.endDate)} · ${plural(Math.max(0, sub.daysLeft), "day")} left` };
}

function CurrentPlan({ current, onChanged, onShowInvoices }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { subscription: sub, plan, usage, outstanding } = current;
  const state = planState(sub);
  const canCancel = sub.status === "active" && !sub.trial && sub.interval && sub.interval !== "ONE_TIME" && !sub.cancelAtPeriodEnd;
  const limits = Object.entries(plan?.limits || {}).filter(([, v]) => v !== null && v !== undefined);
  const LIMIT_NAMES = { products: "Products", staff: "Staff accounts", invoicesPerMonth: "Invoices this month" };

  const act = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      setConfirm(false);
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Current plan" />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-fg">{plan?.name || sub.plan || "No plan"}</p>
            <p className="text-caption text-fg-muted">{state.line}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={state.tone} dot>
              {state.label}
            </Badge>
            {canCancel && (
              <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
                Cancel renewal
              </Button>
            )}
            {sub.cancelAtPeriodEnd && sub.status === "active" && (
              <Button size="sm" variant="secondary" loading={busy} onClick={() => act(planApi.resume, "Your plan will keep renewing")}>
                Keep my plan
              </Button>
            )}
          </div>
        </div>

        {outstanding.count > 0 && (
          <Alert tone="warning" title={`${plural(outstanding.count, "unpaid invoice")}: ${inr(outstanding.paise)}`}>
            <button type="button" onClick={onShowInvoices} className="font-medium underline">
              See invoices and pay
            </button>
          </Alert>
        )}

        {limits.length > 0 && (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {limits.map(([k, limit]) => {
              const used = usage[k] || 0;
              return (
                <div key={k} className="rounded-lg border border-line p-3">
                  <dt className="text-xs text-fg-muted">{LIMIT_NAMES[k]}</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums text-fg">
                    {used} / {limit}
                  </dd>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-2">
                    <div className={cn("h-1.5 rounded-full", used >= limit ? "bg-danger" : "bg-accent")} style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </dl>
        )}
      </CardBody>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Stop renewing your plan?"
        description={`You keep everything until ${formatDate(sub.endDate)}. After that the plan ends; your data stays and you can come back any time.`}
        confirmLabel="Cancel renewal"
        loading={busy}
        onConfirm={() => act(planApi.cancel, "Your plan will end at the end of this period")}
      />
    </Card>
  );
}

/**
 * Confirm and pay: the order the server priced (GST included), then the
 * gateway. On the test gateway the shop picks the outcome instead of paying.
 */
function PayDialog({ order, title, current, onClose, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState(null);
  if (!order) return null;
  const mode = order.gateway?.mode;
  const sub = current.subscription;
  const switching = order.period?.kind === "PLAN_CHANGED" && sub.status === "active" && !sub.trial && sub.daysLeft > 0 && sub.interval !== "ONE_TIME";

  const finish = (result) => {
    if (!result) return; // closed without paying
    if (result.status === "CAPTURED") {
      toast.success(result.invoice ? `Paid. Invoice ${result.invoice.invoiceNo} is ready.` : "Payment received");
      onDone();
    } else if (result.status === "FAILED") {
      setError(result.failureReason || "The payment failed. Nothing was charged; you can try again.");
    } else if (result.status === "REVIEW") {
      setError("We received a payment we didn't expect. Our team will check it and contact you.");
    } else {
      setWaiting(true);
    }
  };

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      finish(await fn());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const total = order.breakdown?.totalPaise ?? order.amountPaise;
  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={order.period ? `${formatDate(order.period.start)} – ${order.plan?.interval === "ONE_TIME" ? "no end date" : formatDate(order.period.end)}` : order.invoiceNo ? `Invoice ${order.invoiceNo}` : undefined}
      footer={
        waiting ? (
          <Button variant="secondary" onClick={onDone}>
            Close
          </Button>
        ) : mode === "MOCK" ? (
          <>
            <Button variant="secondary" loading={busy === "fail"} disabled={Boolean(busy)} onClick={() => run("fail", async () => (await planApi.testResult(order.paymentRef, "fail")).data)}>
              Simulate failure
            </Button>
            <Button loading={busy === "success"} disabled={Boolean(busy)} onClick={() => run("success", async () => (await planApi.testResult(order.paymentRef, "success")).data)}>
              Simulate success · {inr(total)}
            </Button>
          </>
        ) : (
          <Button icon={CreditCard} loading={busy === "pay"} disabled={mode !== "RAZORPAY"} onClick={() => run("pay", () => payWithRazorpay(order, { title: "ChatShop AI", description: title }))}>
            Pay {inr(total)}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {order.breakdown && (
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-fg-muted">Plan price</dt>
            <dd className="text-right tabular-nums">{inr(order.breakdown.taxablePaise)}</dd>
            {order.breakdown.taxPaise > 0 && (
              <>
                <dt className="text-fg-muted">GST ({order.breakdown.gstRatePct}%)</dt>
                <dd className="text-right tabular-nums">{inr(order.breakdown.taxPaise)}</dd>
              </>
            )}
            <dt className="border-t border-line pt-1 font-semibold">Total</dt>
            <dd className="border-t border-line pt-1 text-right font-semibold tabular-nums">{inr(order.breakdown.totalPaise)}</dd>
          </dl>
        )}
        {!order.breakdown && <p className="text-sm text-fg">Amount due: <strong className="tabular-nums">{inr(order.amountPaise)}</strong></p>}
        {order.period?.kind === "RENEWED" && <Alert tone="info">Adds a new period after your current end date. You don't lose any days.</Alert>}
        {switching && (
          <Alert tone="warning" title="Your new plan starts today">
            The {plural(sub.daysLeft, "day")} left on your current plan are not carried over.
          </Alert>
        )}
        {mode === "MOCK" && (
          <Alert tone="info" title="Test gateway">
            Online payment isn't connected yet, so no money moves. Pick an outcome to see what happens. Add Razorpay keys on the server to take real payments.
          </Alert>
        )}
        {mode === "NONE" && <Alert tone="warning">Online payment isn't set up yet. Contact support to pay.</Alert>}
        {waiting && <Alert tone="info">We're waiting for the bank to confirm. Your plan and invoice update as soon as it does; you can close this window.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function Plans({ plans, tax, current, onBuy, buying }) {
  const sub = current.subscription;
  const taxLine = !tax.gstRegistered ? "Prices in INR." : tax.pricesIncludeGst ? `Prices in INR, including ${tax.gstRatePct}% GST.` : `Prices in INR, plus ${tax.gstRatePct}% GST.`;
  return (
    <Card>
      <CardHeader title="Plans" description={taxLine} />
      <CardBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = sub.plan === plan.code && sub.status === "active";
            const label = isCurrent && !sub.trial ? (plan.interval === "ONE_TIME" ? "Purchased" : "Renew") : isCurrent && sub.trial ? "Buy this plan" : "Choose plan";
            return (
              <div key={plan.code} className={cn("flex flex-col rounded-xl border p-4", isCurrent ? "border-accent bg-accent-soft/40" : "border-line")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-fg">{plan.name}</p>
                  {isCurrent && (
                    <Badge tone="accent">
                      <Check className="h-3 w-3" /> {sub.trial ? "On trial" : "Current"}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xl font-semibold tabular-nums text-fg">
                  {inr(plan.pricePaise, { whole: plan.pricePaise % 100 === 0 })}
                  <span className="text-caption font-normal text-fg-muted">{INTERVAL_LABELS[plan.interval]}</span>
                </p>
                {plan.compareAtPaise > plan.pricePaise && <p className="text-xs text-fg-muted line-through">{inr(plan.compareAtPaise, { whole: true })}</p>}
                {plan.description && <p className="mt-2 text-caption text-fg-muted">{plan.description}</p>}
                <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-caption text-fg">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  size="sm"
                  variant={isCurrent ? "secondary" : "primary"}
                  loading={buying === plan.code}
                  disabled={Boolean(buying) || (isCurrent && !sub.trial && plan.interval === "ONE_TIME")}
                  onClick={() => onBuy(plan)}
                >
                  {label}
                </Button>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

function Invoices({ invoices, onPay, paying }) {
  const toast = useToast();
  const print = async (row) => {
    try {
      const detail = (await planApi.invoice(row._id)).data;
      if (!printPlatformInvoice(detail)) toast.error("Allow pop-ups to print the invoice");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const columns = [
    {
      key: "invoiceNo",
      header: "Number",
      cell: (r) => (
        <span className="font-medium text-fg">
          {r.invoiceNo}
          {r.documentType === "CREDIT_NOTE" && <span className="block text-xs font-normal text-fg-muted">Credit note</span>}
        </span>
      ),
    },
    { key: "invoiceDate", header: "Date", hideBelow: "sm" },
    { key: "grandTotalPaise", header: "Amount", align: "right", cell: (r) => <span className="tabular-nums">{inr(r.grandTotalPaise)}</span> },
    { key: "balanceDuePaise", header: "Due", align: "right", hideBelow: "md", cell: (r) => (r.documentType === "INVOICE" && r.balanceDuePaise ? <span className="tabular-nums">{inr(r.balanceDuePaise)}</span> : "—") },
    { key: "status", header: "Status", cell: (r) => <PaymentBadge status={r.status === "VOID" ? "VOID" : r.paymentStatus} /> },
    {
      key: "actions",
      header: "",
      sortable: false,
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.documentType === "INVOICE" && r.status === "ISSUED" && r.balanceDuePaise > 0 && (
            <Button size="sm" loading={paying === r._id} disabled={Boolean(paying)} onClick={() => onPay(r)}>
              Pay
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={Printer} onClick={() => print(r)} aria-label={`Print ${r.invoiceNo}`} />
        </div>
      ),
    },
  ];
  return (
    <section id="plan-invoices">
      <h2 className="text-base font-semibold text-fg">Invoices from ChatShop</h2>
      <p className="mb-3 text-caption text-fg-muted">Tax invoices for your plan and any services, and credit notes for refunds. Print or save any of them as PDF.</p>
      <DataTable columns={columns} rows={invoices} pageSize={8} empty={{ icon: FileText, title: "No invoices yet", description: "Your first invoice appears here when you pay for a plan." }} />
    </section>
  );
}

function PaymentHistory({ payments }) {
  if (!payments.length) return null;
  return (
    <Card>
      <CardHeader title="Payment history" />
      <ul className="divide-y divide-line border-t border-line">
        {payments.map((p) => (
          <li key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg">{p.paymentRef}</span>
              <span className="block text-caption text-fg-muted">
                {GATEWAY_LABELS[p.gateway]}
                {p.method ? ` · ${p.method}` : ""} · {formatDateTime(p.capturedAt || p.createdAt)}
                {p.failureReason ? ` · ${p.failureReason}` : ""}
                {p.refundedPaise ? ` · ${inr(p.refundedPaise)} refunded` : ""}
              </span>
            </span>
            <PaymentBadge status={p.status} />
            <span className="w-28 text-right font-medium tabular-nums">{inr(p.amountPaise)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Settings → Billing: the shop's ChatShop plan, paying for it, its invoices
export default function PlanBilling() {
  const toast = useToast();
  const { supportEmail } = usePublicSettings();
  const { data, error, reload } = useLoad(loadAll);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(null);

  if (error) return <Card><ErrorState title="Couldn't load billing" description={error.message} onRetry={reload} /></Card>;
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const start = async (id, fn, title) => {
    setBusy(id);
    try {
      const res = await fn();
      setOrder({ ...res.data, title });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  const done = () => {
    setOrder(null);
    reload();
  };

  const { current, plans } = data;
  const mode = current.gateway?.mode;
  return (
    <div className="flex flex-col gap-6">
      {mode === "MOCK" && (
        <Alert tone="info" title="Test payments are on">
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" /> No real money moves until Razorpay is connected.
          </span>
        </Alert>
      )}
      <CurrentPlan current={current} onChanged={reload} onShowInvoices={() => document.getElementById("plan-invoices")?.scrollIntoView({ behavior: "smooth" })} />
      <Plans
        plans={plans.plans}
        tax={plans.tax}
        current={current}
        buying={busy}
        onBuy={(plan) => start(plan.code, () => planApi.checkout(plan.code, newKey()), `${plan.name} plan`)}
      />
      <Invoices invoices={data.invoices} paying={busy} onPay={(inv) => start(inv._id, () => planApi.payInvoice(inv._id, newKey()), `Pay invoice ${inv.invoiceNo}`)} />
      <PaymentHistory payments={data.payments} />
      {mode === "NONE" && (
        <EmptyState icon={AlertTriangle} title="Online payment isn't set up" description={`To pay for a plan, contact support${supportEmail ? ` at ${supportEmail}` : ""}.`} />
      )}
      {order && <PayDialog order={order} title={order.title} current={current} onClose={() => setOrder(null)} onDone={done} />}
      <p className="flex items-center gap-1.5 text-caption text-fg-muted">
        <Receipt className="h-3.5 w-3.5" aria-hidden="true" /> Payments are confirmed by the payment gateway directly; a closed or refreshed window never loses a payment.
      </p>
    </div>
  );
}
