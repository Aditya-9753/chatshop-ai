const mongoose = require("mongoose");
const { tenantScope, Money } = require("../plugins/tenantScope");

const { ObjectId } = mongoose.Schema.Types;

// Customers and products are ChatShop's own collections (with KYC and GST
// fields added); this file holds what the counter sale adds on top.

// One physical unit of a serialized product (a phone, by IMEI)
const inventoryItemSchema = new mongoose.Schema(
  {
    storeId: { type: ObjectId, ref: "Store", required: true },
    productId: { type: ObjectId, ref: "Product", required: true },
    imei: { type: String, required: true, trim: true },
    status: { type: String, enum: ["IN_STOCK", "SOLD"], default: "IN_STOCK" },
    invoiceId: { type: ObjectId, ref: "Invoice", default: null },
    soldAt: Date,
    addedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);
inventoryItemSchema.plugin(tenantScope);
inventoryItemSchema.index({ tenantId: 1, imei: 1 }, { unique: true });
inventoryItemSchema.index({ tenantId: 1, storeId: 1, productId: 1, status: 1 });

const lineSchema = new mongoose.Schema(
  {
    productId: { type: ObjectId, ref: "Product" },
    name: String,
    hsn: String,
    imei: String,
    qty: { type: Number, default: 1 },
    gstRatePct: Number,
    listPrice: Money(),
    unitPrice: Money(),
    discount: Money(),
    gross: Money(),
    taxable: Money(),
    cgst: Money(),
    sgst: Money(),
    igst: Money(),
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    storeId: { type: ObjectId, ref: "Store", required: true },
    invoiceNo: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    customerId: { type: ObjectId, ref: "Customer", required: true },
    customer: { name: String, phone: String, pan: String, address: String, stateCode: String, gstin: String },
    seller: { name: String, legalName: String, gstin: String, address: String, stateCode: String, storeName: String },
    lines: [lineSchema],
    grossTotal: Money(),
    taxable: Money(),
    cgst: Money(),
    sgst: Money(),
    igst: Money(),
    discount: Money(),
    paidAtSale: Money(),
    financed: Money(),
    interState: Boolean,
    financeType: { type: String, enum: ["NONE", "SHOP_EMI", "NBFC"], default: "NONE" },
    status: {
      type: String,
      enum: ["PAID", "EMI_ACTIVE", "EMI_CLOSED", "FORECLOSED", "PENDING_APPROVAL", "NBFC_PENDING", "CANCELLED"],
      required: true,
    },
    emiContractId: { type: ObjectId, ref: "EmiContract", default: null },
    nbfcCaseId: { type: ObjectId, ref: "NbfcCase", default: null },
    orderId: { type: ObjectId, ref: "Order", default: null }, // the matching ChatShop order
    idempotencyKey: String,
    note: String,
    createdBy: { type: ObjectId, ref: "User" },
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true }
);
invoiceSchema.plugin(tenantScope);
invoiceSchema.index({ tenantId: 1, invoiceNo: 1 }, { unique: true });
invoiceSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
invoiceSchema.index({ tenantId: 1, storeId: 1, createdAt: -1 });
invoiceSchema.index({ tenantId: 1, customerId: 1 });

const paymentSchema = new mongoose.Schema(
  {
    storeId: { type: ObjectId, ref: "Store", required: true },
    receiptNo: { type: String, required: true },
    date: { type: String, required: true },
    purpose: { type: String, enum: ["SALE", "EMI", "FORECLOSURE"], required: true },
    invoiceId: { type: ObjectId, ref: "Invoice" },
    emiContractId: { type: ObjectId, ref: "EmiContract" },
    customerId: { type: ObjectId, ref: "Customer" },
    method: { type: String, enum: ["CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "BANK"], required: true },
    amount: Money({ required: true }),
    mdrRatePct: { type: Number, default: 0 },
    mdr: Money(),
    gstOnMdr: Money(),
    netSettled: Money(),
    txnRef: String, // gateway / UPI reference the cashier types in
    allocations: [
      {
        _id: false,
        installmentId: { type: ObjectId, ref: "EmiInstallment" },
        no: Number,
        lateFee: Money(),
        interestGst: Money(),
        interest: Money(),
        principal: Money(),
      },
    ],
    advance: Money(),
    idempotencyKey: String,
    status: { type: String, enum: ["CAPTURED", "SETTLED", "REVERSED"], default: "SETTLED" },
    settledAt: Date,
    receivedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);
paymentSchema.plugin(tenantScope);
paymentSchema.index({ tenantId: 1, receiptNo: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
paymentSchema.index({ tenantId: 1, storeId: 1, createdAt: -1 });
paymentSchema.index({ tenantId: 1, txnRef: 1 });

const InventoryItem = mongoose.models.InventoryItem || mongoose.model("InventoryItem", inventoryItemSchema);
const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

module.exports = { InventoryItem, Invoice, Payment };
