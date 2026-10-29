const mongoose = require("mongoose");
const { Counter } = require("../models/platform");
const { JournalEntry } = require("../models/finance");
const AuditLog = require("../../models/AuditLog.model");

// Error with an HTTP status and a message the cashier can read
class AppError extends Error {
  // `code` lets the screen react to a known case (e.g. TENANT_PENDING)
  constructor(status, message, errors, code) {
    super(message);
    this.status = status;
    this.errors = errors || [message];
    this.code = code;
  }
}

// Async route handler: a thrown error goes to the EMI error handler
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const oid = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id)));
const isOid = (id) => mongoose.isValidObjectId(id);

// Today's date in India, as YYYY-MM-DD
const today = (at = Date.now()) => new Date(at + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

// Filter for list queries: this tenant, and only the stores the user may see
const scoped = (req) => {
  const filter = { tenantId: req.emi.tenantId };
  if (req.emi.storeIds) filter.storeId = { $in: req.emi.storeIds };
  return filter;
};

// Transactions need a replica set (Atlas always has one). On a standalone
// local MongoDB the work still runs, just without all-or-nothing rollback.
let txnSupport;
async function supportsTransactions() {
  if (txnSupport === undefined) {
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      txnSupport = Boolean(hello.setName || hello.msg === "isdbgrid");
    } catch {
      txnSupport = false;
    }
    if (!txnSupport && process.env.NODE_ENV !== "test") {
      console.warn("⚠️  MongoDB is not a replica set: EMI money writes run without transactions. Use a replica set (Atlas) in production.");
    }
  }
  return txnSupport;
}

// Run fn(session) in one transaction (retried by the driver on transient errors)
async function withTxn(fn) {
  if (!(await supportsTransactions())) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// Next number in a gap-free sequence; inside a transaction it rolls back too
async function nextSeq(tenantId, key, session) {
  const counter = await Counter.findOneAndUpdate(
    { tenantId, key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session, setDefaultsOnInsert: true }
  );
  return counter.seq;
}

const pad = (n, width = 6) => String(n).padStart(width, "0");

// Store domain journals against what caused them
async function saveJournals(journals, { tenantId, storeId, refType, refId, date, createdBy }, session) {
  if (!journals.length) return [];
  return JournalEntry.insertMany(
    journals.map((j) => ({ tenantId, storeId, event: j.event, refType, refId, date, lines: j.lines, createdBy })),
    { session }
  );
}

// Who did what, to which record, with before/after and the reason
async function audit(req, action, { entity, entityId, before, after, reason, details, tenantId } = {}, session) {
  await AuditLog.create(
    [
      {
        actor: req?.user?._id,
        actorEmail: req?.user?.email,
        action,
        tenantId: tenantId || req?.emi?.tenantId,
        entity,
        entityId,
        target: entityId ? String(entityId) : undefined,
        before,
        after,
        reason,
        details: req?.actingAdmin ? [details, "by Super Admin in the shop's dashboard"].filter(Boolean).join(" · ") : details,
        ip: req?.ip,
      },
    ],
    { session }
  );
}

module.exports = { AppError, ah, oid, isOid, today, scoped, withTxn, supportsTransactions, nextSeq, pad, saveJournals, audit };
