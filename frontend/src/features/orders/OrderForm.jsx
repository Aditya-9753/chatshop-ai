import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import customerService from "../../services/customer.service";
import productService from "../../services/product.service";
import { Alert, Button, DetailRow, Drawer, Input, SectionLabel, Select, Textarea } from "../../components/ui";
import { formatCurrency } from "../../utils/format";

const EMPTY_ADDRESS = { name: "", phone: "", address: "", city: "", state: "", pincode: "" };

const PAYMENT_METHODS = [
  { value: "cod", label: "Cash on delivery" },
  { value: "upi", label: "UPI" },
  { value: "razorpay", label: "Razorpay" },
  { value: "other", label: "Other" },
];

/**
 * Create an order in a side drawer. Totals shown here are a preview; the
 * server recomputes them from the items.
 */
export default function OrderForm({ open, onOpenChange, initialCustomerId, onCreate }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState([]);
  const [pick, setPick] = useState({ productId: "", quantity: 1 });
  const [taxPercent, setTaxPercent] = useState(18);
  const [shipping, setShipping] = useState(50);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([customerService.getCustomers({ limit: 1000 }), productService.getProducts({ limit: 1000 })])
      .then(([c, p]) => {
        setCustomers(c.data || []);
        setProducts((p.data || []).filter((product) => product.isActive !== false));
      })
      .catch((err) => setError(err.message || "Couldn't load customers and products"));
    setCustomerId(initialCustomerId || "");
    setItems([]);
    setAddress(EMPTY_ADDRESS);
    setNotes("");
    setError("");
  }, [open, initialCustomerId]);

  // Prefill the shipping contact from the customer
  const customer = customers.find((c) => c._id === customerId);
  useEffect(() => {
    if (customer) setAddress((a) => ({ ...a, name: a.name || customer.name, phone: a.phone || customer.phone || "" }));
  }, [customer]);

  const addItem = () => {
    const product = products.find((p) => p._id === pick.productId);
    const quantity = Math.max(1, Number(pick.quantity) || 1);
    if (!product) return;
    setItems((current) => {
      const existing = current.find((item) => item.productId === product._id);
      return existing
        ? current.map((item) => (item.productId === product._id ? { ...item, quantity: item.quantity + quantity } : item))
        : [...current, { productId: product._id, name: product.name, price: product.price, quantity, stock: product.stock }];
    });
    setPick({ productId: "", quantity: 1 });
  };

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = Math.round(subtotal * (Number(taxPercent) || 0)) / 100;
    const ship = Number(shipping) || 0;
    return { subtotal, tax, shipping: ship, total: subtotal + tax + ship };
  }, [items, taxPercent, shipping]);

  const submit = async (e) => {
    e.preventDefault();
    if (!customerId) return setError("Choose a customer");
    if (items.length === 0) return setError("Add at least one item");
    setSaving(true);
    setError("");
    try {
      await onCreate({
        customerId,
        items: items.map(({ productId, name, price, quantity }) => ({ productId, name, price, quantity })),
        tax: totals.tax,
        shipping: totals.shipping,
        paymentMethod,
        shippingAddress: address,
        notes: notes.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Couldn't create the order");
    } finally {
      setSaving(false);
    }
  };

  const setField = (field) => (e) => setAddress({ ...address, [field]: e.target.value });

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="New order"
      description="Record an order taken in chat."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="order-form" loading={saving}>
            Create order · {formatCurrency(totals.total)}
          </Button>
        </>
      }
    >
      <form id="order-form" onSubmit={submit} className="flex flex-col gap-6">
        <Select label="Customer" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Choose a customer…</option>
          {customers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
              {c.phone ? ` · ${c.phone}` : ""}
            </option>
          ))}
        </Select>

        <section className="flex flex-col gap-3">
          <SectionLabel>Items</SectionLabel>
          <div className="flex items-end gap-2">
            <Select
              label="Product"
              className="flex-1"
              value={pick.productId}
              onChange={(e) => setPick({ ...pick, productId: e.target.value })}
            >
              <option value="">Choose a product…</option>
              {products.map((p) => (
                <option key={p._id} value={p._id} disabled={p.stock <= 0}>
                  {p.name} · {formatCurrency(p.price)}
                  {p.stock <= 0 ? " (out of stock)" : ""}
                </option>
              ))}
            </Select>
            <Input
              label="Qty"
              type="number"
              min={1}
              className="w-20"
              value={pick.quantity}
              onChange={(e) => setPick({ ...pick, quantity: e.target.value })}
            />
            <Button variant="secondary" icon={Plus} onClick={addItem} disabled={!pick.productId} aria-label="Add item" />
          </div>

          {items.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{item.name}</span>
                    <span className="text-caption tabular-nums text-fg-muted">
                      {item.quantity} × {formatCurrency(item.price)}
                      {item.stock != null && item.quantity > item.stock && (
                        <span className="text-warning-fg"> · only {item.stock} in stock</span>
                      )}
                    </span>
                  </span>
                  <span className="tabular-nums text-fg">{formatCurrency(item.price * item.quantity)}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    icon={Trash2}
                    aria-label={`Remove ${item.name}`}
                    onClick={() => setItems(items.filter((i) => i.productId !== item.productId))}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Tax %" type="number" min={0} step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          <Input label="Shipping ₹" type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} />
          <Select label="Payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={PAYMENT_METHODS} />
        </div>

        <dl className="rounded-lg bg-surface-2 px-3 py-1">
          <DetailRow label="Subtotal">{formatCurrency(totals.subtotal)}</DetailRow>
          <DetailRow label={`Tax (${Number(taxPercent) || 0}%)`}>{formatCurrency(totals.tax, { precise: true })}</DetailRow>
          <DetailRow label="Shipping">{formatCurrency(totals.shipping)}</DetailRow>
          <DetailRow label={<span className="font-medium text-fg">Total</span>}>
            <span className="font-semibold tabular-nums">{formatCurrency(totals.total, { precise: true })}</span>
          </DetailRow>
        </dl>

        <section className="flex flex-col gap-3">
          <SectionLabel>Shipping address</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={address.name} onChange={setField("name")} autoComplete="name" />
            <Input label="Phone" value={address.phone} onChange={setField("phone")} autoComplete="tel" />
          </div>
          <Input label="Address" value={address.address} onChange={setField("address")} autoComplete="street-address" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="City" value={address.city} onChange={setField("city")} />
            <Input label="State" value={address.state} onChange={setField("state")} />
            <Input label="PIN code" value={address.pincode} onChange={setField("pincode")} inputMode="numeric" />
          </div>
        </section>

        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} hint="Visible on the invoice" />

        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </Drawer>
  );
}
