const { Invoice, Payment } = require("../models/sales");
const { NbfcCase } = require("../models/finance");
const { postGatewaySettlement, postNbfcSettlement } = require("../domain/postings");
const { AppError, withTxn, saveJournals, audit, today, scoped } = require("../utils/helpers");
const bridge = require("./bridge.service");

// Which NBFC case status may follow which
const NBFC_FLOW = {
  LOGIN: ["APPROVED", "REJECTED"],
  APPROVED: ["DO_RECEIVED", "REJECTED"],
  DO_RECEIVED: ["DISBURSED", "REJECTED"],
  DISBURSED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Move an NBFC case along. DO_RECEIVED needs the delivery order number;
 * DISBURSED books the payout and marks the invoice paid.
 */
async function moveNbfcCase(req, caseId, { status, doNumber, receivedAmount, note }) {
  const found = await NbfcCase.findOne({ ...scoped(req), _id: caseId });
  if (!found) throw new AppError(404, "NBFC case nahi mila");
  if (!NBFC_FLOW[found.status].includes(status)) {
    throw new AppError(409, `${found.status} se ${status} nahi ho sakta`);
  }
  if (status === "DO_RECEIVED" && !doNumber) throw new AppError(422, "DO number daalo");

  return withTxn(async (session) => {
    const nbfcCase = await NbfcCase.findOne({ tenantId: found.tenantId, _id: found._id }).session(session || null);
    nbfcCase.status = status;
    if (doNumber) nbfcCase.doNumber = doNumber;
    nbfcCase.history.push({ status, by: req.user._id, byName: req.user.name, note });

    if (status === "DISBURSED") {
      const received = receivedAmount ?? nbfcCase.expectedPayout;
      nbfcCase.receivedAmount = received;
      await saveJournals(
        [postNbfcSettlement({ expectedPayout: nbfcCase.expectedPayout, received })],
        { tenantId: nbfcCase.tenantId, storeId: nbfcCase.storeId, refType: "NbfcCase", refId: nbfcCase._id, date: today(), createdBy: req.user._id },
        session
      );
      const invoice = await Invoice.findOne({ tenantId: nbfcCase.tenantId, _id: nbfcCase.invoiceId }).session(session || null);
      if (invoice.status === "NBFC_PENDING") {
        invoice.status = "PAID";
        await invoice.save({ session });
        await bridge.syncOrder(invoice, session);
      }
    }
    await nbfcCase.save({ session });
    await audit(req, "nbfc.status", { entity: "NbfcCase", entityId: nbfcCase._id, before: { status: found.status }, after: { status, doNumber, receivedAmount }, reason: note }, session);
    return nbfcCase;
  });
}

// Card/UPI money reached the bank: book the net amount and the fee
async function settle(payment, actor, session) {
  payment.status = "SETTLED";
  payment.settledAt = new Date();
  await payment.save({ session });
  await saveJournals(
    [postGatewaySettlement(payment)],
    { tenantId: payment.tenantId, storeId: payment.storeId, refType: "Payment", refId: payment._id, date: today(), createdBy: actor },
    session
  );
}

async function settlePayment(req, paymentId) {
  const found = await Payment.findOne({ ...scoped(req), _id: paymentId });
  if (!found) throw new AppError(404, "Payment nahi mila");
  if (found.status !== "CAPTURED") throw new AppError(409, `Payment ${found.status} hai; settle nahi ho sakta`);
  return withTxn(async (session) => {
    const payment = await Payment.findOne({ tenantId: found.tenantId, _id: found._id, status: "CAPTURED" }).session(session || null);
    if (!payment) throw new AppError(409, "Payment pehle hi settle ho gaya");
    await settle(payment, req.user._id, session);
    await audit(req, "payment.settle", { entity: "Payment", entityId: payment._id, after: { receiptNo: payment.receiptNo, netSettled: payment.netSettled } }, session);
    return payment;
  });
}

// Gateway webhook: { event: "payment.settled", txnRef } — the reference the
// cashier typed in. Unknown or already settled references are ignored.
async function gatewayWebhook(body) {
  if (body?.event !== "payment.settled" || !body.txnRef) return { ignored: true };
  const payments = await Payment.find({ txnRef: String(body.txnRef), status: "CAPTURED" }).setOptions({ allTenants: true });
  for (const p of payments) {
    await withTxn(async (session) => {
      const payment = await Payment.findOne({ tenantId: p.tenantId, _id: p._id, status: "CAPTURED" }).session(session || null);
      if (payment) await settle(payment, null, session);
    });
  }
  return { settled: payments.length };
}

module.exports = { moveNbfcCase, settlePayment, gatewayWebhook, NBFC_FLOW };
