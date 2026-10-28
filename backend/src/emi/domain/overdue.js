const { pct } = require("./money");
const { daysBetween, unpaidOf } = require("./emi");

const BUCKETS = ["CURRENT", "1-30", "31-60", "61-90", "90+"];

const bucket = (dpd) => (dpd <= 0 ? "CURRENT" : dpd <= 30 ? "1-30" : dpd <= 60 ? "31-60" : dpd <= 90 ? "61-90" : "90+");

/**
 * One installment on `asOf`: days past due, bucket, status, the late fee to
 * apply now (only once per installment, after the grace days) and today's
 * reminder action, if any.
 */
const evaluateOverdue = (inst, asOf, settings) => {
  if (["PAID", "CANCELLED"].includes(inst.status)) {
    return { dpd: 0, bucket: "CURRENT", status: inst.status, lateFee: 0, action: null };
  }
  const unpaid = unpaidOf(inst);
  const dueUnpaid = unpaid.principal + unpaid.interest + unpaid.interestGst;
  const daysToDue = daysBetween(asOf, inst.dueDate);
  const dpd = dueUnpaid > 0 && daysToDue < 0 ? -daysToDue : 0;

  const status =
    dueUnpaid + unpaid.lateFee === 0 ? "PAID" : daysToDue > 0 ? "UPCOMING" : daysToDue === 0 ? "DUE" : "OVERDUE";

  let lateFee = 0;
  const rule = settings.lateFee;
  if (dpd > rule.graceDays && !inst.lateFeeApplied) {
    const raw = rule.type === "PERCENT" ? pct(dueUnpaid, rule.pct) : rule.flat;
    lateFee = Math.min(raw, rule.cap);
  }

  let action = null;
  if (settings.reminders?.enabled !== false) {
    if (lateFee > 0) action = "LATE_FEE_NOTICE";
    else if (dpd === 1) action = "OVERDUE_NOTICE";
    else if (dueUnpaid > 0 && daysToDue === 0) action = "DUE_TODAY";
    else if (dueUnpaid > 0 && daysToDue === settings.reminders.daysBefore) action = "REMIND_BEFORE_DUE";
  }

  return { dpd, bucket: bucket(dpd), status, lateFee, action };
};

const ORDER = ["lateFee", "interestGst", "interest", "principal"];

/**
 * Split a payment across open installments, oldest first. Inside each
 * installment: late fee -> interest (its GST first) -> principal. Whatever is
 * left after every installment is fully paid is advance.
 */
const allocate = (installments, amount) => {
  let left = amount;
  const allocations = [];
  const open = installments
    .filter((i) => !["PAID", "CANCELLED"].includes(i.status))
    .sort((a, b) => a.no - b.no);

  for (const inst of open) {
    if (left <= 0) break;
    const unpaid = unpaidOf(inst);
    const part = { installmentId: inst._id, no: inst.no, lateFee: 0, interestGst: 0, interest: 0, principal: 0 };
    for (const key of ORDER) {
      const take = Math.min(left, unpaid[key]);
      part[key] = take;
      left -= take;
    }
    part.total = part.lateFee + part.interestGst + part.interest + part.principal;
    if (part.total > 0) allocations.push(part);
  }

  return { allocations, advance: left };
};

module.exports = { BUCKETS, bucket, evaluateOverdue, allocate };
