const mongoose = require("mongoose");

const { ObjectId, Mixed } = mongoose.Schema.Types;

// Platform billing: what ChatShop AI charges shops for using the product.
// Kept apart from a shop's own sales (src/emi): a shop's sale is never
// ChatShop revenue. Every amount is integer paise.

const Paise = (extra = {}) => ({
  type: Number,
  default: 0,
  validate: { validator: Number.isInteger, message: "{PATH} must be whole paise" },
  ...extra,
});

const INTERVALS = ["MONTHLY", "YEARLY", "ONE_TIME"];

// One row per plan version. Changing a plan adds a new version, so old
// invoices and subscriptions keep pointing at what was actually sold.
const planSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,30}$/ },
    version: { type: Number, required: true, min: 1 },
    isCurrent: { type: Boolean, default: true },
    name: { type: String, required: true, trim: true },
    description: String,
    pricePaise: Paise({ required: true }),
    compareAtPaise: Paise(), // struck-through "was" price
    interval: { type: String, enum: INTERVALS, required: true },
    features: [{ type: String, trim: true }],
    // null = unlimited. Checked on the server when a shop adds more.
    limits: {
      products: { type: Number, default: null },
      staff: { type: Number, default: null },
      invoicesPerMonth: { type: Number, default: null },
    },
    isActive: { type: Boolean, default: true }, // shown to shops for purchase
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);
planSchema.index({ code: 1, version: 1 }, { unique: true });
planSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { isCurrent: true } });

const lineSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["SUBSCRIPTION", "ADDON", "CUSTOM"], required: true },
    description: { type: String, required: true },
    sac: String,
    planCode: String,
    planVersion: Number,
    interval: { type: String, enum: INTERVALS },
    periodStart: Date,
    periodEnd: Date,
    qty: { type: Number, default: 1 },
    unitPricePaise: Paise(),
    discountPaise: Paise(),
    taxablePaise: Paise(),
    taxRateBps: { type: Number, default: 0 }, // 1800 = 18%
    cgstPaise: Paise(),
    sgstPaise: Paise(),
    igstPaise: Paise(),
    totalPaise: Paise(),
  },
  { _id: false }
);

const partySchema = {
  name: String,
  legalName: String,
  businessName: String,
  email: String,
  phone: String,
  gstin: String,
  address: String,
  stateCode: String,
};

// Issued platform documents: tax invoices and credit notes. Once issued the
// numbers, lines, totals and both party snapshots never change; only the
// payment fields and VOID status move.
const platformInvoiceSchema = new mongoose.Schema(
  {
    documentType: { type: String, enum: ["INVOICE", "CREDIT_NOTE"], default: "INVOICE" },
    invoiceNo: { type: String, required: true },
    merchantId: { type: ObjectId, ref: "User", required: true },
    invoiceType: { type: String, enum: ["SUBSCRIPTION", "ADDON", "CUSTOM", "MIXED"], required: true },
    source: { type: String, enum: ["CHECKOUT", "MANUAL", "REFUND"], required: true },
    status: { type: String, enum: ["ISSUED", "VOID"], default: "ISSUED" },
    paymentStatus: { type: String, enum: ["UNPAID", "PARTIALLY_PAID", "PAID", "NOT_APPLICABLE"], default: "UNPAID" },
    invoiceDate: { type: String, required: true }, // YYYY-MM-DD, India time
    issuedAt: { type: Date, default: Date.now },
    dueDate: String,
    currency: { type: String, default: "INR" },
    lines: [lineSchema],
    subtotalPaise: Paise(), // qty × unit price, before discount
    discountPaise: Paise(),
    taxablePaise: Paise(),
    cgstPaise: Paise(),
    sgstPaise: Paise(),
    igstPaise: Paise(),
    taxTotalPaise: Paise(),
    grandTotalPaise: Paise(),
    amountPaidPaise: Paise(),
    balanceDuePaise: Paise(),
    creditedPaise: Paise(), // credit notes issued against this invoice
    // Each payment counted once (the guard against double-counting)
    allocations: [{ _id: false, paymentId: { type: ObjectId, ref: "PlatformPayment" }, amountPaise: Paise(), at: { type: Date, default: Date.now } }],
    gstRegistered: Boolean,
    pricesIncludeGst: Boolean,
    interState: Boolean,
    placeOfSupply: String,
    supplierSnapshot: partySchema,
    customerSnapshot: partySchema,
    notes: String,
    paymentId: { type: ObjectId, ref: "PlatformPayment" }, // checkout invoices: the payment that created it
    originalInvoiceId: { type: ObjectId, ref: "PlatformInvoice" }, // credit notes
    refundId: { type: ObjectId, ref: "PlatformRefund" },
    reason: String,
    createdBy: { type: ObjectId, ref: "User" },
    voidedAt: Date,
    voidedBy: { type: ObjectId, ref: "User" },
    voidReason: String,
    idempotencyKey: String,
  },
  { timestamps: true }
);
platformInvoiceSchema.index({ invoiceNo: 1 }, { unique: true });
platformInvoiceSchema.index({ merchantId: 1, issuedAt: -1 });
platformInvoiceSchema.index({ invoiceDate: 1, documentType: 1 });
platformInvoiceSchema.index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: "objectId" }, documentType: "INVOICE" } });
platformInvoiceSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });

// Fields that may still change on an issued document
const MUTABLE_INVOICE_FIELDS = new Set([
  "status",
  "paymentStatus",
  "amountPaidPaise",
  "balanceDuePaise",
  "creditedPaise",
  "allocations",
  "voidedAt",
  "voidedBy",
  "voidReason",
  "updatedAt",
  "__v", // Mongoose bumps the version when allocations grow
]);

const immutable = (fields = []) => {
  throw new Error(`An issued platform invoice can't be edited${fields.length ? ` (${fields.join(", ")})` : ""}; void it or issue a credit note`);
};

platformInvoiceSchema.pre("save", function () {
  if (this.isNew) return;
  const touched = this.modifiedPaths().filter((p) => !MUTABLE_INVOICE_FIELDS.has(p.split(".")[0]));
  if (touched.length) immutable(touched);
});
platformInvoiceSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  const update = this.getUpdate() || {};
  // $setOnInsert (Mongoose's createdAt) only applies to a new document
  const keys = Object.entries(update)
    .filter(([k]) => k !== "$setOnInsert")
    .flatMap(([k, v]) => (k.startsWith("$") ? Object.keys(v || {}) : [k]));
  const touched = keys.filter((k) => !MUTABLE_INVOICE_FIELDS.has(k.split(".")[0]));
  if (touched.length) immutable(touched);
});
platformInvoiceSchema.pre(["replaceOne", "deleteOne", "deleteMany", "findOneAndDelete", "findOneAndReplace"], function () {
  immutable();
});

// Every attempt to pay ChatShop: a gateway order, or money the Super Admin
// records by hand. CREATED -> CAPTURED | FAILED; REVIEW when the gateway
// reports an amount we did not ask for.
const platformPaymentSchema = new mongoose.Schema(
  {
    paymentRef: { type: String, required: true },
    merchantId: { type: ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: ["SUBSCRIPTION_CHECKOUT", "INVOICE_PAYMENT"], required: true },
    invoiceId: { type: ObjectId, ref: "PlatformInvoice", default: null },
    // What a checkout buys, fixed when the order is created
    plan: {
      code: String,
      version: Number,
      name: String,
      interval: { type: String, enum: INTERVALS },
      pricePaise: Number,
      // GST rules at checkout, so the invoice matches the amount charged
      tax: { gstRegistered: Boolean, gstRatePct: Number, pricesIncludeGst: Boolean },
    },
    gateway: { type: String, enum: ["RAZORPAY", "MOCK", "MANUAL"], required: true },
    method: String, // card / upi / netbanking from the gateway; CASH, BANK… for manual
    gatewayOrderId: String,
    gatewayPaymentId: String,
    amountPaise: Paise({ required: true }),
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["CREATED", "CAPTURED", "FAILED", "REVIEW"], default: "CREATED" },
    failureReason: String,
    reviewReason: String,
    capturedAt: Date,
    refundedPaise: Paise(), // processed refunds
    refundReservedPaise: Paise(), // pending + processed refunds
    reference: String, // manual: cheque no., UTR…
    note: String,
    receivedOn: String,
    recordedBy: { type: ObjectId, ref: "User" },
    lastSyncedAt: Date,
    history: [{ _id: false, status: String, at: { type: Date, default: Date.now }, source: String, note: String }],
    idempotencyKey: String,
  },
  { timestamps: true }
);
platformPaymentSchema.index({ paymentRef: 1 }, { unique: true });
platformPaymentSchema.index({ gateway: 1, gatewayPaymentId: 1 }, { unique: true, partialFilterExpression: { gatewayPaymentId: { $type: "string" } } });
platformPaymentSchema.index({ gatewayOrderId: 1 });
platformPaymentSchema.index({ merchantId: 1, createdAt: -1 });
platformPaymentSchema.index({ status: 1, createdAt: -1 });
platformPaymentSchema.index({ merchantId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });

