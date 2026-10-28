const mongoose = require("mongoose");
const { Store } = require("../models/platform");
const { Payment, Invoice } = require("../models/sales");
const { EmiContract, EmiInstallment, Notification } = require("../models/finance");
const { allocate, evaluateOverdue, bucket } = require("../domain/overdue");
const { foreclosureQuote, unpaidOf, totalOf, addMonths, daysBetween, DomainError } = require("../domain/emi");
const { computeMdr, GATEWAY_METHODS } = require("../domain/mdr");
const { postEmiReceipt, postForeclosure, postLateFee, postWaiver, allocationTotals } = require("../domain/postings");
const { fmt } = require("../domain/money");
const { AppError, withTxn, nextSeq, pad, saveJournals, audit, today, scoped } = require("../utils/helpers");
const { resolveSettings } = require("./settings.service");
const { agentOnly } = require("../middleware/rbac");
const bridge = require("./bridge.service");

const OPEN = ["UPCOMING", "DUE", "OVERDUE"];

// Find a contract the request may see (agents: only their own)
async function findContract(req, id) {
  const filter = { ...scoped(req), _id: id };
  if (agentOnly(req)) filter.assignedAgentId = req.user._id;
  const contract = await EmiContract.findOne(filter);
  if (!contract) throw new AppError(404, "EMI contract nahi mila");
  return contract;
}

const installmentsOf = (contract, session) =>
  EmiInstallment.find({ tenantId: contract.tenantId, contractId: contract._id }).sort({ no: 1 }).session(session || null);

// Apply an allocation to the installments and the contract's paid totals
async function applyAllocations(contract, installments, allocations, session, paidAt = new Date()) {
  for (const a of allocations) {
    const inst = installments.find((i) => i.no === a.no);
    inst.paidLateFee += a.lateFee;
    inst.paidInterestGst += a.interestGst;
    inst.paidInterest += a.interest;
    inst.paidPrincipal += a.principal;
    if (totalOf(unpaidOf(inst)) === 0) {
      inst.status = "PAID";
      inst.paidAt = paidAt;
      inst.dpd = 0;
    }
    await inst.save({ session });
  }
  const t = allocationTotals(allocations);
  contract.paidLateFee += t.lateFee;
  contract.paidInterestGst += t.interestGst;
  contract.paidInterest += t.interest;
  contract.paidPrincipal += t.principal;
}

// Next due date, DPD, bucket; CLOSED once nothing is left to pay
async function refreshContract(contract, installments, session, asOf = today()) {
  const open = installments.filter((i) => OPEN.includes(i.status));
  contract.nextDueDate = open[0]?.dueDate || null;
  const dpd = Math.max(0, ...open.map((i) => evaluateOverdue(i, asOf, { lateFee: { graceDays: 9999 }, reminders: { enabled: false } }).dpd));
  contract.currentDpd = dpd;
  contract.maxDpd = Math.max(contract.maxDpd || 0, dpd);
  contract.bucket = bucket(dpd);
  if (contract.status === "ACTIVE" && open.length === 0) {
    contract.status = "CLOSED";
    contract.closedAt = new Date();
    const invoice = await Invoice.findOne({ tenantId: contract.tenantId, _id: contract.invoiceId }).session(session || null);
    if (invoice && invoice.status === "EMI_ACTIVE") {
      invoice.status = "EMI_CLOSED";
      await invoice.save({ session });
      await bridge.syncOrder(invoice, session);
    }
  }
  await contract.save({ session });
}

async function receiptNo(contract, session) {
  const store = await Store.findOne({ tenantId: contract.tenantId, _id: contract.storeId }).session(session || null);
  return `${store.invoicePrefix}-R${pad(await nextSeq(contract.tenantId, `RCPT:${contract.storeId}`, session))}`;
}

