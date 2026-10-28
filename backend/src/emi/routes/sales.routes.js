const express = require("express");
const Customer = require("../../models/Customer.model");
const Product = require("../../models/Product.model");
const Order = require("../../models/Order.model");
const Conversation = require("../../models/Conversation.model");
const { Store } = require("../models/platform");
const { InventoryItem, Invoice, Payment } = require("../models/sales");
const { EmiContract, NbfcCase, Approval } = require("../models/finance");
const { buildSchedule } = require("../domain/emi");
const { fmt } = require("../domain/money");
const { need } = require("../middleware/rbac");
const { ah, AppError, scoped, audit, isOid, today } = require("../utils/helpers");
const { resolveSettings } = require("../services/settings.service");
const checkoutService = require("../services/checkout.service");
const approvalService = require("../services/approval.service");
const bridge = require("../services/bridge.service");
const s = require("./schemas");

const r = express.Router();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CUSTOMER_FIELDS = "name phone email platform pan address stateCode gstin kycStatus kycDocs kycVerifiedAt riskGrade totalOrders totalSpent createdAt";

// Store from the URL must be one of this shop's stores
const loadStore = ah(async (req, res, next) => {
  if (!isOid(req.params.storeId)) throw new AppError(400, "Store ID galat hai");
  const store = await Store.findOne({ tenantId: req.emi.tenantId, _id: req.params.storeId });
  if (!store) throw new AppError(404, "Store nahi mila");
  req.store = store;
  next();
});

// ---- Customers (ChatShop's customers, with KYC) ----

r.get(
  "/customers",
  need("customer.read"),
  ah(async (req, res) => {
    const filter = { userId: req.emi.tenantId };
    const q = String(req.query.q || "").trim();
    if (q) {
      const digits = q.replace(/\D/g, "");
      filter.$or = [{ name: new RegExp(escape(q), "i") }, { pan: q.toUpperCase() }];
      if (digits.length >= 4) filter.$or.push({ phone: new RegExp(digits.split("").join("\\D*")) });
    }
    if (req.query.kyc) filter.kycStatus = req.query.kyc;
    ok(res, await Customer.find(filter).select(CUSTOMER_FIELDS).sort({ updatedAt: -1 }).limit(Math.min(Number(req.query.limit) || 50, 200)).lean());
  })
);

// Walk-in customer. A phone number already known (say from WhatsApp) is the
// same person: 409 with that customer's id, so the sale uses them instead.
r.post(
  "/customers",
  need("customer.create"),
  s.validate(s.CustomerIn),
  ah(async (req, res) => {
    const existing = await bridge.findCustomerByPhone(req.emi.tenantId, req.body.phone);
    if (existing) {
      return res.status(409).json({ success: false, message: `Is number ka customer pehle se hai: ${existing.name}`, data: { customerId: existing._id } });
    }
    const customer = await Customer.create({
      userId: req.emi.tenantId,
      platform: "whatsapp", // a phone number is a WhatsApp contact; their first message links up
      ...req.body,
      phone: bridge.normalizePhone(req.body.phone),
      pan: req.body.pan || undefined,
      gstin: req.body.gstin || undefined,
      stateCode: req.body.stateCode || undefined,
      kycStatus: "NONE",
    });
    await audit(req, "customer.create", { entity: "Customer", entityId: customer._id, after: { name: customer.name, phone: customer.phone } });
    ok(res, customer, 201);
  })
);

const findCustomer = async (req) => {
  if (!isOid(req.params.id)) throw new AppError(400, "ID galat hai");
  const customer = await Customer.findOne({ _id: req.params.id, userId: req.emi.tenantId });
  if (!customer) throw new AppError(404, "Customer nahi mila");
  return customer;
};