// Webhook deliveries, one row per gateway event id: a repeat is skipped
const paymentEventSchema = new mongoose.Schema(
  {
    gateway: { type: String, required: true },
    eventId: { type: String, required: true },
    type: String,
    signatureVerified: { type: Boolean, default: false },
    receivedAt: { type: Date, default: Date.now },
    processedAt: Date,
    attempts: { type: Number, default: 0 },
    result: Mixed,
    error: String,
    // Ids only; card and contact details from the gateway are not kept
    summary: { orderId: String, paymentId: String, refundId: String, amount: Number, status: String },
  },
  { timestamps: false }
);
paymentEventSchema.index({ gateway: 1, eventId: 1 }, { unique: true });
paymentEventSchema.index({ processedAt: 1, receivedAt: -1 });

const platformRefundSchema = new mongoose.Schema(
  {
    refundRef: { type: String, required: true },
    paymentId: { type: ObjectId, ref: "PlatformPayment", required: true },
    invoiceId: { type: ObjectId, ref: "PlatformInvoice" },
    merchantId: { type: ObjectId, ref: "User", required: true },
    amountPaise: Paise({ required: true }),
    reason: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "PROCESSED", "FAILED"], default: "PENDING" },
    gateway: String,
    gatewayRefundId: String,
    creditNoteId: { type: ObjectId, ref: "PlatformInvoice" },
    requestedBy: { type: ObjectId, ref: "User" },
    processedAt: Date,
    failureReason: String,
    idempotencyKey: String,
  },
  { timestamps: true }
);
platformRefundSchema.index({ refundRef: 1 }, { unique: true });
platformRefundSchema.index({ paymentId: 1 });
platformRefundSchema.index({ gatewayRefundId: 1 }, { sparse: true });
platformRefundSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });

// History of a shop's plan: activations, renewals, cancellations, expiry
const subscriptionEventSchema = new mongoose.Schema(
  {
    merchantId: { type: ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["ACTIVATED", "RENEWED", "PLAN_CHANGED", "EXTENDED", "CANCEL_REQUESTED", "RESUMED", "CANCELLED", "EXPIRED", "REMINDER_SENT"],
      required: true,
    },
    planCode: String,
    periodStart: Date,
    periodEnd: Date,
    invoiceId: { type: ObjectId, ref: "PlatformInvoice" },
    paymentId: { type: ObjectId, ref: "PlatformPayment" },
    actor: { type: ObjectId, ref: "User" },
    note: String,
    dedupeKey: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
subscriptionEventSchema.index({ merchantId: 1, createdAt: -1 });
subscriptionEventSchema.index({ type: 1, createdAt: -1 });
subscriptionEventSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });

// Gap-free platform sequences (invoice numbers per financial year)
const billingCounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

module.exports = {
  Plan: model("Plan", planSchema),
  PlatformInvoice: model("PlatformInvoice", platformInvoiceSchema),
  PlatformPayment: model("PlatformPayment", platformPaymentSchema),
  PaymentEvent: model("PaymentEvent", paymentEventSchema),
  PlatformRefund: model("PlatformRefund", platformRefundSchema),
  SubscriptionEvent: model("SubscriptionEvent", subscriptionEventSchema),
  BillingCounter: model("BillingCounter", billingCounterSchema),
  INTERVALS,
};
