const mongoose = require("mongoose");
const Product = require("../../models/Product.model");
const Customer = require("../../models/Customer.model");
const { Store } = require("../models/platform");
const { InventoryItem, Invoice, Payment } = require("../models/sales");
const { EmiContract, EmiInstallment, NbfcCase, NbfcPartner, Approval } = require("../models/finance");
const { checkout } = require("../domain/checkout");
const { GATEWAY_METHODS } = require("../domain/mdr");
const { rupees, fmt } = require("../domain/money");
const { AppError, withTxn, nextSeq, pad, saveJournals, audit, today } = require("../utils/helpers");
const { resolveSettings } = require("./settings.service");
const { can } = require("../middleware/rbac");
const bridge = require("./bridge.service");

const saleSummary = (invoice, extra = {}) => ({
  invoiceId: invoice._id,
  invoiceNo: invoice.invoiceNo,
  status: invoice.status,
  grossTotal: invoice.grossTotal,
  financeType: invoice.financeType,
  emiContractId: invoice.emiContractId,
  nbfcCaseId: invoice.nbfcCaseId,
  needsApproval: invoice.status === "PENDING_APPROVAL",
  ...extra,
});

/**
 * Everything the domain checkout() needs, read from the database: the
 * customer, the store, real prices from the catalog (never the client's),
 * the IMEIs in stock and the effective settings.
 */
async function loadSale(req, storeId, body) {
  const tenantId = req.emi.tenantId;
  const store = await Store.findOne({ _id: storeId, tenantId, active: true });
  if (!store) throw new AppError(404, "Store nahi mila");

  const customer = await Customer.findOne({ _id: body.customerId, userId: tenantId });
  if (!customer) throw new AppError(404, "Customer nahi mila");

  const productIds = [...new Set(body.items.map((i) => String(i.productId)))];
  const products = await Product.find({ _id: { $in: productIds }, userId: tenantId, isActive: true });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const qtyByProduct = {};
  const items = [];
  for (const item of body.items) {
    const product = byId.get(String(item.productId));
    if (!product) throw new AppError(422, "Product nahi mila ya band hai");
    const qty = item.qty || 1;

    if (product.serialized) {
      const unit = await InventoryItem.findOne({ tenantId, imei: item.imei });
      if (!unit) throw new AppError(422, `IMEI ${item.imei} stock me nahi hai`);
      if (unit.status === "SOLD") throw new AppError(409, `IMEI ${item.imei} pehle hi bik chuka hai`);
      if (String(unit.storeId) !== String(store._id)) throw new AppError(422, `IMEI ${item.imei} is store me nahi hai`);
      if (String(unit.productId) !== String(product._id)) throw new AppError(422, `IMEI ${item.imei} ${product.name} ka nahi hai`);
    } else {
      qtyByProduct[product._id] = (qtyByProduct[product._id] || 0) + qty;
      if (qtyByProduct[product._id] > (product.stock || 0)) throw new AppError(422, `${product.name}: stock me sirf ${product.stock || 0} hai`);
    }

    items.push({
      productId: product._id,
      name: product.name,
      hsn: product.hsn || "",
      gstRatePct: product.gstRatePct ?? 18,
      listPrice: rupees(product.price),
      price: item.price,
      qty,
      imei: product.serialized ? item.imei : undefined,
      serialized: product.serialized,
    });
  }

  let partner = null;
  if (body.finance?.type === "NBFC") {
    partner = body.finance.partnerId ? await NbfcPartner.findById(body.finance.partnerId) : null;
  }

  const settings = await resolveSettings(tenantId, store._id);
  const tenant = req.emi.tenant;
  const input = {
    date: today(),
    store: { stateCode: store.stateCode },
    customer: { kycStatus: customer.kycStatus, stateCode: customer.stateCode },
    items,
    canDiscount: can(req, "invoice.discount", store._id),
    payments: body.payments || [],
    finance: {
      ...(body.finance || { type: "NONE" }),
      partner: partner && { name: partner.name, subventionPct: partner.subventionPct, active: partner.active },
    },
  };
  return { tenantId, tenant, store, customer, partner, settings, input };
}

// The checks alone, for the New Sale screen before it confirms
async function previewSale(req, storeId, body) {
  const { settings, input } = await loadSale(req, storeId, body);
  return checkout({ ...input, invoiceNo: "PREVIEW" }, settings);
}

/**
 * Save one sale: invoice, payments, EMI contract + installments or NBFC case,
 * IMEIs marked SOLD, stock, the matching ChatShop order, journals and audit,
 * all in one transaction. The same Idempotency-Key returns the first result.
 */
