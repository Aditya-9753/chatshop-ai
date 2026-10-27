import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, MessageSquare, Printer, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { Button, ChannelBadge, cn, ConfirmDialog, DetailRow, Drawer, SectionLabel, Select, StatusPill } from "../../components/ui";
import { formatCurrency, formatDateTime } from "../../utils/format";
import { printInvoice } from "./invoice";

export const ORDER_STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

const STATUS_OPTIONS = [...ORDER_STEPS, "cancelled"].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));
const PAYMENT_OPTIONS = ["pending", "paid", "failed", "refunded"].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));

// Pending → confirmed → processing → shipped → delivered
function Progress({ status }) {
  if (status === "cancelled") {
    return <StatusPill status="cancelled" label="This order was cancelled" />;
  }
  const current = ORDER_STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1" aria-label="Order progress">
      {ORDER_STEPS.map((step, i) => (
        <li key={step} className="flex flex-1 flex-col gap-1.5">
          <span className={cn("h-1 rounded-full", i <= current ? "bg-accent" : "bg-surface-3")} aria-hidden="true" />
          <span className={cn("text-[11px] capitalize", i <= current ? "text-fg" : "text-fg-muted")}>
            {i === current && <span className="sr-only">Current step: </span>}
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function OrderDrawer({ order, open, onOpenChange, onUpdate, onDelete }) {
  const { user } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!order) return null;
  const customer = order.customerId || {};
  const ship = order.shippingAddress || {};
  const nextStep = ORDER_STEPS[ORDER_STEPS.indexOf(order.status) + 1];

  const update = async (field, value) => {
    setSaving(field);
    try {
      await onUpdate(order, { [field]: value });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title={<span className="font-mono">{order.orderNumber}</span>}
        description={`Placed ${formatDateTime(order.createdAt)}`}
        footer={
          <>
            <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirmDelete(true)} className="mr-auto">
              Delete
            </Button>
            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => printInvoice(order, user) || toast.error("Allow pop-ups to print the invoice")}
            >
              Invoice
            </Button>
            {nextStep && order.status !== "cancelled" && (
              <Button icon={Check} loading={saving === "status"} onClick={() => update("status", nextStep)}>
                Mark {nextStep}
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <Progress status={order.status} />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Order status"
              value={order.status}
              options={STATUS_OPTIONS}
              disabled={saving === "status"}
              onChange={(e) => update("status", e.target.value)}
            />
            <Select
              label="Payment"
              value={order.paymentStatus}
              options={PAYMENT_OPTIONS}
              disabled={saving === "paymentStatus"}
              onChange={(e) => update("paymentStatus", e.target.value)}
            />
          </div>

          <section>
            <SectionLabel className="mb-2">Items</SectionLabel>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(order.items || []).map((item, i) => (
                <li key={item._id || i} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-fg">{item.name}</span>
                    <span className="text-caption tabular-nums text-fg-muted">
                      {item.quantity} × {formatCurrency(item.price)}
                    </span>
                  </span>
                  <span className="tabular-nums text-fg">{formatCurrency(item.total ?? item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 divide-y divide-line/60">
              <DetailRow label="Subtotal">{formatCurrency(order.subtotal ?? order.total)}</DetailRow>
              {order.discount > 0 && <DetailRow label="Discount">− {formatCurrency(order.discount)}</DetailRow>}
              {order.tax > 0 &&
                (order.taxType === "cgst_sgst" ? (
                  <>
                    <DetailRow label={`CGST (${(order.taxRate || 0) / 2}%)`}>{formatCurrency(order.tax / 2, { precise: true })}</DetailRow>
                    <DetailRow label={`SGST (${(order.taxRate || 0) / 2}%)`}>{formatCurrency(order.tax / 2, { precise: true })}</DetailRow>
                  </>
                ) : (
                  <DetailRow label={`${order.taxType === "gst" ? "GST" : "Tax"}${order.taxRate ? ` (${order.taxRate}%)` : ""}`}>
                    {formatCurrency(order.tax, { precise: true })}
                  </DetailRow>
                ))}
              {order.shipping > 0 && <DetailRow label="Shipping">{formatCurrency(order.shipping)}</DetailRow>}
              <DetailRow label={<span className="font-medium text-fg">Total</span>}>
                <span className="font-semibold tabular-nums">{formatCurrency(order.total)}</span>
              </DetailRow>
              <DetailRow label="Payment method">{(order.paymentMethod || "cod").toUpperCase()}</DetailRow>
            </dl>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <SectionLabel>Customer</SectionLabel>
              <ChannelBadge platform={order.platform} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
              <span className="min-w-0 text-sm">
                <span className="block truncate font-medium text-fg">{customer.name || "Customer"}</span>
                <span className="text-caption text-fg-muted">{customer.phone || customer.email}</span>
              </span>
              {customer._id && (
                <Button as={Link} to={`/dashboard/messages?customer=${customer._id}`} variant="secondary" size="sm" icon={MessageSquare}>
                  Message
                </Button>
              )}
            </div>
          </section>

          {(ship.address || ship.city) && (
            <section>
              <SectionLabel className="mb-2">Shipping address</SectionLabel>
              <address className="text-sm not-italic leading-relaxed text-fg">
                {ship.name && <span className="block font-medium">{ship.name}</span>}
                {ship.address && <span className="block">{ship.address}</span>}
                {ship.city && (
                  <span className="block">
                    {ship.city}, {ship.state} {ship.pincode}
                  </span>
                )}
                {ship.phone && <span className="block text-fg-muted">{ship.phone}</span>}
              </address>
            </section>
          )}

          {order.notes && (
            <section>
              <SectionLabel className="mb-2">Notes</SectionLabel>
              <p className="whitespace-pre-wrap text-sm text-fg">{order.notes}</p>
            </section>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete order ${order.orderNumber}?`}
        description="This removes the order permanently. Customer totals are not changed."
        confirmLabel="Delete order"
        onConfirm={async () => {
          await onDelete(order);
          setConfirmDelete(false);
        }}
      />
    </>
  );
}
