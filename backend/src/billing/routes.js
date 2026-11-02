const crypto = require("crypto");
const express = require("express");
const { z } = require("zod");
const { protect, ownerOnly } = require("../middleware/auth.middleware");
const { isAdmin, superAdminOnly } = require("../middleware/admin.middleware");
const audit = require("../utils/audit");
const User = require("../models/User.model");
const { AppError } = require("../emi/utils/helpers");
const { PlatformInvoice, PlatformPayment } = require("./models");
const plans = require("./plans");
const settingsService = require("./settings");
const invoices = require("./invoices");
const payments = require("./payments");
const subscriptions = require("./subscriptions");
const revenue = require("./revenue");
const gateway = require("./gateway");
const { BillingError } = require("./domain");

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ok = (res, data, status = 200, message) => res.status(status).json({ success: true, ...(message && { message }), data });

// ---- Input checks ----

const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const paise = z.number().int("Amount must be whole paise").nonnegative();
const positivePaise = z.number().int("Amount must be whole paise").positive("Amount must be more than 0");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
    return next(new AppError(400, errors[0], errors));
  }
  req.body = parsed.data;
  next();
};

const limits = z
  .object({
    products: z.number().int().min(0).nullable().optional(),
    staff: z.number().int().min(0).nullable().optional(),
    invoicesPerMonth: z.number().int().min(0).nullable().optional(),
  })
  .strict();

const PlanIn = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,30}$/, "Code: 2–30 lowercase letters, digits or -"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  pricePaise: paise,
  compareAtPaise: paise.optional(),
  interval: z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]),
  features: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  limits: limits.default({}),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
const PlanPatch = PlanIn.omit({ code: true }).partial();

const LineIn = z.object({
  kind: z.enum(["SUBSCRIPTION", "ADDON", "CUSTOM"]),
  description: z.string().trim().max(200).optional(),
  planCode: z.string().trim().toLowerCase().optional(),
  periodStart: date.optional(),
  periodEnd: date.optional(),
  qty: z.number().int().min(1).max(1000).optional(),
  unitPricePaise: paise.optional(),
  discountPaise: paise.optional(),
});
const ManualInvoiceIn = z
  .object({
    merchantId: id,
    lines: z.array(LineIn).min(1, "Add at least one line").max(20),
    dueDate: date.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    v.lines.forEach((l, i) => {
      if (l.kind === "SUBSCRIPTION" && (!l.planCode || !l.periodStart || !l.periodEnd)) ctx.addIssue({ code: "custom", path: ["lines", i], message: "A subscription line needs a plan and a period" });
      if (l.kind !== "SUBSCRIPTION" && (!l.description || l.unitPricePaise === undefined)) ctx.addIssue({ code: "custom", path: ["lines", i], message: "Write a description and a price" });
    });
  });
const ManualPaymentIn = z.object({
  method: z.enum(["BANK", "UPI", "CASH", "CHEQUE", "CARD", "OTHER"]),
  amountPaise: positivePaise,
  reference: z.string().trim().max(80).optional(),
  receivedOn: date.optional(),
  note: z.string().trim().max(300).optional(),
});
const RefundIn = z.object({ amountPaise: positivePaise, reason: z.string().trim().min(3, "Write the reason").max(300) });
const ReasonIn = z.object({ reason: z.string().trim().min(3, "Write the reason").max(300) });
const CheckoutIn = z.object({ planCode: z.string().trim().toLowerCase().min(1).optional(), plan: z.string().trim().toLowerCase().optional() }).refine((v) => v.planCode || v.plan, "Choose a plan");
const VerifyIn = z.object({ razorpay_order_id: z.string().min(1), razorpay_payment_id: z.string().min(1), razorpay_signature: z.string().min(1) });
const TestResultIn = z.object({ outcome: z.enum(["success", "fail"]) });
const SettingsIn = z
  .object({
    legalName: z.string(),
    gstin: z.string(),
    stateCode: z.string(),
    address: z.string(),
    email: z.string(),
    phone: z.string(),
    invoicePrefix: z.string(),
    sac: z.string(),
    gstRatePct: z.number(),
    pricesIncludeGst: z.boolean(),
    graceDays: z.number(),
    reminderDays: z.number(),
    paymentTermsDays: z.number(),
  })
  .partial()
  .strict();