r.get(
  "/customers/:id",
  need("customer.read"),
  ah(async (req, res) => {
    const customer = await findCustomer(req);
    const base = { ...scoped(req), customerId: customer._id };
    const [invoices, contracts, payments, orders, conversation] = await Promise.all([
      Invoice.find(base).sort({ createdAt: -1 }).limit(50).select("invoiceNo date grossTotal status financeType storeId").lean(),
      EmiContract.find(base).sort({ createdAt: -1 }).select("contractNo principal paidPrincipal emiAmount tenureMonths status bucket currentDpd nextDueDate").lean(),
      Payment.find(base).sort({ createdAt: -1 }).limit(50).select("receiptNo date purpose method amount status").lean(),
      Order.find({ userId: req.emi.tenantId, customerId: customer._id }).sort({ createdAt: -1 }).limit(20).select("orderNumber total status platform createdAt").lean(),
      Conversation.findOne({ userId: req.emi.tenantId, customerId: customer._id }).select("_id platform").lean(),
    ]);
    ok(res, { customer, invoices, contracts, payments, orders, conversationId: conversation?._id || null });
  })
);

r.patch(
  "/customers/:id",
  need("customer.create"),
  s.validate(s.CustomerPatch),
  ah(async (req, res) => {
    const customer = await findCustomer(req);
    const before = { name: customer.name, phone: customer.phone, pan: customer.pan, address: customer.address, stateCode: customer.stateCode };
    if (req.body.phone) req.body.phone = bridge.normalizePhone(req.body.phone);
    // PAN is part of KYC: once verified it changes only through KYC
    if (req.body.pan !== undefined && customer.kycStatus === "VERIFIED" && req.body.pan.toUpperCase() !== (customer.pan || "")) {
      throw new AppError(422, "Verified KYC ka PAN yahan nahi badal sakte; KYC dobara karo");
    }
    Object.assign(customer, Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k, v === "" ? undefined : v])));
    await customer.save();
    await audit(req, "customer.update", { entity: "Customer", entityId: customer._id, before, after: req.body });
    ok(res, customer);
  })
);

r.patch(
  "/customers/:id/kyc",
  need("customer.kyc"),
  s.validate(s.KycIn),
  ah(async (req, res) => {
    const customer = await findCustomer(req);
    const before = { kycStatus: customer.kycStatus, pan: customer.pan };
    if (req.body.pan) customer.pan = req.body.pan;
    if (req.body.docs) customer.kycDocs = req.body.docs.map((d) => ({ ...d, addedAt: new Date() }));
    if (req.body.riskGrade) customer.riskGrade = req.body.riskGrade;
    if (req.body.kycStatus === "VERIFIED") {
      if (!customer.pan && !customer.kycDocs?.length) throw new AppError(422, "Verify karne se pehle PAN ya koi document daalo");
      customer.kycVerifiedBy = req.user._id;
      customer.kycVerifiedAt = new Date();
    }
    customer.kycStatus = req.body.kycStatus;
    await customer.save();
    await audit(req, "customer.kyc", { entity: "Customer", entityId: customer._id, before, after: { kycStatus: customer.kycStatus, pan: customer.pan }, reason: req.body.note });
    ok(res, customer);
  })
);

// ---- Catalog and stock ----

r.patch(
  "/products/:id/gst",
  need("product.manage"),
  s.validate(s.ProductGstIn),
  ah(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, userId: req.emi.tenantId });
    if (!product) throw new AppError(404, "Product nahi mila");
    if (req.body.serialized !== undefined && req.body.serialized !== product.serialized) {
      const units = await InventoryItem.countDocuments({ tenantId: req.emi.tenantId, productId: product._id });
      if (units > 0) throw new AppError(409, "Is product ke IMEI pehle se hain; serialized setting nahi badal sakte");
      if (req.body.serialized) product.stock = 0;
    }
    Object.assign(product, req.body);
    await product.save();
    ok(res, product);
  })
);

