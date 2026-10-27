import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, MessageSquare, MessageSquareText, MoreHorizontal, Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";
import * as messageService from "../../services/message.service";
import orderService from "../../services/order.service";
import {
  Avatar,
  Badge,
  Button,
  ChannelBadge,
  ConfirmDialog,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  Drawer,
  SectionLabel,
  Skeleton,
  StatusPill,
} from "../../components/ui";
import { Notes, Tags } from "../inbox/CustomerPanel";
import { formatCurrency, formatDate, formatDateTime } from "../../utils/format";

// Messages and orders merged into one newest-first timeline
function Timeline({ customerId }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    setItems(null);
    Promise.all([
      messageService.getMessages({ customerId, limit: 30 }).catch(() => ({ data: [] })),
      orderService.getOrders({ customerId, limit: 30 }).catch(() => ({ data: [] })),
    ]).then(([messages, orders]) => {
      const events = [
        ...(messages.data || []).map((m) => ({ kind: "message", at: m.createdAt, data: m })),
        ...(orders.data || []).map((o) => ({ kind: "order", at: o.createdAt, data: o })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at));
      setItems(events.slice(0, 25));
    });
  }, [customerId]);

  if (!items) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return <p className="text-caption text-fg-muted">No messages or orders yet.</p>;

  return (
    <ol className="relative ml-2 border-l border-line">
      {items.map((item) => (
        <li key={`${item.kind}-${item.data._id}`} className="mb-4 ml-4">
          <span className="absolute -left-[9px] mt-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line bg-surface">
            {item.kind === "order" ? (
              <ShoppingCart className="h-2.5 w-2.5 text-accent" aria-hidden="true" />
            ) : (
              <MessageSquareText className="h-2.5 w-2.5 text-fg-muted" aria-hidden="true" />
            )}
          </span>
          {item.kind === "order" ? (
            <Link to={`/dashboard/orders?id=${item.data._id}`} className="group block">
              <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
                Order <span className="font-mono text-caption group-hover:underline">{item.data.orderNumber}</span>
                <span className="tabular-nums">{formatCurrency(item.data.total)}</span>
                <StatusPill status={item.data.status} />
              </p>
              <p className="text-xs text-fg-muted">{formatDateTime(item.at)}</p>
            </Link>
          ) : (
            <div>
              <p className="line-clamp-2 text-sm text-fg">
                <span className="text-fg-muted">{item.data.direction === "incoming" ? "Customer: " : "You: "}</span>
                {item.data.content?.text || item.data.content?.caption || `[${item.data.type}]`}
              </p>
              <p className="text-xs text-fg-muted">{formatDateTime(item.at)}</p>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function CustomerDrawer({ customer, open, onOpenChange, onChange, onEdit, onBlock, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const since = useMemo(() => customer && formatDate(customer.createdAt), [customer]);
  if (!customer) return null;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title={customer.name}
        description={`Customer since ${since}`}
        footer={
          <>
            <DropdownMenu>
              <DropdownTrigger asChild>
                <Button variant="ghost" icon={MoreHorizontal} className="mr-auto">
                  More
                </Button>
              </DropdownTrigger>
              <DropdownContent align="start">
                <DropdownItem icon={Pencil} onSelect={() => onEdit(customer)}>
                  Edit details
                </DropdownItem>
                <DropdownItem icon={Ban} onSelect={() => onBlock(customer)}>
                  {customer.isBlocked ? "Unblock" : "Block"}
                </DropdownItem>
                <DropdownItem icon={Trash2} danger onSelect={() => setConfirmDelete(true)}>
                  Delete customer
                </DropdownItem>
              </DropdownContent>
            </DropdownMenu>
            <Button as={Link} to={`/dashboard/orders?new=1&customer=${customer._id}`} variant="secondary" icon={Plus}>
              New order
            </Button>
            <Button as={Link} to={`/dashboard/messages?customer=${customer._id}`} icon={MessageSquare}>
              Message
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={customer.name} size="lg" platform={customer.platform} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ChannelBadge platform={customer.platform} />
                {customer.isBlocked && <Badge tone="danger">Blocked</Badge>}
              </div>
              <p className="mt-1 text-sm text-fg">{customer.phone || "No phone"}</p>
              {customer.email && <p className="truncate text-caption text-fg-muted">{customer.email}</p>}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3">
            {[
              ["Orders", customer.totalOrders || 0],
              ["Total spent", formatCurrency(customer.totalSpent)],
              ["Last message", customer.lastMessageDate ? formatDate(customer.lastMessageDate, { day: "numeric", month: "short" }) : "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line p-2.5">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="truncate text-sm font-semibold tabular-nums text-fg">{value}</dd>
              </div>
            ))}
          </dl>

          <Tags customer={customer} onChange={onChange} />

          <section>
            <SectionLabel className="mb-3">Timeline</SectionLabel>
            <Timeline customerId={customer._id} />
          </section>

          <Notes customerId={customer._id} />
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${customer.name}?`}
        description="Their profile is removed. Past orders and messages stay in your records."
        confirmLabel="Delete customer"
        onConfirm={async () => {
          await onDelete(customer);
          setConfirmDelete(false);
        }}
      />
    </>
  );
}
