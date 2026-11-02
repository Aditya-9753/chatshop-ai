import { inr } from "../billing/api";
import { amountInWords } from "../billing/printInvoice";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (paise) => esc(inr(paise));
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

/**
 * ChatShop AI's invoice (or credit note) to a shop, printed from the saved
 * snapshot: the supplier, shop, lines and totals exactly as issued.
 * "Save as PDF" in the print dialog gives a PDF copy.
 */
export function printPlatformInvoice({ invoice, original }) {
  const s = invoice.supplierSnapshot || {};
  const c = invoice.customerSnapshot || {};
  const credit = invoice.documentType === "CREDIT_NOTE";
  const igst = invoice.igstPaise > 0;
  const gst = invoice.gstRegistered;
  const title = credit ? "CREDIT NOTE" : gst ? "TAX INVOICE" : "INVOICE";

  const rows = invoice.lines
    .map((l, i) => {
      const tax = l.cgstPaise + l.sgstPaise + l.igstPaise;
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.description)}</td>
        <td>${esc(l.sac || "")}</td>
        <td class="num">${esc(l.qty)}</td>
        <td class="num">${money(l.unitPricePaise)}</td>
        <td class="num">${l.discountPaise ? money(l.discountPaise) : "—"}</td>
        <td class="num">${money(l.taxablePaise)}</td>
        ${gst ? `<td class="num">${esc(l.taxRateBps / 100)}%<div class="muted">${money(tax)}</div></td>` : ""}
        <td class="num">${money(l.totalPaise)}</td>
      </tr>`;
    })
    .join("");

  const taxRows = gst
    ? igst
      ? `<tr><td>IGST</td><td class="num">${money(invoice.igstPaise)}</td></tr>`
      : `<tr><td>CGST</td><td class="num">${money(invoice.cgstPaise)}</td></tr><tr><td>SGST</td><td class="num">${money(invoice.sgstPaise)}</td></tr>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)} ${esc(invoice.invoiceNo)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 11.5px/1.45 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f0f12; margin: 0; }
  h1 { font-size: 18px; margin: 0; letter-spacing: .02em; }
  h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #5f5f6b; margin: 0 0 4px; }
  .muted { color: #5f5f6b; font-size: 10.5px; }
  .row { display: flex; justify-content: space-between; gap: 24px; }
  .box { border: 1px solid #e7e7ea; border-radius: 8px; padding: 10px 12px; flex: 1; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5f5f6b; border-bottom: 1px solid #0f0f12; padding: 6px; }
  td { border-bottom: 1px solid #e7e7ea; padding: 6px; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { margin-left: auto; width: 300px; margin-top: 10px; }
  .totals td { border: 0; padding: 3px 6px; }
  .grand td { border-top: 1px solid #0f0f12; font-weight: 700; font-size: 13px; padding-top: 6px; }
  .stamp { border: 2px solid; display: inline-block; padding: 2px 10px; font-weight: 700; transform: rotate(-4deg); margin-top: 6px; }
  footer { margin-top: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
</style></head>
<body>
  <div class="row" style="align-items:flex-start">
    <div>
      <h1>${esc(s.legalName || s.name)}</h1>
      <div class="muted">${esc(s.address || "")}</div>
      <div class="muted">${s.gstin ? `GSTIN ${esc(s.gstin)}` : "Not registered for GST"}${s.stateCode ? ` · State code ${esc(s.stateCode)}` : ""}</div>
      <div class="muted">${[s.email, s.phone].filter(Boolean).map(esc).join(" · ")}</div>
    </div>
    <div style="text-align:right">
      <h1>${esc(title)}</h1>
      <div><strong>${esc(invoice.invoiceNo)}</strong></div>
      <div class="muted">Date ${esc(invoice.invoiceDate)}${!credit && invoice.dueDate ? ` · Due ${esc(invoice.dueDate)}` : ""}</div>
      ${credit && original ? `<div class="muted">Against invoice ${esc(original.invoiceNo)} (${esc(original.invoiceDate)})</div>` : ""}
      ${invoice.status === "VOID" ? '<div class="stamp" style="color:#dc2626">VOID</div>' : !credit && invoice.paymentStatus === "PAID" ? '<div class="stamp" style="color:#16a34a">PAID</div>' : ""}
    </div>
  </div>

  <div class="row" style="margin-top:14px">
    <div class="box">
      <h2>Bill to</h2>
      <div><strong>${esc(c.legalName || c.businessName || c.name)}</strong></div>
      <div class="muted">${esc(c.address || "")}</div>
      <div class="muted">${c.gstin ? `GSTIN ${esc(c.gstin)} · ` : ""}${esc(c.email || "")}${c.phone ? ` · ${esc(c.phone)}` : ""}</div>
    </div>
    <div class="box">
      <h2>Supply</h2>
      <div>Place of supply: state ${esc(invoice.placeOfSupply || s.stateCode || "—")}</div>
      <div class="muted">${gst ? (igst ? "Inter-state supply (IGST)" : "Intra-state supply (CGST + SGST)") : "No GST charged"}</div>
      ${gst ? `<div class="muted">Prices ${invoice.pricesIncludeGst ? "include" : "exclude"} GST</div>` : ""}
    </div>
  </div>

  <table>
    <thead><tr>
      <th>#</th><th>Description</th><th>SAC</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Discount</th><th class="num">Taxable</th>
      ${gst ? '<th class="num">GST</th>' : ""}<th class="num">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Taxable value</td><td class="num">${money(invoice.taxablePaise)}</td></tr>
    ${taxRows}
    <tr class="grand"><td>${credit ? "Credit" : "Total"}</td><td class="num">${money(invoice.grandTotalPaise)}</td></tr>
    ${!credit ? `<tr><td>Paid</td><td class="num">${money(invoice.amountPaidPaise)}</td></tr><tr><td><strong>Balance due</strong></td><td class="num"><strong>${money(invoice.balanceDuePaise)}</strong></td></tr>` : ""}
  </table>
  <p class="muted" style="text-align:right;margin:4px 0 0">${esc(amountInWords(invoice.grandTotalPaise))}</p>
  ${invoice.notes ? `<p><strong>Notes:</strong> ${esc(invoice.notes)}</p>` : ""}
  ${credit && invoice.reason ? `<p><strong>Reason:</strong> ${esc(invoice.reason)}</p>` : ""}

  <footer>
    <div class="muted">Issued ${esc(day(invoice.issuedAt))}. This is a computer generated document.</div>
    <div style="text-align:right"><div style="height:36px"></div><div>For ${esc(s.legalName || s.name)}</div><div class="muted">Authorised signatory</div></div>
  </footer>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