// Products with price, GST and what is in stock at this store
r.get(
  "/stores/:storeId/stock",
  need("product.read"),
  loadStore,
  ah(async (req, res) => {
    const products = await Product.find({ userId: req.emi.tenantId, isActive: true }).sort({ name: 1 }).lean();
    const units = await InventoryItem.find({ tenantId: req.emi.tenantId, storeId: req.store._id, status: "IN_STOCK" }).select("productId imei").lean();
    const byProduct = new Map();
    for (const u of units) {
      if (!byProduct.has(String(u.productId))) byProduct.set(String(u.productId), []);
      byProduct.get(String(u.productId)).push(u.imei);
    }
    ok(
      res,
      products.map((p) => ({
        _id: p._id,
        name: p.name,
        image: p.images?.[0] || null,
        category: p.category,
        price: Math.round(p.price * 100),
        hsn: p.hsn || "",
        gstRatePct: p.gstRatePct ?? 18,
        serialized: Boolean(p.serialized),
        available: p.serialized ? byProduct.get(String(p._id))?.length || 0 : p.stock || 0,
        imeis: p.serialized ? byProduct.get(String(p._id)) || [] : [],
      }))
    );
  })
);

r.get(
  "/stores/:storeId/inventory",
  need("product.read"),
  loadStore,
  ah(async (req, res) => {
    const filter = { tenantId: req.emi.tenantId, storeId: req.store._id };
    if (req.query.productId && isOid(req.query.productId)) filter.productId = req.query.productId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) filter.imei = new RegExp(escape(String(req.query.q)));
    const units = await InventoryItem.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    const products = await Product.find({ _id: { $in: units.map((u) => u.productId) } }).select("name").lean();
    const names = new Map(products.map((p) => [String(p._id), p.name]));
    ok(res, units.map((u) => ({ ...u, productName: names.get(String(u.productId)) })));
  })
);

// Receive phones into a store by IMEI
r.post(
  "/stores/:storeId/inventory",
  need("product.manage"),
  loadStore,
  s.validate(s.InventoryIn),
  ah(async (req, res) => {
    const product = await Product.findOne({ _id: req.body.productId, userId: req.emi.tenantId });
    if (!product) throw new AppError(404, "Product nahi mila");
    if (!product.serialized) throw new AppError(422, `${product.name} serialized nahi hai; iska stock Products page se badlo`);
    const imeis = [...new Set(req.body.imeis.map((i) => i.trim()))];
    const taken = await InventoryItem.find({ tenantId: req.emi.tenantId, imei: { $in: imeis } }).select("imei").lean();
    const takenSet = new Set(taken.map((t) => t.imei));
    const fresh = imeis.filter((i) => !takenSet.has(i));
    if (fresh.length) {
      await InventoryItem.insertMany(fresh.map((imei) => ({ tenantId: req.emi.tenantId, storeId: req.store._id, productId: product._id, imei, addedBy: req.user._id })));
      await Product.updateOne({ _id: product._id }, { $inc: { stock: fresh.length } });
      await audit(req, "inventory.add", { entity: "Product", entityId: product._id, after: { store: req.store.name, count: fresh.length } });
    }
    ok(res, { added: fresh.length, duplicates: [...takenSet] }, 201);
  })
);

// ---- Sale ----

// Live EMI schedule for the New Sale screen
r.post(
  "/emi/preview",
  need("emi.create"),
  s.validate(s.EmiPreviewIn),
  ah(async (req, res) => {
    const settings = await resolveSettings(req.emi.tenantId, req.body.storeId);
    const rules = settings.emi;
    const rate = req.body.annualRatePct ?? rules.defaultRatePct;
    const errors = [];
    if (!rules.allowedTenures.includes(req.body.tenureMonths)) errors.push(`Tenure ${req.body.tenureMonths} mahine allowed nahi; allowed: ${rules.allowedTenures.join(", ")}`);
    if (rate < rules.minRatePct || rate > rules.maxRatePct) errors.push(`Interest rate ${rules.minRatePct}%–${rules.maxRatePct}% ke beech hona chahiye`);
    if (req.body.principal > rules.maxPrincipal) errors.push(`EMI amount ${fmt(rules.maxPrincipal)} se zyada nahi ho sakta`);
    if (errors.length) throw new AppError(422, errors[0], errors);
    const schedule = buildSchedule({ principal: req.body.principal, annualRatePct: rate, tenureMonths: req.body.tenureMonths, startDate: today(), gstMode: settings.gst.interestMode });
    ok(res, { ...schedule, gstTiming: settings.gst.interestTiming, needsApproval: req.body.principal > rules.approvalAbove, rules });
  })
);

