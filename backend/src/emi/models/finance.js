const mongoose = require("mongoose");
const { tenantScope, Money } = require("../plugins/tenantScope");

const { ObjectId, Mixed } = mongoose.Schema.Types;

const emiContractSchema = new mongoose.Schema(
  {
    storeId: { type: ObjectId, ref: "Store", required: true },
    contractNo: { type: String, required: true },
    invoiceId: { type: ObjectId, ref: "Invoice", required: true },
    customerId: { type: ObjectId, ref: "Customer", required: true },
    principal: Money({ required: true }),
    annualRatePct: { type: Number, required: true },
    tenureMonths: { type: Number, required: true },
    emiAmount: Money(),
    gstMode: { type: String, enum: ["TAXABLE_INCLUSIVE", "TAXABLE_EXCLUSIVE", "EXEMPT"], required: true },
    gstTiming: { type: String, enum: ["PER_INSTALLMENT", "UPFRONT"], required: true },
    interState: Boolean,
    startDate: { type: String, required: true },
    totalInterest: Money(),
    totalInterestGst: Money(),
    totalPayable: Money(),
    paidPrincipal: Money(),
    paidInterest: Money(),
    paidInterestGst: Money(),
    paidLateFee: Money(),
    lateFeeWaived: Money(),
    advance: Money(),
    nextDueDate: String,
    currentDpd: { type: Number, default: 0 },
    maxDpd: { type: Number, default: 0 },
    bucket: { type: String, enum: ["CURRENT", "1-30", "31-60", "61-90", "90+"], default: "CURRENT" },
    assignedAgentId: { type: ObjectId, ref: "User", default: null },
    followUps: [
      {
        at: { type: Date, default: Date.now },
        by: { type: ObjectId, ref: "User" },
        byName: String,
        outcome: { type: String, enum: ["CALLED", "NO_ANSWER", "PROMISED_TO_PAY", "VISITED", "DISPUTE", "OTHER"], default: "CALLED" },
        note: String,
        nextActionDate: String,
      },
    ],
    status: { type: String, enum: ["PENDING_APPROVAL", "ACTIVE", "CLOSED", "FORECLOSED", "CANCELLED"], required: true },
    closedAt: Date,
    // Not wired to a provider yet
    esignStatus: { type: String, enum: ["NOT_SENT", "SENT", "SIGNED"], default: "NOT_SENT" },
    autopayMandateId: String,
  },
  { timestamps: true }
);
emiContractSchema.plugin(tenantScope);
emiContractSchema.index({ tenantId: 1, contractNo: 1 }, { unique: true });
emiContractSchema.index({ tenantId: 1, status: 1, nextDueDate: 1 });
emiContractSchema.index({ tenantId: 1, assignedAgentId: 1 });
emiContractSchema.index({ tenantId: 1, customerId: 1 });

const emiInstallmentSchema = new mongoose.Schema(
  {
    contractId: { type: ObjectId, ref: "EmiContract", required: true },
    storeId: { type: ObjectId, ref: "Store", required: true },
    customerId: { type: ObjectId, ref: "Customer", required: true },
    no: { type: Number, required: true },
    dueDate: { type: String, required: true },
    principal: Money(),
    interest: Money(),
    interestGst: Money(),
    amountDue: Money(),
    paidPrincipal: Money(),
    paidInterest: Money(),
    paidInterestGst: Money(),
    lateFee: Money(),
    lateFeeApplied: { type: Boolean, default: false },
    paidLateFee: Money(),
    lateFeeWaived: Money(),
    dpd: { type: Number, default: 0 },
    status: { type: String, enum: ["UPCOMING", "DUE", "OVERDUE", "PAID", "CANCELLED"], default: "UPCOMING" },
    paidAt: Date,
  },
  { timestamps: true }
);
emiInstallmentSchema.plugin(tenantScope);
emiInstallmentSchema.index({ status: 1, dueDate: 1 }); // overdue job
emiInstallmentSchema.index({ tenantId: 1, contractId: 1, no: 1 }, { unique: true });

// Platform-level list the Super Admin maintains (no tenant)
const nbfcPartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subventionPct: { type: Number, default: 0, min: 0, max: 20 },
    settlementDays: { type: Number, default: 7 },
    contact: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const NBFC_STATUSES = ["LOGIN", "APPROVED", "DO_RECEIVED", "DISBURSED", "REJECTED", "CANCELLED"];

