import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import customerService from "../../services/customer.service";
import orderService from "../../services/order.service";
import { useToast } from "../../components/Toast";
import { Avatar, Button, ChannelBadge, SectionLabel, Skeleton, StatusPill } from "../../components/ui";
import { formatCurrency, formatDate, formatRelative } from "../../utils/format";

const OPEN_ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped"];

export function Tags({ customer, onChange }) {
  const toast = useToast();
  const [value, setValue] = useState("");

  const add = async (e) => {
    e.preventDefault();
    const tag = value.trim();
    if (!tag) return;
    try {
      const res = await customerService.addTag(customer._id, tag);
      onChange(res.data);
      setValue("");
    } catch (err) {
      toast.error(err.message || "Couldn't add the tag");
    }
  };

  const remove = async (tag) => {
    try {
      const res = await customerService.removeTag(customer._id, tag);
      onChange(res.data);
    } catch (err) {
      toast.error(err.message || "Couldn't remove the tag");
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Tags</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {(customer.tags || []).map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 py-0.5 pl-2 pr-1 text-xs text-fg">
            {tag}
            <button onClick={() => remove(tag)} className="rounded p-0.5 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={`Remove tag ${tag}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <form onSubmit={add} className="inline-flex">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add tag"
            aria-label="Add tag"
            className="h-6 w-24 rounded-md border border-dashed border-line-strong bg-transparent px-2 text-xs text-fg outline-none focus:border-accent"
          />
        </form>
      </div>
    </section>
  );
}

export function Notes({ customerId }) {
  const toast = useToast();
  const [notes, setNotes] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(null);
    customerService
      .getInternalNotes(customerId)
      .then((res) => setNotes(res.data || []))
      .catch(() => setNotes([]));
  }, [customerId]);

  const add = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const res = await customerService.addInternalNote(customerId, draft.trim());
      setNotes((current) => [res.data, ...(current || [])]);
      setDraft("");
    } catch (err) {
      toast.error(err.message || "Couldn't save the note");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (noteId) => {
    try {
      await customerService.deleteInternalNote(noteId);
      setNotes((current) => current.filter((n) => n._id !== noteId));
    } catch (err) {
      toast.error(err.message || "Couldn't delete the note");
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Internal notes</SectionLabel>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="Only your team sees notes"
        aria-label="New note"
        className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-2 text-caption text-fg outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
      />
      {draft.trim() && (
        <Button size="sm" variant="secondary" icon={Plus} loading={saving} onClick={add} className="self-end">
          Add note
        </Button>
      )}
      {notes === null ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        notes.map((note) => (
          <div key={note._id} className="group rounded-lg bg-warning-soft/60 px-2.5 py-2 text-caption text-fg">
            <p className="whitespace-pre-wrap break-words">{note.note}</p>
            <div className="mt-1 flex items-center justify-between text-xs text-fg-muted">
              <span>
                {note.createdByName || "You"} · {formatRelative(note.createdAt)}
              </span>
              <button onClick={() => remove(note._id)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger-fg" aria-label="Delete note">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

export default function CustomerPanel({ customerId, platform, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState(null);

  const load = useCallback(() => {
    setCustomer(null);
    setOrders(null);
    customerService
      .getCustomer(customerId)
      .then((res) => setCustomer(res.data))
      .catch(() => setCustomer(false));
    orderService
      .getOrders({ customerId, limit: 50 })
      .then((res) => setOrders(res.data || []))
      .catch(() => setOrders([]));
  }, [customerId]);

  useEffect(load, [load]);

  if (customer === null) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (customer === false) {
    return <p className="p-5 text-caption text-fg-muted">Customer details are unavailable.</p>;
  }

  const openOrders = (orders || []).filter((o) => OPEN_ORDER_STATUSES.includes(o.status));

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={customer.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{customer.name}</p>
            <ChannelBadge platform={customer.platform || platform} className="mt-1" />
          </div>
        </div>
        {onClose && <Button variant="ghost" size="icon-sm" icon={X} onClick={onClose} aria-label="Close details" className="hidden xl:inline-flex" />}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line p-2.5">
          <dt className="text-xs text-fg-muted">Orders</dt>
          <dd className="text-sm font-semibold tabular-nums text-fg">{customer.totalOrders || 0}</dd>
        </div>
        <div className="rounded-lg border border-line p-2.5">
          <dt className="text-xs text-fg-muted">Total spent</dt>
          <dd className="text-sm font-semibold tabular-nums text-fg">{formatCurrency(customer.totalSpent)}</dd>
        </div>
      </dl>

      <section className="flex flex-col gap-2 text-caption">
        <SectionLabel>Contact</SectionLabel>
        {customer.phone && (
          <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-fg hover:text-accent">
            <Phone className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" /> {customer.phone}
          </a>
        )}
        {customer.email && (
          <a href={`mailto:${customer.email}`} className="flex items-center gap-2 truncate text-fg hover:text-accent">
            <Mail className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" /> {customer.email}
          </a>
        )}
        <p className="text-fg-muted">Customer since {formatDate(customer.createdAt)}</p>
      </section>

      <Tags customer={customer} onChange={setCustomer} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Open orders</SectionLabel>
          <Link to={`/dashboard/orders?new=1&customer=${customer._id}`} className="text-xs font-medium text-accent hover:underline">
            New order
          </Link>
        </div>
        {orders === null ? (
          <Skeleton className="h-12 w-full" />
        ) : openOrders.length === 0 ? (
          <p className="flex items-center gap-2 text-caption text-fg-muted">
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" /> No open orders
          </p>
        ) : (
          openOrders.map((order) => (
            <Link
              key={order._id}
              to={`/dashboard/orders?id=${order._id}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 hover:border-line-strong transition-colors"
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs text-fg">{order.orderNumber}</span>
                <span className="text-xs tabular-nums text-fg-muted">{formatCurrency(order.total)}</span>
              </span>
              <StatusPill status={order.status} />
            </Link>
          ))
        )}
      </section>

      <Notes customerId={customer._id} />
    </div>
  );
}