r.post(
  "/stores/:storeId/checkout/preview",
  need("invoice.create"),
  loadStore,
  s.validate(s.CheckoutIn),
  ah(async (req, res) => {
    const result = await checkoutService.previewSale(req, req.store._id, req.body);
    ok(res, { ok: result.ok, errors: result.errors, needsApproval: result.needsApproval, invoice: result.invoice, payments: result.payments, emi: result.emi, nbfc: result.nbfc });
  })
);

r.post(
  "/stores/:storeId/checkout",
  need("invoice.create"),
  loadStore,
  s.validate(s.CheckoutIn),
  ah(async (req, res) => {
    const key = req.get("Idempotency-Key");
    if (!key) throw new AppError(400, "Idempotency-Key header chahiye");
    const result = await checkoutService.createSale(req, req.store._id, req.body, key);
    ok(res, result, result.duplicate ? 200 : 201);
  })
);

// ---- Invoices ----

r.get(
  "/invoices",
  need("invoice.read"),
  ah(async (req, res) => {
    const filter = scoped(req);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.financeType) filter.financeType = req.query.financeType;
    if (req.query.storeId && isOid(req.query.storeId)) filter.storeId = req.query.storeId;
    if (req.query.from || req.query.to) filter.date = { ...(req.query.from && { $gte: req.query.from }), ...(req.query.to && { $lte: req.query.to }) };
    if (req.query.customerId && isOid(req.query.customerId)) filter.customerId = req.query.customerId;
    if (req.query.q) {
      const q = escape(String(req.query.q));
      filter.$or = [{ invoiceNo: new RegExp(q, "i") }, { "customer.name": new RegExp(q, "i") }, { "customer.phone": new RegExp(q) }, { "lines.imei": new RegExp(q) }];
    }
    const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 200, 500)).select("-lines.listPrice").lean();
    ok(res, invoices);
  })
);

r.get(
  "/invoices/:id",
  need("invoice.read"),
  ah(async (req, res) => {
    if (!isOid(req.params.id)) throw new AppError(400, "ID galat hai");
    const invoice = await Invoice.findOne({ ...scoped(req), _id: req.params.id }).lean();
    if (!invoice) throw new AppError(404, "Invoice nahi mila");
    const tenantId = req.emi.tenantId;
    const [payments, contract, nbfcCase, approvals, store] = await Promise.all([
      Payment.find({ tenantId, invoiceId: invoice._id }).sort({ createdAt: 1 }).lean(),
      invoice.emiContractId ? EmiContract.findOne({ tenantId, _id: invoice.emiContractId }).select("-followUps").lean() : null,
      invoice.nbfcCaseId ? NbfcCase.findOne({ tenantId, _id: invoice.nbfcCaseId }).lean() : null,
      Approval.find({ tenantId, $or: [{ refId: invoice._id }, { refId: invoice.emiContractId }] }).sort({ createdAt: -1 }).lean(),
      Store.findOne({ tenantId, _id: invoice.storeId }).lean(),
    ]);
    ok(res, { invoice, payments, contract, nbfcCase, approvals, store });
  })
);

r.post(
  "/invoices/:id/cancel-request",
  need("approval.create"),
  s.validate(s.ReasonIn),
  ah(async (req, res) => {
    if (!isOid(req.params.id)) throw new AppError(400, "ID galat hai");
    ok(res, await approvalService.requestInvoiceCancel(req, req.params.id, req.body.reason), 201);
  })
);

module.exports = r;
