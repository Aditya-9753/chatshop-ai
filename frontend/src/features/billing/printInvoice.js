import { inr } from "./api";
import { FINANCE_LABELS, METHOD_LABELS } from "./components";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (paise) => esc(inr(paise));

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const threeDigits = (n) => [n >= 100 && `${ONES[Math.floor(n / 100)]} Hundred`, n % 100 && twoDigits(n % 100)].filter(Boolean).join(" ");

// 123456 -> "One Lakh Twenty Three Thousand Four Hundred Fifty Six" (Indian system)
function words(n) {
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${words(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

export const amountInWords = (paise) => {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${words(rupees)}${p ? ` and ${twoDigits(p)} Paise` : ""} Only`;
};

/**
 * Open a GST tax invoice (A4) in a new window and print it. "Save as PDF"
 * in the print dialog gives the customer a copy.
 */
export function printTaxInvoice({ invoice, payments = [], contract, nbfcCase }) {
  const seller = invoice.seller || {};
  const buyer = invoice.customer || {};
  const igst = invoice.igst > 0;

  const rows = invoice.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.name)}${l.imei ? `<div class="muted">IMEI ${esc(l.imei)}</div>` : ""}</td>
        <td>${esc(l.hsn || "")}</td>
        <td class="num">${esc(l.qty)}</td>
        <td class="num">${money(l.taxable)}</td>
        <td class="num">${esc(l.gstRatePct)}%</td>
        ${igst ? `<td class="num">${money(l.igst)}</td>` : `<td class="num">${money(l.cgst)}</td><td class="num">${money(l.sgst)}</td>`}
        <td class="num">${money(l.gross)}</td>
      </tr>`
    )
    .join("");

  const paymentRows = payments
    .filter((p) => p.purpose === "SALE")
    .map((p) => `<tr><td>${esc(p.receiptNo)}</td><td>${esc(METHOD_LABELS[p.method] || p.method)}${p.txnRef ? ` · ${esc(p.txnRef)}` : ""}</td><td class="num">${money(p.amount)}</td></tr>`)
    .join("");

  const finance =
    contract
      ? `<p><strong>Shop EMI:</strong> ${esc(contract.tenureMonths)} monthly installments of ${money(contract.emiAmount)} at ${esc(contract.annualRatePct)}% p.a. (reducing balance), first due ${esc(contract.nextDueDate || "")}. Contract ${esc(contract.contractNo)}.</p>`
      : nbfcCase
        ? `<p><strong>NBFC finance:</strong> ${money(nbfcCase.loanAmount)} financed by ${esc(nbfcCase.partnerName)}${nbfcCase.doNumber ? `, DO ${esc(nbfcCase.doNumber)}` : ""}.</p>`
        : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Tax Invoice ${esc(invoice.invoiceNo)}</title>
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
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #5f5f6b; border-bottom: 1px solid #0f0f12; padding: 6px 6px; }
  td { border-bottom: 1px solid #e7e7ea; padding: 6px 6px; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .totals { margin-left: auto; width: 280px; margin-top: 10px; }
  .totals td { border: 0; padding: 3px 6px; }
  .grand td { border-top: 1px solid #0f0f12; font-weight: 700; font-size: 13px; padding-top: 6px; }
  .cancel { color: #dc2626; border: 2px solid #dc2626; display: inline-block; padding: 2px 10px; font-weight: 700; transform: rotate(-4deg); }
  footer { margin-top: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
</style></head>
<body>
  <div class="row" style="align-items:flex-start">
    <div>
      <h1>${esc(seller.legalName || seller.name)}</h1>
      <div class="muted">${esc(seller.address || "")}</div>
      <div class="muted">${seller.gstin ? `GSTIN ${esc(seller.gstin)} · ` : ""}State code ${esc(seller.stateCode || "")} · ${esc(seller.storeName || "")}</div>
    </div>
    <div style="text-align:right">
      <h1>TAX INVOICE</h1>
      <div><strong>${esc(invoice.invoiceNo)}</strong></div>
      <div class="muted">Date ${esc(invoice.date)}</div>
      ${invoice.status === "CANCELLED" ? '<div class="cancel">CANCELLED</div>' : ""}
    </div>
  </div>

  <div class="row" style="margin-top:14px">
    <div class="box">
      <h2>Bill to</h2>
      <div><strong>${esc(buyer.name)}</strong></div>
      <div class="muted">${esc(buyer.phone || "")}${buyer.pan ? ` · PAN ${esc(buyer.pan)}` : ""}${buyer.gstin ? ` · GSTIN ${esc(buyer.gstin)}` : ""}</div>
      <div class="muted">${esc(buyer.address || "")}</div>
    </div>
    <div class="box">
      <h2>Supply</h2>
      <div>Place of supply: state ${esc(buyer.stateCode || seller.stateCode || "")}</div>
      <div class="muted">${igst ? "Inter-state supply (IGST)" : "Intra-state supply (CGST + SGST)"}</div>
      <div class="muted">Payment: ${esc(FINANCE_LABELS[invoice.financeType] || "")}</div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th>#</th><th>Description</th><th>HSN</th><th class="num">Qty</th><th class="num">Taxable</th><th class="num">GST</th>
      ${igst ? '<th class="num">IGST</th>' : '<th class="num">CGST</th><th class="num">SGST</th>'}
      <th class="num">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Taxable value</td><td class="num">${money(invoice.taxable)}</td></tr>
    ${igst ? `<tr><td>IGST</td><td class="num">${money(invoice.igst)}</td></tr>` : `<tr><td>CGST</td><td class="num">${money(invoice.cgst)}</td></tr><tr><td>SGST</td><td class="num">${money(invoice.sgst)}</td></tr>`}
    ${invoice.discount ? `<tr><td>Discount (included)</td><td class="num">${money(invoice.discount)}</td></tr>` : ""}
    <tr class="grand"><td>Total</td><td class="num">${money(invoice.grossTotal)}</td></tr>
  </table>
  <p class="muted" style="text-align:right;margin:4px 0 0">${esc(amountInWords(invoice.grossTotal))}</p>

  ${paymentRows ? `<h2 style="margin-top:16px">Received at sale</h2><table style="margin-top:4px"><tbody>${paymentRows}</tbody></table>` : ""}
  ${finance ? `<div style="margin-top:12px">${finance}</div>` : ""}

  <footer>
    <div class="muted">Prices are inclusive of GST. This is a computer generated invoice.</div>
    <div style="text-align:right"><div style="height:36px"></div><div>For ${esc(seller.legalName || seller.name)}</div><div class="muted">Authorised signatory</div></div>
  </footer>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
