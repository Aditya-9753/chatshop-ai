const { test } = require("node:test");
const assert = require("node:assert/strict");
const invoicePdf = require("../src/emi/services/invoicePdf.service");

test("invoice PDF renders bilingual shop data and totals", async () => {
  const pdf = await invoicePdf.renderInvoicePdf({
    store: { name: "ChatShop" },
    invoice: {
      invoiceNo: "CS-000001",
      date: "2026-11-17",
      status: "PAID",
      seller: { storeName: "ChatShop", address: "Indore" },
      customer: { name: "आदित्य", phone: "+919999900000" },
      lines: [
        {
          name: "फोन",
          hsn: "8517",
          qty: 1,
          taxable: 10000,
          cgst: 900,
          sgst: 900,
          igst: 0,
          gross: 11800,
        },
      ],
      taxable: 10000,
      cgst: 900,
      sgst: 900,
      igst: 0,
      grossTotal: 11800,
      amountPaid: 11800,
      balanceDue: 0,
    },
  });
  assert.ok(pdf.subarray(0, 8).toString("ascii").startsWith("%PDF-"));
  assert.ok(pdf.length > 2000);
});

test("signed invoice links are limited to short expiry and reject changes", () => {
  const oldBase = process.env.PUBLIC_BASE_URL;
  const oldSecret = process.env.WHATSAPP_BILL_URL_SECRET;
  process.env.PUBLIC_BASE_URL = "https://api.example.test";
  process.env.WHATSAPP_BILL_URL_SECRET = "test-bill-link-secret";
  try {
    const invoiceId = "65c123456789012345678901";
    const url = new URL(invoicePdf.createSignedUrl(invoiceId));
    const expires = url.searchParams.get("expires");
    const signature = url.searchParams.get("sig");
    assert.equal(invoicePdf.verifySignedUrl(invoiceId, expires, signature), true);
    assert.equal(invoicePdf.verifySignedUrl(invoiceId, expires, "0".repeat(64)), false);
    assert.equal(invoicePdf.verifySignedUrl(invoiceId, "1", signature), false);
    assert.match(url.pathname, /\/api\/emi\/public\/invoices\/65c123456789012345678901\/pdf$/);
  } finally {
    if (oldBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = oldBase;
    if (oldSecret === undefined) delete process.env.WHATSAPP_BILL_URL_SECRET;
    else process.env.WHATSAPP_BILL_URL_SECRET = oldSecret;
  }
});