const needKey = (req) => {
  const key = req.get("Idempotency-Key");
  if (!key || key.length > 100) throw new AppError(400, "Idempotency-Key header is required");
  return key;
};

const checkId = (req, res, next) => (/^[a-f\d]{24}$/i.test(req.params.id) ? next() : next(new AppError(400, "Invalid id")));

// Only shop owners have a ChatShop plan (staff and admins don't)
const shopOwner = (req, res, next) => (req.user?.role === "user" ? next() : next(new AppError(403, "Only a shop owner has a ChatShop plan")));

// One error shape: { success: false, message, errors[], code? }
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = 500;
  let message = err.message || "Something went wrong";
  let errors = [message];
  if (err instanceof AppError) {
    status = err.status;
    errors = err.errors || [message];
  } else if (err.code === 11000) {
    status = 409;
    message = "That record already exists";
    errors = [message];
  } else if (err.name === "ValidationError") {
    status = 400;
    errors = Object.values(err.errors).map((e) => e.message);
    message = errors[0];
  } else if (err.name === "CastError") {
    status = 400;
    message = "Invalid id";
    errors = [message];
  } else {
    console.error(`Billing error (${req.method} ${req.originalUrl}):`, err);
    message = "Something went wrong on our side. Please try again.";
    errors = [message];
  }
  res.status(status).json({ success: false, message, errors, ...(err.code && typeof err.code === "string" && { code: err.code }) });
};

// ==================== Shop owner: /api/subscriptions ====================

const merchant = express.Router();

const taxNote = (s) => ({ gstRegistered: s.gstRegistered, gstRatePct: s.gstRegistered ? s.gstRatePct : 0, pricesIncludeGst: s.pricesIncludeGst });

merchant.get(
  "/plans",
  ah(async (req, res) => {
    const [rows, settings] = await Promise.all([plans.listPlans(), settingsService.getBillingSettings()]);
    ok(res, { plans: rows.map(plans.publicPlan), tax: taxNote(settings), gateway: gateway.publicConfig().mode });
  })
);

merchant.use(protect, shopOwner);

const current = ah(async (req, res) => {
  const settings = await settingsService.getBillingSettings();
  const sub = req.user.subscription || {};
  const [plan, due, usage] = await Promise.all([
    sub.plan ? plans.currentPlan(sub.plan) : null,
    PlatformInvoice.aggregate([{ $match: { merchantId: req.user._id, documentType: "INVOICE", status: "ISSUED", balanceDuePaise: { $gt: 0 } } }, { $group: { _id: null, paise: { $sum: "$balanceDuePaise" }, count: { $sum: 1 } } }]),
    Promise.all(["products", "staff", "invoicesPerMonth"].map((k) => subscriptions.usageOf(req.user._id, k))),
  ]);
  ok(res, {
    subscription: subscriptions.describe(sub, settings.graceDays),
    plan: plan && plans.publicPlan(plan),
    usage: { products: usage[0], staff: usage[1], invoicesPerMonth: usage[2] },
    outstanding: { paise: due[0]?.paise || 0, count: due[0]?.count || 0 },
    graceDays: settings.graceDays,
    tax: taxNote(settings),
    gateway: gateway.publicConfig(),
  });
});
merchant.get("/current", current);
merchant.get("/details", current); // older name

const checkout = ah(async (req, res) => {
  const result = await payments.startCheckout(req.user, req.body.planCode || req.body.plan, needKey(req));
  ok(res, result, result.duplicate ? 200 : 201);
});
merchant.post("/checkout", ownerOnly, validate(CheckoutIn), checkout);
merchant.post("/create", ownerOnly, validate(CheckoutIn), checkout); // older name

merchant.post("/verify", ownerOnly, validate(VerifyIn), ah(async (req, res) => ok(res, await payments.verifyCheckout(req.user, req.body))));
merchant.get("/payments/:ref", ah(async (req, res) => ok(res, await payments.paymentView(req.user._id, req.params.ref))));
merchant.post("/payments/:ref/test-result", ownerOnly, validate(TestResultIn), ah(async (req, res) => ok(res, await payments.mockPay(req.user, req.params.ref, req.body.outcome))));