async function paymentRow(req, contract, { purpose, method, amount, txnRef, allocations, advance, idempotencyKey }, session) {
  const settings = await resolveSettings(contract.tenantId, contract.storeId);
  const fee = computeMdr(method, amount, settings.mdrPct);
  const gateway = GATEWAY_METHODS.includes(method);
  const [payment] = await Payment.create(
    [
      {
        tenantId: contract.tenantId,
        storeId: contract.storeId,
        receiptNo: await receiptNo(contract, session),
        date: today(),
        purpose,
        invoiceId: contract.invoiceId,
        emiContractId: contract._id,
        customerId: contract.customerId,
        method,
        amount,
        mdrRatePct: fee.ratePct,
        mdr: fee.mdr,
        gstOnMdr: fee.gstOnMdr,
        netSettled: fee.netSettled,
        txnRef,
        allocations,
        advance: advance || 0,
        idempotencyKey: idempotencyKey || undefined,
        status: gateway ? "CAPTURED" : "SETTLED",
        settledAt: gateway ? undefined : new Date(),
        receivedBy: req.user._id,
      },
    ],
    { session }
  );
  return payment;
}

/**
 * EMI money received at the counter or by an agent. It pays the oldest dues
 * first (late fee -> interest -> principal); anything beyond the whole loan
 * is kept as advance.
 */
