import React, { useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "../../../components/Toast";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorState, Skeleton } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";
import { inr } from "../../billing/api";
import { GATEWAY_LABELS, platformAdminApi } from "../../platformBilling/api";
import { shopName, useData } from "./shared";

const SECTIONS = [
  { key: "unfinishedCaptures", title: "Paid, but not finished", help: "The money came in, but the invoice or plan wasn't updated (for example the server stopped half way). Repair finishes it safely.", action: "Repair" },
  { key: "stuckPayments", title: "Started, no answer from the gateway", help: "Checkout opened more than 30 minutes ago and no webhook came. Check asks Razorpay what happened.", action: "Check" },
  { key: "reviewPayments", title: "Amount didn't match", help: "The gateway reported an amount we didn't ask for, or a second payment for an order already paid. Refund it from Payments, then follow up with the shop." },
  { key: "pendingRefunds", title: "Refunds waiting on the gateway", help: "Sent more than a day ago and not confirmed yet. Razorpay usually confirms within 5–7 working days." },
  { key: "failedWebhooks", title: "Webhooks that failed", help: "Signed events we received but couldn't process. Razorpay retries them; the error shows why." },
  { key: "invoiceMismatches", title: "Invoice paid amount doesn't match its payments", help: "Should never happen; tell the developer with the invoice number." },
];

function Row({ section, row, onSync, busy }) {
  if (section === "failedWebhooks") {
    return (
      <li className="px-5 py-2.5 text-sm">
        <span className="font-medium">{row.type || "event"}</span> · {row.eventId} · {formatDateTime(row.receivedAt)} · {row.attempts} tries
        <span className="block text-caption text-danger-fg">{row.error}</span>
      </li>
    );
  }
  if (section === "invoiceMismatches") {
    return (
      <li className="flex justify-between gap-3 px-5 py-2.5 text-sm">
        <span>
          {row.invoiceNo} · {shopName(row.merchant)}
        </span>
        <span className="tabular-nums">
          paid {inr(row.amountPaidPaise)} · payments {inr(row.fromPaymentsPaise)} · total {inr(row.grandTotalPaise)}
        </span>
      </li>
    );
  }
  if (section === "pendingRefunds") {
    return (
      <li className="flex justify-between gap-3 px-5 py-2.5 text-sm">
        <span>
          {row.refundRef} · {shopName(row.merchant)} · {formatDateTime(row.createdAt)} · {row.gatewayRefundId || "no gateway id"}
        </span>
        <span className="tabular-nums">{inr(row.amountPaise)}</span>
      </li>
    );
  }
  const action = SECTIONS.find((s) => s.key === section)?.action;
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {row.paymentRef} · {shopName(row.merchant)}
        </span>
        <span className="block text-caption text-fg-muted">
          {GATEWAY_LABELS[row.gateway]} · {row.gatewayOrderId || "—"} · {formatDateTime(row.capturedAt || row.createdAt)}
          {row.reviewReason ? ` · ${row.reviewReason}` : ""}
        </span>
      </span>
      <span className="tabular-nums">{inr(row.amountPaise)}</span>
      {action && (row.gateway === "RAZORPAY" || section === "unfinishedCaptures") && (
        <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy === row._id} onClick={() => onSync(row)}>
          {action}
        </Button>
      )}
    </li>
  );
}

export default function Reconciliation() {
  const toast = useToast();
  const { data, error, reload, loading } = useData(() => platformAdminApi.reconciliation(), []);
  const [busy, setBusy] = useState(null);

  const sync = async (row) => {
    setBusy(row._id);
    try {
      const { data: r } = await platformAdminApi.syncPayment(row._id);
      toast.success(r.action === "repaired" ? "Repaired" : r.action === "captured" ? "Payment found and counted" : "Checked: nothing new at the gateway");
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState title="Couldn't run the checks" description={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-caption text-fg-muted">
          Compares our payments, invoices, refunds and webhooks with each other. Checked {formatDateTime(data.checkedAt)}. Comparing with Razorpay's bank settlement report is done in the Razorpay dashboard.
        </p>
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={reload}>
          Run checks again
        </Button>
      </div>
      {data.issues === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title="Everything adds up" description="No stuck payments, mismatches, failed webhooks or waiting refunds." />
        </Card>
      ) : (
        <Alert tone="warning">{data.issues} thing{data.issues === 1 ? "" : "s"} to look at.</Alert>
      )}
      {SECTIONS.filter((s) => data[s.key]?.length).map((s) => (
        <Card key={s.key}>
          <CardHeader title={s.title} description={s.help} action={<Badge tone="warning">{data[s.key].length}</Badge>} />
          <ul className="divide-y divide-line border-t border-line">
            {data[s.key].map((row) => (
              <Row key={row._id} section={s.key} row={row} onSync={sync} busy={busy} />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