merchant.post(
  "/cancel",
  ownerOnly,
  ah(async (req, res) => {
    await subscriptions.cancelAtPeriodEnd(req.user._id, req.user._id);
    await audit(req, "subscription.cancel", { target: req.user.email, details: "Ends at period end" });
    ok(res, subscriptions.describe((await User.findById(req.user._id).select("subscription")).subscription), 200, "Your plan will end at the end of this period");
  })
);
merchant.post(
  "/resume",
  ownerOnly,
  ah(async (req, res) => {
    await subscriptions.resume(req.user._id, req.user._id);
    await audit(req, "subscription.resume", { target: req.user.email });
    ok(res, subscriptions.describe((await User.findById(req.user._id).select("subscription")).subscription), 200, "Your plan will keep renewing");
  })
);

merchant.get(
  "/invoices",
  ah(async (req, res) => {
    const rows = await PlatformInvoice.find({ merchantId: req.user._id }).sort({ issuedAt: -1 }).limit(200).select("-allocations -supplierSnapshot -customerSnapshot").lean();
    ok(res, rows);
  })
);
merchant.get("/invoices/:id", checkId, ah(async (req, res) => ok(res, await revenue.invoiceDetail(req.params.id, req.user._id))));
merchant.post("/invoices/:id/pay", ownerOnly, checkId, ah(async (req, res) => ok(res, await payments.startInvoicePayment(req.user, req.params.id, needKey(req)), 201)));
merchant.get(
  "/payments",
  ah(async (req, res) => ok(res, await PlatformPayment.find({ merchantId: req.user._id, status: { $ne: "CREATED" } }).sort({ createdAt: -1 }).limit(100).select("paymentRef purpose gateway method amountPaise status failureReason capturedAt createdAt invoiceId refundedPaise").lean()))
);

merchant.use(errorHandler);

// ==================== Super Admin: /api/admin/... ====================

const admin = express.Router();
admin.use(["/revenue", "/plans", "/platform-invoices", "/platform-payments", "/billing-settings", "/merchants"], protect, isAdmin, superAdminOnly);

