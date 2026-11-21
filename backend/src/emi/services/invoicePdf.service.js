const crypto = require("crypto");
const path = require("path");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const { Invoice } = require("../models/sales");
const { Store } = require("../models/platform");
const { AppError } = require("../utils/helpers");

const DEVANAGARI_FONT = path.resolve(
  __dirname,
  "../../../node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff",
);
const GRIDFS_BUCKET = "whatsappInvoicePdfs";
let gridFsIndexPromise;

function gridFs() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB must be connected to store invoice PDFs");
  if (!gridFsIndexPromise) {
    gridFsIndexPromise = db
      .collection(`${GRIDFS_BUCKET}.files`)
      .createIndex(
        { "metadata.deleteAfter": 1 },
        { name: "whatsapp_invoice_pdf_delete_after" },
      );
  }
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: GRIDFS_BUCKET });
  return { bucket, indexReady: gridFsIndexPromise };
}

function money(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format((Number(paise) || 0) / 100);
}

async function loadInvoice(tenantId, invoiceId) {
  const invoice = await Invoice.findOne({ tenantId, _id: invoiceId }).lean();
  if (!invoice) throw new AppError(404, "Invoice nahi mila");
  const store = await Store.findOne({ tenantId, _id: invoice.storeId }).lean();
  if (!store) throw new AppError(404, "Invoice store nahi mila");
  return { invoice, store };
}

function renderInvoicePdf({ invoice, store }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font(DEVANAGARI_FONT).fontSize(18).fillColor("#111827");
    doc.text("TAX INVOICE", { align: "right" });
    doc.moveDown(0.5);
    doc.font(DEVANAGARI_FONT).fontSize(11).text(invoice.seller?.storeName || store.name || "");
    doc.font(DEVANAGARI_FONT).fontSize(9).fillColor("#374151");
    doc.text(invoice.seller?.legalName || invoice.seller?.name || "");
    doc.text(invoice.seller?.address || store.address || "");
    if (invoice.seller?.gstin) doc.text(`GSTIN: ${invoice.seller.gstin}`);
    doc.moveDown(0.8);

    const top = doc.y;
    doc.font(DEVANAGARI_FONT).fontSize(10).fillColor("#111827").text("Invoice details", 42, top);
    doc.font(DEVANAGARI_FONT).fontSize(9).fillColor("#374151");
    doc.text(`Number: ${invoice.invoiceNo}`, 42, top + 16);
    doc.text(`Date: ${invoice.date || ""}`, 42, top + 30);
    doc.text(`Status: ${invoice.status || ""}`, 42, top + 44);
    doc.font(DEVANAGARI_FONT).fillColor("#111827").text("Bill to", 320, top);
    doc.font(DEVANAGARI_FONT).fontSize(9).fillColor("#374151");
    doc.text(invoice.customer?.name || "", 320, top + 16, { width: 230 });
    doc.text(invoice.customer?.phone || "", 320, top + 30, { width: 230 });
    doc.text(invoice.customer?.address || "", 320, top + 44, { width: 230 });
    if (invoice.customer?.gstin) doc.text(`GSTIN: ${invoice.customer.gstin}`, 320, top + 58);
    doc.y = Math.max(top + 78, doc.y + 8);

    const columns = { item: 42, hsn: 290, qty: 350, taxable: 390, gst: 455, total: 510 };
    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(42, y, 511, 20).fill("#f3f4f6");
      doc.fillColor("#111827").font(DEVANAGARI_FONT).fontSize(8);
      doc.text("Item", columns.item + 4, y + 6, { width: 230 });
      doc.text("HSN", columns.hsn, y + 6, { width: 50 });
      doc.text("Qty", columns.qty, y + 6, { width: 30, align: "right" });
      doc.text("Taxable", columns.taxable, y + 6, { width: 60, align: "right" });
      doc.text("GST", columns.gst, y + 6, { width: 45, align: "right" });
      doc.text("Total", columns.total, y + 6, { width: 40, align: "right" });
      doc.y = y + 24;
    };
    drawTableHeader();

    for (const line of invoice.lines || []) {
      if (doc.y > 720) {
        doc.addPage();
        drawTableHeader();
      }
      const y = doc.y;
      doc.font(DEVANAGARI_FONT).fontSize(8).fillColor("#111827");
      doc.text(String(line.name || "").slice(0, 60), columns.item + 4, y, { width: 230 });
      doc.text(String(line.hsn || ""), columns.hsn, y, { width: 50 });
      doc.text(String(line.qty || 0), columns.qty, y, { width: 30, align: "right" });
      doc.text(money(line.taxable), columns.taxable, y, { width: 60, align: "right" });
      doc.text(money((line.cgst || 0) + (line.sgst || 0) + (line.igst || 0)), columns.gst, y, { width: 45, align: "right" });
      doc.text(money(line.gross), columns.total, y, { width: 40, align: "right" });
      doc.moveTo(42, y + 16).lineTo(553, y + 16).strokeColor("#e5e7eb").stroke();
      doc.y = y + 21;
    }

    if (doc.y > 680) doc.addPage();
    doc.moveDown(0.5);
    const totalX = 330;
    const totalY = doc.y;
    doc.font(DEVANAGARI_FONT).fontSize(9).fillColor("#374151");
    doc.text("Taxable", totalX, totalY);
    doc.text(money(invoice.taxable), 455, totalY, { width: 95, align: "right" });
    doc.text("CGST", totalX, totalY + 15);
    doc.text(money(invoice.cgst), 455, totalY + 15, { width: 95, align: "right" });
    doc.text("SGST", totalX, totalY + 30);
    doc.text(money(invoice.sgst), 455, totalY + 30, { width: 95, align: "right" });
    doc.text("IGST", totalX, totalY + 45);
    doc.text(money(invoice.igst), 455, totalY + 45, { width: 95, align: "right" });
    doc.font(DEVANAGARI_FONT).fontSize(11).fillColor("#111827");
    doc.text("Grand total", totalX, totalY + 66);
    doc.text(money(invoice.grossTotal), 455, totalY + 66, { width: 95, align: "right" });
    doc.font(DEVANAGARI_FONT).fontSize(9);
    doc.text(`Paid: ${money(invoice.amountPaid ?? invoice.paidAtSale)}`, totalX, totalY + 84);
    if (invoice.balanceDue > 0) doc.text(`Balance due: ${money(invoice.balanceDue)}`, totalX, totalY + 99);
    doc.end();
  });
}

