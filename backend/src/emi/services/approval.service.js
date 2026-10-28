const Product = require("../../models/Product.model");
const { InventoryItem, Invoice, Payment } = require("../models/sales");
const { EmiContract, EmiInstallment, NbfcCase, JournalEntry, Approval } = require("../models/finance");
const { reverse } = require("../domain/ledger");
const { unpaidOf } = require("../domain/emi");
const { AppError, withTxn, saveJournals, audit, today, scoped } = require("../utils/helpers");
const { can } = require("../middleware/rbac");
const emiService = require("./emi.service");
const bridge = require("./bridge.service");

async function openRequest(req, { type, refModel, refId, storeId, amount, payload, reason }) {
  const tenantId = req.emi.tenantId;
  if (await Approval.exists({ tenantId, type, refId, status: "PENDING" })) {
    throw new AppError(409, "Is kaam ki approval request pehle se pending hai");
  }
  const [approval] = await Approval.create([
    { tenantId, storeId, type, refModel, refId, amount, payload, reason, requestedBy: req.user._id, requestedByName: req.user.name },
  ]);
  await audit(req, "approval.request", { entity: refModel, entityId: refId, after: { type, amount }, reason });
  return approval;
}

async function requestInvoiceCancel(req, invoiceId, reason) {
  const invoice = await Invoice.findOne({ ...scoped(req), _id: invoiceId });
  if (!invoice) throw new AppError(404, "Invoice nahi mila");
  if (invoice.status === "CANCELLED") throw new AppError(409, "Invoice pehle hi cancel hai");
  await assertCancellable(invoice);
  return openRequest(req, {
    type: "INVOICE_CANCEL",
    refModel: "Invoice",
    refId: invoice._id,
    storeId: invoice.storeId,
    amount: invoice.grossTotal,
    payload: { invoiceNo: invoice.invoiceNo, customerName: invoice.customer?.name },
    reason,
  });
}

async function requestWaiver(req, installmentId, reason) {
  const inst = await EmiInstallment.findOne({ ...scoped(req), _id: installmentId });
  if (!inst) throw new AppError(404, "Installment nahi mila");
  const amount = unpaidOf(inst).lateFee;
  if (amount === 0) throw new AppError(409, "Is installment par koi late fee baaki nahi hai");
  const contract = await EmiContract.findOne({ tenantId: inst.tenantId, _id: inst.contractId });
  return openRequest(req, {
    type: "LATE_FEE_WAIVER",
    refModel: "EmiInstallment",
    refId: inst._id,
    storeId: inst.storeId,
    amount,
    payload: { contractId: contract._id, contractNo: contract.contractNo, installmentNo: inst.no },
    reason,
  });
}

async function requestForeclosure(req, contractId, { method, txnRef, reason }) {
  const contract = await emiService.findContract(req, contractId);
  const quote = await emiService.quoteForeclosure(req, contractId);
  return openRequest(req, {
    type: "FORECLOSURE",
    refModel: "EmiContract",
    refId: contract._id,
    storeId: contract.storeId,
    amount: quote.total,
    payload: { method, txnRef, quote, contractNo: contract.contractNo },
    reason,
  });
}

// Once an EMI or the NBFC payout has come in, the sale can no longer be undone
async function assertCancellable(invoice, session) {
  if (invoice.emiContractId) {
    const contract = await EmiContract.findOne({ tenantId: invoice.tenantId, _id: invoice.emiContractId }).session(session || null);
    if (contract && contract.paidPrincipal + contract.paidInterest + contract.paidInterestGst + contract.paidLateFee > 0) {
      throw new AppError(409, "EMI aane ke baad invoice cancel nahi ho sakta");
    }
  }
  if (invoice.nbfcCaseId) {
    const nbfcCase = await NbfcCase.findOne({ tenantId: invoice.tenantId, _id: invoice.nbfcCaseId }).session(session || null);
    if (nbfcCase?.status === "DISBURSED") throw new AppError(409, "NBFC payout aa chuka hai; invoice cancel nahi ho sakta");
  }
}

/**
 * Cancel = reversal journals for everything the sale booked, payments marked
 * REVERSED, IMEIs and stock back, EMI/NBFC cancelled, the order cancelled.
 */