admin.get("/revenue/overview", ah(async (req, res) => ok(res, await revenue.overview(req.query))));
admin.get("/revenue/transactions", ah(async (req, res) => ok(res, await revenue.transactions(req.query))));
admin.get("/revenue/reconciliation", ah(async (req, res) => ok(res, await revenue.reconciliation())));
admin.get(
  "/revenue/export/:kind",
  ah(async (req, res) => {
    const csv = await revenue.exportCsv(req.params.kind, req.query);
    await audit(req, "billing.export", { target: req.params.kind, details: `${req.query.from || ""}..${req.query.to || ""}` });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="platform-${req.params.kind}.csv"`);
    res.send(csv);
  })
);
admin.post(
  "/revenue/expiry/run",
  ah(async (req, res) => {
    const summary = await subscriptions.runExpiryJob();
    await audit(req, "billing.expiry.run", { details: JSON.stringify(summary) });
    ok(res, summary);
  })
);

admin.get("/plans", ah(async (req, res) => ok(res, await plans.listPlans({ includeInactive: true }))));
admin.get("/plans/:code/history", ah(async (req, res) => ok(res, await plans.planHistory(req.params.code))));
admin.post(
  "/plans",
  validate(PlanIn),
  ah(async (req, res) => {
    const plan = await plans.createPlan(req.body, req.user._id);
    await audit(req, "billing.plan.create", { target: plan.code, details: `${plan.name} · ${plan.pricePaise} paise ${plan.interval}` });
    ok(res, plan, 201);
  })
);
admin.patch(
  "/plans/:code",
  validate(PlanPatch),
  ah(async (req, res) => {
    const plan = await plans.updatePlan(req.params.code, req.body, req.user._id);
    await audit(req, "billing.plan.update", { target: plan.code, details: `Version ${plan.version}: ${Object.keys(req.body).join(", ")}` });
    ok(res, plan);
  })
);

admin.get("/platform-invoices", ah(async (req, res) => ok(res, await revenue.listInvoices(req.query))));
admin.get("/platform-invoices/:id", checkId, ah(async (req, res) => ok(res, await revenue.invoiceDetail(req.params.id))));
admin.post("/platform-invoices/preview", validate(ManualInvoiceIn), ah(async (req, res) => ok(res, await invoices.previewManual(req.body))));
admin.post(
  "/platform-invoices",
  validate(ManualInvoiceIn),
  ah(async (req, res) => {
    const invoice = await invoices.createManual(req.body, req.user._id, needKey(req));
    await audit(req, "billing.invoice.issue", { target: invoice.invoiceNo, details: `${invoice.grandTotalPaise} paise to ${req.body.merchantId}` });
    ok(res, invoice, 201);
  })
);
admin.post(
  "/platform-invoices/:id/void",
  checkId,
  validate(ReasonIn),
  ah(async (req, res) => {
    const invoice = await invoices.voidInvoice(req.params.id, req.body.reason, req.user._id);
    await audit(req, "billing.invoice.void", { target: invoice.invoiceNo, details: req.body.reason });
    ok(res, invoice);
  })
);
admin.post(
  "/platform-invoices/:id/payments",
  checkId,
  validate(ManualPaymentIn),
  ah(async (req, res) => {
    const payment = await payments.recordManualPayment(req.params.id, req.body, req.user._id, needKey(req));
    await audit(req, "billing.payment.record", { target: payment.paymentRef, details: `${payment.amountPaise} paise by ${payment.method}${payment.reference ? ` (${payment.reference})` : ""}` });
    ok(res, payment, 201);
  })
);

admin.post(
  "/platform-payments/:id/refunds",
  checkId,
  validate(RefundIn),
  ah(async (req, res) => {
    const refund = await payments.refundPayment(req.params.id, req.body, req.user._id, needKey(req));
    await audit(req, "billing.refund", { target: refund.refundRef, details: `${refund.amountPaise} paise · ${refund.status} · ${req.body.reason}` });
    ok(res, refund, 201);
  })
);
admin.post(
  "/platform-payments/:id/sync",
  checkId,
  ah(async (req, res) => {
    const result = await payments.syncPayment(req.params.id);
    await audit(req, "billing.payment.sync", { target: result.payment?.paymentRef, details: result.action });
    ok(res, result);
  })
);

admin.get("/billing-settings", ah(async (req, res) => ok(res, { ...(await settingsService.getBillingSettings()), gateway: gateway.publicConfig().mode, webhookSecretSet: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET) })));
admin.put(
  "/billing-settings",
  validate(SettingsIn),
  ah(async (req, res) => {
    const { before, after } = await settingsService.saveBillingSettings(req.body);
    const changed = Object.keys(req.body).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    await audit(req, "billing.settings", { details: changed.length ? `Changed ${changed.join(", ")}` : "No change" });
    ok(res, await settingsService.getBillingSettings());
  })
);

admin.get("/merchants/:id/billing", checkId, ah(async (req, res) => ok(res, await revenue.merchantBilling(req.params.id))));

admin.use(["/revenue", "/plans", "/platform-invoices", "/platform-payments", "/billing-settings", "/merchants"], errorHandler);

// ==================== Gateway webhook: /api/webhooks/razorpay ====================

const webhooks = express.Router();

webhooks.post(
  "/razorpay",
  ah(async (req, res) => {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) throw new BillingError(503, "RAZORPAY_WEBHOOK_SECRET is not set");
    const signature = req.get("x-razorpay-signature");
    if (!gateway.verifyWebhookSignature(req.rawBody, signature)) {
      console.warn("Rejected Razorpay webhook: bad signature", { ip: req.ip, event: req.body?.event });
      await audit(null, "billing.webhook.rejected", { details: `Bad signature for ${req.body?.event || "unknown event"} from ${req.ip}` });
      throw new BillingError(401, "Invalid signature");
    }
    // Razorpay's event id; failing that, the same body twice is the same event
    const eventId = req.get("x-razorpay-event-id") || crypto.createHash("sha256").update(req.rawBody).digest("hex");
    const result = await payments.processGatewayEvent(req.body, { gateway: "RAZORPAY", eventId, signatureVerified: true });
    ok(res, result);
  })
);
webhooks.use(errorHandler);

module.exports = { merchant, admin, webhooks };