function signingSecret() {
  const secret = process.env.WHATSAPP_BILL_URL_SECRET || process.env.META_APP_SECRET;
  if (!secret) throw new Error("WHATSAPP_BILL_URL_SECRET must be configured");
  return secret;
}

function signature(invoiceId, expiresAt) {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(`${invoiceId}.${expiresAt}`)
    .digest("hex");
}

function createSignedUrl(invoiceId, lifetimeMs = 10 * 60 * 1000) {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) throw new Error("PUBLIC_BASE_URL is required for WhatsApp bill delivery");
  const expiresAt = Math.floor((Date.now() + lifetimeMs) / 1000);
  const signed = signature(String(invoiceId), expiresAt);
  return `${base.replace(/\/$/, "")}/api/emi/public/invoices/${invoiceId}/pdf?expires=${expiresAt}&sig=${signed}`;
}

function assertDeliveryConfig() {
  if (!process.env.PUBLIC_BASE_URL) {
    throw new Error("PUBLIC_BASE_URL is required for WhatsApp bill delivery");
  }
  signingSecret();
}

function billSignature(jobId, expiresAt) {
  return crypto
    .createHmac("sha256", signingSecret())
    .update(`whatsapp-bill.${jobId}.${expiresAt}`)
    .digest("hex");
}

function createBillSignedUrl(jobId, lifetimeMs = 10 * 60 * 1000) {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) throw new Error("PUBLIC_BASE_URL is required for WhatsApp bill delivery");
  const expiresAt = Math.floor((Date.now() + lifetimeMs) / 1000);
  const signed = billSignature(String(jobId), expiresAt);
  return `${base.replace(/\/$/, "")}/api/emi/public/whatsapp-bills/${jobId}/pdf?expires=${expiresAt}&sig=${signed}`;
}

function verifyBillSignedUrl(jobId, expiresAt, givenSignature) {
  if (!/^\d+$/.test(String(expiresAt || "")) || !/^[a-f\d]{64}$/i.test(String(givenSignature || ""))) {
    return false;
  }
  const expiry = Number(expiresAt);
  const now = Math.floor(Date.now() / 1000);
  if (expiry <= now || expiry > now + 15 * 60) return false;
  const expected = Buffer.from(billSignature(String(jobId), expiry));
  const actual = Buffer.from(givenSignature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function storeBillPdf({ jobId, tenantId, invoiceId, buffer }) {
  const { bucket, indexReady } = gridFs();
  await indexReady;
  const upload = bucket.openUploadStream(`invoice-${invoiceId}.pdf`, {
    contentType: "application/pdf",
    metadata: {
      jobId: String(jobId),
      tenantId: String(tenantId),
      invoiceId: String(invoiceId),
      deleteAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return new Promise((resolve, reject) => {
    upload.once("error", reject);
    upload.once("finish", () => resolve(upload.id));
    upload.end(buffer);
  });
}

async function loadStoredBillPdf({ fileId, tenantId, jobId }) {
  if (!mongoose.Types.ObjectId.isValid(String(fileId || ""))) {
    throw new AppError(404, "Invoice PDF nahi mila");
  }
  const { bucket, indexReady } = gridFs();
  await indexReady;
  const file = await mongoose.connection.db
    .collection(`${GRIDFS_BUCKET}.files`)
    .findOne({
      _id: new mongoose.Types.ObjectId(fileId),
      "metadata.tenantId": String(tenantId),
      "metadata.jobId": String(jobId),
    });
  if (!file) throw new AppError(404, "Invoice PDF nahi mila");
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = bucket.openDownloadStream(file._id);
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function deleteExpiredBillPdfs(limit = 100) {
  const { bucket, indexReady } = gridFs();
  await indexReady;
  const files = await mongoose.connection.db
    .collection(`${GRIDFS_BUCKET}.files`)
    .find({ "metadata.deleteAfter": { $lte: new Date() } })
    .sort({ "metadata.deleteAfter": 1 })
    .limit(limit)
    .project({ _id: 1 })
    .toArray();
  for (const file of files) await bucket.delete(file._id);
  return files.length;
}

function verifySignedUrl(invoiceId, expiresAt, givenSignature) {
  if (!/^\d+$/.test(String(expiresAt || "")) || !/^[a-f\d]{64}$/i.test(String(givenSignature || ""))) {
    return false;
  }
  const expiry = Number(expiresAt);
  const now = Math.floor(Date.now() / 1000);
  if (expiry <= now || expiry > now + 15 * 60) return false;
  const expected = Buffer.from(signature(String(invoiceId), expiry));
  const actual = Buffer.from(givenSignature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = {
  loadInvoice,
  renderInvoicePdf,
  createSignedUrl,
  assertDeliveryConfig,
  createBillSignedUrl,
  verifyBillSignedUrl,
  storeBillPdf,
  loadStoredBillPdf,
  deleteExpiredBillPdfs,
  verifySignedUrl,
};
