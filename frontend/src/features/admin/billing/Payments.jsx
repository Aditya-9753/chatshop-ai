import React, { useMemo, useState } from "react";
import { RefreshCw, RotateCcw, Wallet } from "lucide-react";
import { useToast } from "../../../components/Toast";
import { Alert, Button, DataTable, Input, Modal, Select, Textarea } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";
import { inr, newKey } from "../../billing/api";
import { GATEWAY_LABELS, platformAdminApi } from "../../platformBilling/api";
import { rupeesToPaise, shopName, StatusBadge, useData } from "./shared";

export function RefundDialog({ payment, onClose, onDone }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(payment.refundablePaise / 100));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [key] = useState(newKey());
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await platformAdminApi.refund(payment._id, { amountPaise: rupeesToPaise(amount), reason }, key);
      toast.success(data.status === "PROCESSED" ? `Refunded ${inr(data.amountPaise)}; credit note issued` : `Refund ${data.refundRef} sent to the gateway; it confirms in a few days`);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={`Refund ${payment.paymentRef}`}
      description={`${shopName(payment.merchant)} · up to ${inr(payment.refundablePaise)} can be refunded`}
      footer={
        <Button variant="danger" icon={RotateCcw} loading={busy} disabled={!amount || reason.trim().length < 3} onClick={submit}>
          Refund
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label="Amount ₹" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Textarea label="Reason" required hint="Printed on the credit note" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Alert tone="info">
          {payment.gateway === "MANUAL"
            ? "This money was recorded by hand, so return it the same way; the refund is recorded as done."
            : "The gateway sends the money back to the shop's card or account. The plan isn't changed; change it in Shops if access should end."}
        </Alert>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

export default function Payments() {
  const toast = useToast();
  const [filter, setFilter] = useState({ status: "", gateway: "" });
  const [refunding, setRefunding] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const params = useMemo(() => ({ ...filter, limit: 200 }), [filter]);
  const { data, error, loading, reload } = useData(() => platformAdminApi.transactions(params), [params]);

  const sync = async (p) => {
    setSyncing(p._id);
    try {
      const { data: result } = await platformAdminApi.syncPayment(p._id);
      const messages = {
        repaired: "Finished: invoice and plan are up to date",
        captured: "The gateway had the payment: now counted",
        "no-capture-yet": "The gateway has no completed payment for this order yet",
        "no-attempt-at-gateway": "Nobody has tried to pay this order",
        "needs-review": "This payment needs a manual review",
        "nothing-to-check": "Nothing to check for this payment",
      };
      toast.success(messages[result.action] || result.action);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(null);
    }
  };

  const columns = [
    {
      key: "paymentRef",
      header: "Payment",
      cell: (r) => (
        <span>
          <span className="block font-medium text-fg">{r.paymentRef}</span>
          <span className="block text-xs text-fg-muted">{formatDateTime(r.capturedAt || r.createdAt)}</span>
        </span>
      ),
    },
    { key: "shop", header: "Shop", sortValue: (r) => shopName(r.merchant), cell: (r) => shopName(r.merchant) },
    { key: "purpose", header: "For", hideBelow: "lg", cell: (r) => (r.purpose === "SUBSCRIPTION_CHECKOUT" ? `${r.plan?.name || "Plan"} plan` : `Invoice ${r.invoiceNo || ""}`) },
    {
      key: "gateway",
      header: "Via",
      hideBelow: "md",
      cell: (r) => (
        <span>
          {GATEWAY_LABELS[r.gateway]}
          <span className="block text-xs text-fg-muted">{[r.method, r.gatewayPaymentId || r.reference].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    {
      key: "amountPaise",
      header: "Amount",
      align: "right",
      cell: (r) => (
        <span className="tabular-nums">
          {inr(r.amountPaise)}
          {r.refundedPaise > 0 && <span className="block text-xs text-fg-muted">−{inr(r.refundedPaise)} refunded</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <span>
          <StatusBadge status={r.status} />
          {(r.failureReason || r.reviewReason) && <span className="mt-0.5 block max-w-[220px] truncate text-xs text-fg-muted" title={r.failureReason || r.reviewReason}>{r.failureReason || r.reviewReason}</span>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      sortable: false,
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {r.refundablePaise > 0 && (
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setRefunding(r)}>
              Refund
            </Button>
          )}
          {(r.status === "CREATED" || r.status === "CAPTURED") && r.gateway !== "MANUAL" && (
            <Button size="sm" variant="ghost" icon={RefreshCw} loading={syncing === r._id} onClick={() => sync(r)} aria-label="Check with the gateway" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <DataTable
        columns={columns}
        rows={data?.rows || []}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        searchable
        searchPlaceholder="Reference, order or shop"
        searchText={(r) => [r.paymentRef, r.gatewayOrderId, r.gatewayPaymentId, r.reference, shopName(r.merchant), r.merchant?.email].join(" ")}
        toolbar={
          <>
            <Select
              aria-label="Status"
              className="w-40"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              options={[
                { value: "", label: "Any status" },
                { value: "CAPTURED", label: "Paid" },
                { value: "CREATED", label: "Started, not paid" },
                { value: "FAILED", label: "Failed" },
                { value: "REVIEW", label: "Needs review" },
              ]}
            />
            <Select
              aria-label="Gateway"
              className="w-44"
              value={filter.gateway}
              onChange={(e) => setFilter({ ...filter, gateway: e.target.value })}
              options={[{ value: "", label: "Any gateway" }, ...Object.entries(GATEWAY_LABELS).map(([value, label]) => ({ value, label }))]}
            />
          </>
        }
        empty={{ icon: Wallet, title: "No payments", description: "Every attempt to pay ChatShop shows here: started, paid, failed or refunded." }}
        pageSize={20}
      />
      {refunding && (
        <RefundDialog
          payment={refunding}
          onClose={() => setRefunding(null)}
          onDone={() => {
            setRefunding(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
