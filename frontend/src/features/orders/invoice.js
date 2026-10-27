import { formatCurrency, formatDate } from "../../utils/format";

// Escape values before they go into the printable HTML
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const money = (value) => esc(formatCurrency(value, { precise: true }));

/**
 * Open a clean A4 invoice in a new window and print it. Users can choose
 * "Save as PDF" in the print dialog to download it.
 */
export function printInvoice(order, user) {
  const business = user?.businessInfo || {};
  const customer = order.customerId || {};
  const ship = order.shippingAddress || {};
  const due = new Date(new Date(order.createdAt).getTime() + 7 * 86400000);

  const rows = (order.items || [])
    .map(
      (item, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(item.name)}</td>
        <td class="num">${esc(item.quantity)}</td>
        <td class="num">${money(item.price)}</td>
        <td class="num">${money(item.total ?? item.price * item.quantity)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(order.orderNumber)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.5 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f0f12; margin: 0; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #5f5f6b; margin: 0 0 6px; }
  .muted { color: #5f5f6b; }
  .mono { font-family: "JetBrains Mono", ui-monospace, monospace; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #f4f4f5; }
  .paid { background: #f0fdf4; color: #15803d; }
  header { padding-bottom: 16px; border-bottom: 1px solid #e7e7ea; margin-bottom: 20px; }
  section { margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 11px; color: #5f5f6b; font-weight: 500; border-bottom: 1px solid #e7e7ea; padding: 8px 6px; }
  td { border-bottom: 1px solid #f0f0f2; padding: 8px 6px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 260px; margin-top: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 1px solid #0f0f12; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 14px; }
  footer { margin-top: 40px; font-size: 11px; color: #5f5f6b; }
</style></head>
<body>
  <header class="row">
    <div>
      <h1>${esc(business.businessName || user?.name || "Your business")}</h1>
      <div class="muted">
        ${business.address ? `${esc(business.address)}<br>` : ""}
        ${user?.phone ? `${esc(user.phone)} · ` : ""}${esc(user?.email)}
        ${business.gstNumber ? `<br>GSTIN ${esc(business.gstNumber)}` : ""}
      </div>
    </div>
    <div style="text-align:right">
      <h1>Invoice</h1>
      <div class="mono">${esc(order.orderNumber)}</div>
      <div class="muted">Issued ${esc(formatDate(order.createdAt))} · Due ${esc(formatDate(due))}</div>
      <div style="margin-top:6px"><span class="badge ${order.paymentStatus === "paid" ? "paid" : ""}">${esc(
        (order.paymentStatus || "pending").toUpperCase()
      )}</span></div>
    </div>
  </header>
  <section class="row">
    <div>
      <h2>Bill to</h2>
      <strong>${esc(customer.name || "Customer")}</strong><br>
      <span class="muted">${esc(customer.phone)}${customer.email ? `<br>${esc(customer.email)}` : ""}</span>
    </div>
    <div style="text-align:right">
      <h2>Ship to</h2>
      <strong>${esc(ship.name || customer.name || "")}</strong><br>
      <span class="muted">${esc(ship.address || "Same as billing")}${
        ship.city ? `<br>${esc(ship.city)}, ${esc(ship.state)} ${esc(ship.pincode)}` : ""
      }${ship.phone ? `<br>${esc(ship.phone)}` : ""}</span>
    </div>
  </section>
  <section>
    <table>
      <thead><tr><th>#</th><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span class="muted">Subtotal</span><span>${money(order.subtotal ?? order.total)}</span></div>
      ${order.discount ? `<div><span class="muted">Discount</span><span>− ${money(order.discount)}</span></div>` : ""}
      ${
        !order.tax
          ? ""
          : order.taxType === "cgst_sgst"
            ? `<div><span class="muted">CGST (${(order.taxRate || 0) / 2}%)</span><span>${money(order.tax / 2)}</span></div>
               <div><span class="muted">SGST (${(order.taxRate || 0) / 2}%)</span><span>${money(order.tax / 2)}</span></div>`
            : `<div><span class="muted">${order.taxType === "gst" ? "GST" : "Tax"}${order.taxRate ? ` (${order.taxRate}%)` : ""}</span><span>${money(order.tax)}</span></div>`
      }
      ${order.shipping ? `<div><span class="muted">Shipping</span><span>${money(order.shipping)}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>${money(order.total)}</span></div>
      <div><span class="muted">Payment method</span><span>${esc((order.paymentMethod || "cod").toUpperCase())}</span></div>
    </div>
  </section>
  ${order.notes ? `<section><h2>Notes</h2>${esc(order.notes)}</section>` : ""}
  <footer>Thank you for your order. This is a computer-generated invoice and needs no signature.</footer>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

// Export the given orders as a CSV file
export function exportOrdersCsv(orders) {
  const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["Order #", "Date", "Customer", "Phone", "Channel", "Items", "Total", "Status", "Payment", "Method"];
  const lines = orders.map((o) =>
    [
      o.orderNumber,
      new Date(o.createdAt).toISOString().slice(0, 10),
      o.customerId?.name,
      o.customerId?.phone,
      o.platform,
      (o.items || []).reduce((n, i) => n + (i.quantity || 0), 0),
      o.total,
      o.status,
      o.paymentStatus,
      o.paymentMethod,
    ]
      .map(cell)
      .join(",")
  );
  const blob = new Blob([[header.map(cell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
