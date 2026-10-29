const { z } = require("zod");
const { AppError } = require("../utils/helpers");

const id = z.string().regex(/^[a-f\d]{24}$/i, "ID galat hai");
const paise = z.number().int("Amount paise me integer ho").nonnegative();
const positivePaise = z.number().int("Amount paise me integer ho").positive("Amount 0 se zyada ho");
const method = z.enum(["CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "BANK"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD me do");
const stateCode = z.string().regex(/^\d{2}$/, "GST state code 2 digit ka ho (jaise 23)");
const gstin = z.string().regex(/^\d{2}[A-Z0-9]{13}$/i, "GSTIN 15 characters ka ho");
const pan = z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/i, "PAN galat hai (jaise ABCDE1234F)");

// Body check middleware: replaces req.body with the parsed value
const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
    return next(new AppError(400, errors[0], errors));
  }
  req.body = parsed.data;
  next();
};

const CheckoutIn = z.object({
  customerId: id,
  items: z
    .array(
      z.object({
        productId: id,
        imei: z.string().trim().min(4).max(40).optional(),
        qty: z.number().int().min(1).max(1000).optional(),
        price: positivePaise.optional(),
      })
    )
    .min(1, "Kam se kam ek item chahiye")
    .max(50),
  payments: z.array(z.object({ method, amount: positivePaise, txnRef: z.string().trim().max(80).optional() })).max(5).default([]),
  finance: z
    .object({
      type: z.enum(["NONE", "SHOP_EMI", "NBFC"]),
      principal: positivePaise.optional(),
      annualRatePct: z.number().min(0).max(60).optional(),
      tenureMonths: z.number().int().min(1).max(60).optional(),
      partnerId: id.optional(),
      loanAmount: positivePaise.optional(),
    })
    .default({ type: "NONE" }),
  note: z.string().max(500).optional(),
});

const EmiPreviewIn = z.object({
  storeId: id.optional(),
  principal: positivePaise,
  annualRatePct: z.number().min(0).max(60).optional(),
  tenureMonths: z.number().int().min(1).max(60),
});

const PaymentIn = z.object({ method, amount: positivePaise, txnRef: z.string().trim().max(80).optional() });

const CustomerIn = z.object({
  name: z.string().trim().min(1, "Naam daalo").max(120),
  phone: z.string().trim().regex(/^\+?[\d\s-]{10,16}$/, "Mobile number galat hai"),
  email: z.string().email().optional().or(z.literal("")),
  pan: pan.optional().or(z.literal("")),
  address: z.string().max(300).optional(),
  stateCode: stateCode.optional().or(z.literal("")),
  gstin: gstin.optional().or(z.literal("")),
});
const CustomerPatch = CustomerIn.partial();

const KycIn = z.object({
  kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  pan: pan.optional(),
  docs: z.array(z.object({ type: z.enum(["PAN", "AADHAAR", "VOTER_ID", "PASSPORT", "DRIVING_LICENCE", "OTHER"]), number: z.string().trim().min(4).max(30), url: z.string().url().optional() })).max(10).optional(),
  riskGrade: z.enum(["A", "B", "C", "D"]).optional(),
  note: z.string().max(300).optional(),
});

const InventoryIn = z.object({
  productId: id,
  imeis: z.array(z.string().trim().min(4).max(40)).min(1, "Kam se kam ek IMEI daalo").max(500),
});

const ProductGstIn = z.object({
  hsn: z.string().trim().max(10).optional(),
  gstRatePct: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]).optional(),
  serialized: z.boolean().optional(),
});

const ReasonIn = z.object({ reason: z.string().trim().min(3, "Kaaran likho").max(300) });
const ForecloseIn = z.object({ method, txnRef: z.string().trim().max(80).optional(), reason: z.string().trim().max(300).optional() });
const FollowUpIn = z.object({
  outcome: z.enum(["CALLED", "NO_ANSWER", "PROMISED_TO_PAY", "VISITED", "DISPUTE", "OTHER"]),
  note: z.string().trim().max(500).optional(),
  nextActionDate: date.optional(),
});
const AssignIn = z.object({ agentId: id.nullable() });
const DecideIn = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(300).optional() });
const NbfcStatusIn = z.object({
  status: z.enum(["APPROVED", "DO_RECEIVED", "DISBURSED", "REJECTED"]),
  doNumber: z.string().trim().max(60).optional(),
  receivedAmount: paise.optional(),
  note: z.string().trim().max(300).optional(),
});

const StoreIn = z.object({
  name: z.string().trim().min(1).max(80),
  stateCode,
  invoicePrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "Prefix 2–6 letters/digits ka ho"),
  address: z.string().max(300).optional(),
  phone: z.string().max(20).optional(),
  gstin: gstin.optional().or(z.literal("")),
  active: z.boolean().optional(),
});
const StorePatch = StoreIn.partial();

const TenantIn = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  legalName: z.string().trim().max(160).optional(),
  gstin: gstin.optional().or(z.literal("")),
  stateCode: stateCode.optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(20).optional(),
});

const RoleIn = z.object({ role: z.enum(["STORE_ADMIN", "CASHIER", "ACCOUNTANT", "AGENT"]), storeId: id.nullable().optional() });
const StaffIn = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email("Email galat hai"),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, "Password kam se kam 8 characters ka ho"),
  roles: z.array(RoleIn).min(1),
});
const StaffPatch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8).optional(),
  roles: z.array(RoleIn).min(1).optional(),
  staffActive: z.boolean().optional(),
});

const SettingsIn = z.record(z.any());
const TenantStatusIn = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "REJECTED"]), reason: z.string().trim().max(300).optional() });
const StaffDecideIn = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(300).optional() });
const SuperStaffIn = StaffIn.extend({ tenantId: id });
const PartnerIn = z.object({
  name: z.string().trim().min(1).max(80),
  subventionPct: z.number().min(0).max(20),
  settlementDays: z.number().int().min(0).max(90).optional(),
  contact: z.string().max(120).optional(),
  active: z.boolean().optional(),
});
const JobIn = z.object({ asOf: date.optional() });

module.exports = {
  validate,
  CheckoutIn,
  EmiPreviewIn,
  PaymentIn,
  CustomerIn,
  CustomerPatch,
  KycIn,
  InventoryIn,
  ProductGstIn,
  ReasonIn,
  ForecloseIn,
  FollowUpIn,
  AssignIn,
  DecideIn,
  NbfcStatusIn,
  StoreIn,
  StorePatch,
  TenantIn,
  StaffIn,
  StaffPatch,
  SettingsIn,
  TenantStatusIn,
  StaffDecideIn,
  SuperStaffIn,
  PartnerIn,
  PartnerPatch: PartnerIn.partial(),
  JobIn,
};