async function collectEmi(req, contractId, { method, amount, txnRef }, idempotencyKey) {
  const tenantId = req.emi.tenantId;
  if (idempotencyKey) {
    const existing = await Payment.findOne({ tenantId, idempotencyKey });
    if (existing) return { duplicate: true, payment: existing };
  }
  const found = await findContract(req, contractId);
  if (found.status !== "ACTIVE") throw new AppError(409, `Contract ${found.status} hai; is par EMI nahi le sakte`);

  try {
    return await withTxn(async (session) => {
      const contract = await EmiContract.findOne({ tenantId, _id: found._id }).session(session || null);
      const installments = await installmentsOf(contract, session);
      const { allocations, advance } = allocate(installments, amount);

      const payment = await paymentRow(req, contract, { purpose: "EMI", method, amount, txnRef, allocations, advance, idempotencyKey }, session);
      await applyAllocations(contract, installments, allocations, session);
      contract.advance += advance;
      await refreshContract(contract, installments, session);

      await saveJournals(
        [postEmiReceipt({ method, amount, allocations, advance, gstTiming: contract.gstTiming, interState: contract.interState })],
        { tenantId, storeId: contract.storeId, refType: "Payment", refId: payment._id, date: payment.date, createdBy: req.user._id },
        session
      );
      await audit(req, "emi.collect", { entity: "EmiContract", entityId: contract._id, after: { receiptNo: payment.receiptNo, amount, method } }, session);
      return { payment, contract };
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey && error.keyPattern?.idempotencyKey) {
      const existing = await Payment.findOne({ tenantId, idempotencyKey });
      if (existing) return { duplicate: true, payment: existing };
    }
    throw error;
  }
}

async function quoteForeclosure(req, contractId) {
  const contract = await findContract(req, contractId);
  if (contract.status !== "ACTIVE") throw new AppError(409, `Contract ${contract.status} hai`);
  const installments = await installmentsOf(contract);
  const settings = await resolveSettings(contract.tenantId, contract.storeId);
  try {
    return foreclosureQuote({ contract, installments, asOf: today(), chargePct: settings.emi.foreclosureChargePct });
  } catch (error) {
    if (error instanceof DomainError) throw new AppError(422, error.message);
    throw error;
  }
}

// After approval: take the quoted amount, cancel the rest of the schedule
async function executeForeclosure(req, contract, { method, txnRef }, session) {
  const installments = await installmentsOf(contract, session);
  const settings = await resolveSettings(contract.tenantId, contract.storeId);
  const asOf = today();
  let quote;
  try {
    quote = foreclosureQuote({ contract, installments, asOf, chargePct: settings.emi.foreclosureChargePct });
  } catch (error) {
    if (error instanceof DomainError) throw new AppError(422, error.message);
    throw error;
  }
  const due = installments.filter((i) => OPEN.includes(i.status) && daysBetween(i.dueDate, asOf) >= 0);
  const { allocations } = allocate(due, quote.dueNow);

  const payment = await paymentRow(req, contract, { purpose: "FORECLOSURE", method, amount: quote.total, txnRef, allocations, advance: 0 }, session);
  await applyAllocations(contract, installments, allocations, session);

  // The rest of the principal is paid off; the future installments go away
  for (const inst of installments.filter((i) => OPEN.includes(i.status))) {
    inst.paidPrincipal += unpaidOf(inst).principal;
    inst.status = "CANCELLED";
    await inst.save({ session });
  }
  contract.paidPrincipal += quote.outstandingPrincipal;
  contract.paidInterest += quote.accruedInterest;
  contract.paidInterestGst += quote.accruedInterestGst;
  contract.advance = 0;
  contract.status = "FORECLOSED";
  contract.closedAt = new Date();
  contract.nextDueDate = null;
  contract.currentDpd = 0;
  contract.bucket = "CURRENT";
  await contract.save({ session });

  const invoice = await Invoice.findOne({ tenantId: contract.tenantId, _id: contract.invoiceId }).session(session || null);
  invoice.status = "FORECLOSED";
  await invoice.save({ session });
  await bridge.syncOrder(invoice, session);

  await saveJournals(
    [postForeclosure({ method, amount: quote.total, allocations, quote, gstTiming: contract.gstTiming, interState: contract.interState })],
    { tenantId: contract.tenantId, storeId: contract.storeId, refType: "Payment", refId: payment._id, date: asOf, createdBy: req.user._id },
    session
  );
  return { payment, quote };
}

// After approval: write off the late fee still owed on one installment
async function executeWaiver(req, installmentId, tenantId, session) {
  const inst = await EmiInstallment.findOne({ tenantId, _id: installmentId }).session(session || null);
  if (!inst) throw new AppError(404, "Installment nahi mila");
  const amount = unpaidOf(inst).lateFee;
  if (amount === 0) throw new AppError(409, "Is installment par koi late fee baaki nahi hai");
  inst.lateFeeWaived += amount;
  if (totalOf(unpaidOf(inst)) === 0) {
    inst.status = "PAID";
    inst.paidAt = new Date();
  }
  await inst.save({ session });

  const contract = await EmiContract.findOne({ tenantId, _id: inst.contractId }).session(session || null);
  contract.lateFeeWaived += amount;
  await refreshContract(contract, await installmentsOf(contract, session), session);
  await saveJournals(
    [postWaiver({ amount })],
    { tenantId, storeId: inst.storeId, refType: "EmiInstallment", refId: inst._id, date: today(), createdBy: req.user._id },
    session
  );
  return { installment: inst, waived: amount };
}

// WhatsApp text for each reminder
const TEMPLATES = {
  REMIND_BEFORE_DUE: (p) => `Namaste ${p.customerName}, aapki EMI ${p.amount} ki due date ${p.dueDate} hai (${p.contractNo}). Samay par payment karke late fee se bachein. – ${p.shopName}`,
  DUE_TODAY: (p) => `Namaste ${p.customerName}, aapki EMI ${p.amount} aaj due hai (${p.contractNo}). – ${p.shopName}`,
  OVERDUE_NOTICE: (p) => `Namaste ${p.customerName}, aapki EMI ${p.amount} (due ${p.dueDate}) abhi baaki hai. Kripya jaldi payment karein (${p.contractNo}). – ${p.shopName}`,
  LATE_FEE_NOTICE: (p) => `Namaste ${p.customerName}, EMI ${p.dpd} din se baaki hai, isliye ${p.lateFee} late fee lagi hai. Kul baaki: ${p.amount} (${p.contractNo}). – ${p.shopName}`,
};
const ONCE_PER_INSTALLMENT = ["OVERDUE_NOTICE", "LATE_FEE_NOTICE"];

/**
 * Daily job for every shop: DPD and status per installment, a one-time late
 * fee after the grace days, reminder messages queued, contract buckets.
 * Safe to run more than once a day.
 */
async function runOverdueJob(asOf = today(), actor = null) {
  const horizon = addMonths(asOf, 1); // reminders are at most 15 days ahead
  const installments = await EmiInstallment.find({ status: { $in: OPEN }, dueDate: { $lte: horizon } })
    .setOptions({ allTenants: true })
    .sort({ dueDate: 1 });

  const contractIds = [...new Set(installments.map((i) => String(i.contractId)))];
  const contracts = await EmiContract.find({ _id: { $in: contractIds }, status: "ACTIVE" }).setOptions({ allTenants: true });
  const byId = new Map(contracts.map((c) => [String(c._id), c]));
  const settingsCache = new Map();
  const Tenant = mongoose.model("Tenant");
  const Customer = mongoose.model("Customer");

  const summary = { asOf, checked: 0, overdue: 0, lateFees: 0, lateFeeTotal: 0, reminders: 0, contracts: contracts.length };

  for (const inst of installments) {
    const contract = byId.get(String(inst.contractId));
    if (!contract) continue; // pending approval, closed or cancelled
    summary.checked++;
    const key = `${contract.tenantId}:${contract.storeId}`;
    if (!settingsCache.has(key)) settingsCache.set(key, await resolveSettings(contract.tenantId, contract.storeId));
    const settings = settingsCache.get(key);

    const result = evaluateOverdue(inst, asOf, settings);
    inst.dpd = result.dpd;
    if (result.status !== "PAID") inst.status = result.status;
    if (result.status === "OVERDUE") summary.overdue++;

    if (result.lateFee > 0) {
      const before = inst.lateFee; // the driver may retry the transaction body
      await withTxn(async (session) => {
        inst.lateFee = before + result.lateFee;
        inst.lateFeeApplied = true;
        await inst.save({ session });
        await saveJournals(
          [postLateFee({ amount: result.lateFee })],
          { tenantId: inst.tenantId, storeId: inst.storeId, refType: "EmiInstallment", refId: inst._id, date: asOf, createdBy: actor },
          session
        );
      });
      summary.lateFees++;
      summary.lateFeeTotal += result.lateFee;
    } else {
      await inst.save();
    }

    if (result.action && settings.reminders.enabled) {
      const [tenant, customer] = await Promise.all([Tenant.findById(contract.tenantId).lean(), Customer.findById(contract.customerId).select("name").lean()]);
      const unpaid = totalOf(unpaidOf(inst));
      const dedupeKey = ONCE_PER_INSTALLMENT.includes(result.action) ? `${inst._id}:${result.action}` : `${inst._id}:${result.action}:${asOf}`;
      const created = await Notification.updateOne(
        { tenantId: inst.tenantId, dedupeKey },
        {
          $setOnInsert: {
            tenantId: inst.tenantId,
            storeId: inst.storeId,
            customerId: contract.customerId,
            contractId: contract._id,
            installmentId: inst._id,
            channel: settings.reminders.channel,
            template: result.action,
            payload: {
              customerName: customer?.name || "Customer",
              amount: fmt(unpaid),
              dueDate: inst.dueDate,
              contractNo: contract.contractNo,
              shopName: tenant?.name || "",
              dpd: result.dpd,
              lateFee: fmt(result.lateFee || inst.lateFee),
            },
            status: "QUEUED",
          },
        },
        { upsert: true }
      );
      if (created.upsertedCount) summary.reminders++;
    }
  }

  for (const contract of contracts) {
    const insts = await installmentsOf(contract);
    await refreshContract(contract, insts, null, asOf);
  }
  return summary;
}

module.exports = {
  findContract,
  installmentsOf,
  collectEmi,
  quoteForeclosure,
  executeForeclosure,
  executeWaiver,
  refreshContract,
  runOverdueJob,
  TEMPLATES,
};