const nbfcCaseSchema = new mongoose.Schema(
  {
    storeId: { type: ObjectId, ref: "Store", required: true },
    invoiceId: { type: ObjectId, ref: "Invoice", required: true },
    customerId: { type: ObjectId, ref: "Customer", required: true },
    partnerId: { type: ObjectId, ref: "NbfcPartner", required: true },
    partnerName: String,
    loanAmount: Money({ required: true }),
    subventionPct: Number,
    subvention: Money(),
    subventionGst: Money(),
    expectedPayout: Money(),
    receivedAmount: Money(),
    tenureMonths: Number,
    doNumber: String, // delivery order from the NBFC
    status: { type: String, enum: NBFC_STATUSES, default: "LOGIN" },
    history: [{ _id: false, status: String, at: { type: Date, default: Date.now }, by: ObjectId, byName: String, note: String }],
  },
  { timestamps: true }
);
nbfcCaseSchema.plugin(tenantScope);
nbfcCaseSchema.index({ tenantId: 1, status: 1 });

const journalEntrySchema = new mongoose.Schema(
  {
    storeId: { type: ObjectId, ref: "Store" },
    event: { type: String, required: true },
    refType: { type: String, required: true },
    refId: { type: ObjectId, required: true },
    date: { type: String, required: true },
    lines: [{ _id: false, account: String, dr: Money(), cr: Money() }],
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
journalEntrySchema.plugin(tenantScope);
journalEntrySchema.index({ tenantId: 1, date: 1 });
journalEntrySchema.index({ tenantId: 1, refType: 1, refId: 1 });

// The books are insert-only: a mistake is fixed with a reversal entry
const blockChange = function () {
  throw new Error("Journal entry badli ya mitayi nahi ja sakti; reversal entry banao");
};
journalEntrySchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"], blockChange);
journalEntrySchema.pre("save", function () {
  if (!this.isNew) blockChange();
});

const APPROVAL_TYPES = ["HIGH_EMI", "LATE_FEE_WAIVER", "FORECLOSURE", "INVOICE_CANCEL"];

// Maker-checker: one person asks, another decides
const approvalSchema = new mongoose.Schema(
  {
    storeId: { type: ObjectId, ref: "Store", required: true },
    type: { type: String, enum: APPROVAL_TYPES, required: true },
    refModel: { type: String, required: true },
    refId: { type: ObjectId, required: true },
    amount: Money(),
    payload: { type: Mixed, default: {} },
    reason: String,
    requestedBy: { type: ObjectId, ref: "User", required: true },
    requestedByName: String,
    decidedBy: { type: ObjectId, ref: "User" },
    decidedByName: String,
    decisionNote: String,
    decidedAt: Date,
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  },
  { timestamps: true }
);
approvalSchema.plugin(tenantScope);
approvalSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
approvalSchema.index({ tenantId: 1, refId: 1, type: 1, status: 1 });

// Reminder queue; the worker sends QUEUED rows on WhatsApp
const notificationSchema = new mongoose.Schema(
  {
    storeId: { type: ObjectId, ref: "Store" },
    customerId: { type: ObjectId, ref: "Customer", required: true },
    contractId: { type: ObjectId, ref: "EmiContract" },
    installmentId: { type: ObjectId, ref: "EmiInstallment" },
    channel: { type: String, enum: ["WHATSAPP", "SMS"], default: "WHATSAPP" },
    template: { type: String, required: true },
    payload: { type: Mixed, default: {} },
    dedupeKey: { type: String, required: true },
    status: { type: String, enum: ["QUEUED", "SENT", "FAILED", "SKIPPED"], default: "QUEUED" },
    error: String,
    messageId: { type: ObjectId, ref: "Message" },
    sentAt: Date,
  },
  { timestamps: true }
);
notificationSchema.plugin(tenantScope);
notificationSchema.index({ tenantId: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ status: 1, createdAt: 1 });

const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

module.exports = {
  EmiContract: model("EmiContract", emiContractSchema),
  EmiInstallment: model("EmiInstallment", emiInstallmentSchema),
  NbfcPartner: model("NbfcPartner", nbfcPartnerSchema),
  NbfcCase: model("NbfcCase", nbfcCaseSchema),
  JournalEntry: model("JournalEntry", journalEntrySchema),
  Approval: model("Approval", approvalSchema),
  Notification: model("Notification", notificationSchema),
  NBFC_STATUSES,
  APPROVAL_TYPES,
};