async function cancelInvoice(req, invoice, reason, session) {
  if (invoice.status === "CANCELLED") throw new AppError(409, "Invoice pehle hi cancel hai");
  await assertCancellable(invoice, session);
  const tenantId = invoice.tenantId;
  const s = session || null;

  const payments = await Payment.find({ tenantId, invoiceId: invoice._id }).session(s);
  const installments = invoice.emiContractId ? await EmiInstallment.find({ tenantId, contractId: invoice.emiContractId }).session(s) : [];
  const refIds = [invoice._id, invoice.emiContractId, invoice.nbfcCaseId, ...payments.map((p) => p._id), ...installments.map((i) => i._id)].filter(Boolean);

  const journals = await JournalEntry.find({ tenantId, refId: { $in: refIds } }).session(s).lean();
  for (const j of journals.filter((x) => !x.event.endsWith("_REVERSED"))) {
    await saveJournals([reverse(j)], { tenantId, storeId: j.storeId, refType: j.refType, refId: j.refId, date: today(), createdBy: req.user._id }, session);
  }

  await Payment.updateMany({ tenantId, invoiceId: invoice._id }, { status: "REVERSED" }, { session });

  for (const line of invoice.lines) {
    if (line.imei) {
      await InventoryItem.updateOne({ tenantId, imei: line.imei }, { status: "IN_STOCK", invoiceId: null, soldAt: null }, { session });
    }
    await Product.updateOne({ _id: line.productId }, { $inc: { stock: line.qty } }, { session });
  }

  if (invoice.emiContractId) {
    await EmiContract.updateOne({ tenantId, _id: invoice.emiContractId }, { status: "CANCELLED", closedAt: new Date(), nextDueDate: null }, { session });
    await EmiInstallment.updateMany({ tenantId, contractId: invoice.emiContractId }, { status: "CANCELLED" }, { session });
  }
  if (invoice.nbfcCaseId) {
    await NbfcCase.updateOne(
      { tenantId, _id: invoice.nbfcCaseId },
      { status: "CANCELLED", $push: { history: { status: "CANCELLED", by: req.user._id, byName: req.user.name, note: reason } } },
      { session }
    );
  }

  invoice.status = "CANCELLED";
  invoice.cancelledAt = new Date();
  invoice.cancelReason = reason;
  await invoice.save({ session });
  await bridge.syncOrder(invoice, session);
  // Requests about this sale no longer make sense
  await Approval.updateMany(
    { tenantId, status: "PENDING", $or: [{ refId: invoice._id }, { refId: invoice.emiContractId }, { refId: { $in: installments.map((i) => i._id) } }] },
    { status: "REJECTED", decisionNote: "Invoice cancel ho gaya", decidedAt: new Date() },
    { session }
  );
}

/**
 * Approve or reject a request. Maker-checker: whoever asked cannot decide
 * (the shop owner, the final authority, is the one exception).
 */
async function decideApproval(req, approvalId, { decision, note }) {
  const tenantId = req.emi.tenantId;
  const found = await Approval.findOne({ ...scoped(req), _id: approvalId });
  if (!found) throw new AppError(404, "Approval request nahi mili");
  if (found.status !== "PENDING") throw new AppError(409, `Request pehle hi ${found.status} hai`);
  if (!can(req, "approval.decide", found.storeId)) throw new AppError(403, "Is store ki approval aap decide nahi kar sakte");
  if (String(found.requestedBy) === String(req.user._id) && !req.emi.isOwner) {
    throw new AppError(403, "Apni hi request aap approve/reject nahi kar sakte");
  }
  if (decision === "REJECTED" && !note) throw new AppError(422, "Reject karne ka kaaran likho");

  const outcome = await withTxn(async (session) => {
    const s = session || null;
    const approval = await Approval.findOne({ tenantId, _id: found._id, status: "PENDING" }).session(s);
    if (!approval) throw new AppError(409, "Request pehle hi decide ho chuki hai");
    approval.status = decision;
    approval.decidedBy = req.user._id;
    approval.decidedByName = req.user.name;
    approval.decisionNote = note;
    approval.decidedAt = new Date();
    let result = null;

    if (approval.type === "HIGH_EMI") {
      const invoice = await Invoice.findOne({ tenantId, _id: approval.refId }).session(s);
      if (decision === "APPROVED") {
        await EmiContract.updateOne({ tenantId, _id: invoice.emiContractId }, { status: "ACTIVE" }, { session });
        invoice.status = "EMI_ACTIVE";
        await invoice.save({ session });
        await bridge.syncOrder(invoice, session);
      } else {
        await approval.save({ session }); // before cancelInvoice closes other pending requests
        await cancelInvoice(req, invoice, `EMI approval reject: ${note}`, session);
      }
      result = { invoiceNo: invoice.invoiceNo, status: invoice.status };
    } else if (decision === "APPROVED" && approval.type === "INVOICE_CANCEL") {
      const invoice = await Invoice.findOne({ tenantId, _id: approval.refId }).session(s);
      await approval.save({ session });
      await cancelInvoice(req, invoice, approval.reason || note || "Cancel approved", session);
      result = { invoiceNo: invoice.invoiceNo, status: "CANCELLED" };
    } else if (decision === "APPROVED" && approval.type === "LATE_FEE_WAIVER") {
      result = await emiService.executeWaiver(req, approval.refId, tenantId, session);
    } else if (decision === "APPROVED" && approval.type === "FORECLOSURE") {
      const contract = await EmiContract.findOne({ tenantId, _id: approval.refId }).session(s);
      if (contract.status !== "ACTIVE") throw new AppError(409, `Contract ${contract.status} hai`);
      const done = await emiService.executeForeclosure(req, contract, approval.payload || {}, session);
      result = { receiptNo: done.payment.receiptNo, amount: done.quote.total };
    }

    await approval.save({ session });
    await audit(req, `approval.${decision.toLowerCase()}`, { entity: approval.refModel, entityId: approval.refId, after: { type: approval.type, result }, reason: note }, session);
    return { approval, result };
  });
  return outcome;
}

module.exports = { requestInvoiceCancel, requestWaiver, requestForeclosure, decideApproval, cancelInvoice };