async function createSale(req, storeId, body, idempotencyKey) {
  const tenantId = req.emi.tenantId;
  if (idempotencyKey) {
    const existing = await Invoice.findOne({ tenantId, idempotencyKey });
    if (existing) return saleSummary(existing, { duplicate: true });
  }

  const ctx = await loadSale(req, storeId, body);
  const check = checkout({ ...ctx.input, invoiceNo: "PREVIEW" }, ctx.settings);
  if (!check.ok) throw new AppError(422, check.errors[0], check.errors);

  try {
    return await withTxn((session) => saveSale(req, ctx, body, idempotencyKey, session));
  } catch (error) {
    if (error.code === 11000 && idempotencyKey && error.keyPattern?.idempotencyKey) {
      const existing = await Invoice.findOne({ tenantId, idempotencyKey });
      if (existing) return saleSummary(existing, { duplicate: true });
    }
    throw error;
  }
}

async function saveSale(req, ctx, body, idempotencyKey, session) {
  const { tenantId, tenant, store, customer, partner, settings, input } = ctx;
  const userId = req.user._id;
  const undo = []; // without a transaction, put things back if a later step fails

  try {
    const invoiceNo = `${store.invoicePrefix}-${pad(await nextSeq(tenantId, `INV:${store._id}`, session))}`;
    const result = checkout({ ...input, invoiceNo }, settings);
    if (!result.ok) throw new AppError(422, result.errors[0], result.errors);

    const invoiceId = new mongoose.Types.ObjectId();
    const now = new Date();

    // Stock first: a unit sold by someone a moment ago stops the sale here
    for (const line of result.invoice.lines) {
      if (line.imei) {
        const sold = await InventoryItem.updateOne(
          { tenantId, imei: line.imei, storeId: store._id, status: "IN_STOCK" },
          { status: "SOLD", soldAt: now, invoiceId },
          { session }
        );
        if (sold.modifiedCount === 0) throw new AppError(409, `IMEI ${line.imei} pehle hi bik chuka hai`);
        undo.push(() => InventoryItem.updateOne({ tenantId, imei: line.imei }, { status: "IN_STOCK", soldAt: null, invoiceId: null }));
        await Product.updateOne({ _id: line.productId }, [{ $set: { stock: { $max: [0, { $subtract: ["$stock", 1] }] } } }], { session });
        undo.push(() => Product.updateOne({ _id: line.productId }, { $inc: { stock: 1 } }));
      } else {
        const taken = await Product.updateOne({ _id: line.productId, userId: tenantId, stock: { $gte: line.qty } }, { $inc: { stock: -line.qty } }, { session });
        if (taken.modifiedCount === 0) throw new AppError(409, `${line.name}: stock khatam ho gaya`);
        undo.push(() => Product.updateOne({ _id: line.productId }, { $inc: { stock: line.qty } }));
      }
    }

    const contractId = result.emi ? new mongoose.Types.ObjectId() : null;
    const nbfcCaseId = result.nbfc ? new mongoose.Types.ObjectId() : null;

    const invoiceDoc = {
      _id: invoiceId,
      tenantId,
      storeId: store._id,
      invoiceNo,
      date: input.date,
      customerId: customer._id,
      customer: { name: customer.name, phone: customer.phone, pan: customer.pan, address: customer.address, stateCode: customer.stateCode, gstin: customer.gstin },
      seller: {
        name: tenant.name,
        legalName: tenant.legalName || tenant.name,
        gstin: store.gstin || tenant.gstin,
        address: store.address || tenant.address,
        stateCode: store.stateCode,
        storeName: store.name,
      },
      ...result.invoice,
      emiContractId: contractId,
      nbfcCaseId,
      idempotencyKey: idempotencyKey || undefined,
      note: body.note,
      createdBy: userId,
    };

    // Payments taken at the counter
    const payments = [];
    for (const p of result.payments) {
      const receiptNo = `${store.invoicePrefix}-R${pad(await nextSeq(tenantId, `RCPT:${store._id}`, session))}`;
      const gateway = GATEWAY_METHODS.includes(p.method);
      payments.push({
        _id: new mongoose.Types.ObjectId(),
        tenantId,
        storeId: store._id,
        receiptNo,
        date: input.date,
        purpose: "SALE",
        invoiceId,
        customerId: customer._id,
        method: p.method,
        amount: p.amount,
        mdrRatePct: p.mdr.ratePct,
        mdr: p.mdr.mdr,
        gstOnMdr: p.mdr.gstOnMdr,
        netSettled: p.mdr.netSettled,
        txnRef: p.txnRef,
        status: gateway ? "CAPTURED" : "SETTLED",
        settledAt: gateway ? undefined : now,
        receivedBy: userId,
      });
    }

    const order = await bridge.createOrderForInvoice(invoiceDoc, payments, session);
    undo.push(() => bridge.removeOrder(invoiceDoc, order));
    invoiceDoc.orderId = order._id;

    await Invoice.create([invoiceDoc], { session });
    undo.push(() => Invoice.deleteOne({ tenantId, _id: invoiceId }));
    if (payments.length) {
      await Payment.insertMany(payments, { session });
      undo.push(() => Payment.deleteMany({ tenantId, invoiceId }));
    }

    let approvalId = null;
    if (result.emi) {
      const plan = result.emi;
      const status = result.needsApproval ? "PENDING_APPROVAL" : "ACTIVE";
      await EmiContract.create(
        [
          {
            _id: contractId,
            tenantId,
            storeId: store._id,
            contractNo: `EMI-${invoiceNo}`,
            invoiceId,
            customerId: customer._id,
            principal: plan.principal,
            annualRatePct: plan.annualRatePct,
            tenureMonths: plan.tenureMonths,
            emiAmount: plan.emi,
            gstMode: plan.gstMode,
            gstTiming: plan.gstTiming,
            interState: result.invoice.interState,
            startDate: input.date,
            totalInterest: plan.totalInterest,
            totalInterestGst: plan.totalInterestGst,
            totalPayable: plan.totalPayable,
            nextDueDate: plan.installments[0].dueDate,
            status,
          },
        ],
        { session }
      );
      await EmiInstallment.insertMany(
        plan.installments.map((i) => ({
          tenantId,
          contractId,
          storeId: store._id,
          customerId: customer._id,
          no: i.no,
          dueDate: i.dueDate,
          principal: i.principal,
          interest: i.interest,
          interestGst: i.interestGst,
          amountDue: i.amountDue,
          status: i.amountDue === 0 ? "PAID" : "UPCOMING",
        })),
        { session }
      );
      undo.push(() => EmiContract.deleteOne({ tenantId, _id: contractId }), () => EmiInstallment.deleteMany({ tenantId, contractId }));

      if (result.needsApproval) {
        const [approval] = await Approval.create(
          [
            {
              tenantId,
              storeId: store._id,
              type: "HIGH_EMI",
              refModel: "Invoice",
              refId: invoiceId,
              amount: plan.principal,
              payload: { contractId, invoiceNo, customerName: customer.name, tenureMonths: plan.tenureMonths, annualRatePct: plan.annualRatePct },
              reason: `EMI ${fmt(plan.principal)} approval limit ${fmt(settings.emi.approvalAbove)} se upar hai`,
              requestedBy: userId,
              requestedByName: req.user.name,
            },
          ],
          { session }
        );
        approvalId = approval._id;
        undo.push(() => Approval.deleteOne({ tenantId, _id: approvalId }));
      }
    }

    if (result.nbfc) {
      await NbfcCase.create(
        [
          {
            _id: nbfcCaseId,
            tenantId,
            storeId: store._id,
            invoiceId,
            customerId: customer._id,
            partnerId: partner._id,
            partnerName: partner.name,
            loanAmount: result.nbfc.loanAmount,
            subventionPct: result.nbfc.subventionPct,
            subvention: result.nbfc.subvention,
            subventionGst: result.nbfc.subventionGst,
            expectedPayout: result.nbfc.expectedPayout,
            tenureMonths: body.finance.tenureMonths,
            status: "LOGIN",
            history: [{ status: "LOGIN", by: userId, byName: req.user.name, note: `Invoice ${invoiceNo}` }],
          },
        ],
        { session }
      );
      undo.push(() => NbfcCase.deleteOne({ tenantId, _id: nbfcCaseId }));
    }

    // Journals last, each against the record it belongs to
    let paymentIndex = 0;
    const meta = { tenantId, storeId: store._id, date: input.date, createdBy: userId };
    for (const j of result.journals) {
      const ref =
        j.event === "PAYMENT_RECEIVED"
          ? { refType: "Payment", refId: payments[paymentIndex++]._id }
          : j.event.startsWith("EMI_")
            ? { refType: "EmiContract", refId: contractId }
            : j.event.startsWith("NBFC_")
              ? { refType: "NbfcCase", refId: nbfcCaseId }
              : { refType: "Invoice", refId: invoiceId };
      await saveJournals([j], { ...meta, ...ref }, session);
    }

    await audit(
      req,
      "invoice.create",
      { entity: "Invoice", entityId: invoiceId, after: { invoiceNo, grossTotal: result.invoice.grossTotal, financeType: result.invoice.financeType, status: result.invoice.status } },
      session
    );

    return saleSummary(invoiceDoc, { approvalId, receipts: payments.map((p) => ({ receiptNo: p.receiptNo, method: p.method, amount: p.amount })) });
  } catch (error) {
    if (!session) {
      for (const step of undo.reverse()) await Promise.resolve(step()).catch(() => {});
    }
    throw error;
  }
}

module.exports = { createSale, previewSale, saleSummary };
