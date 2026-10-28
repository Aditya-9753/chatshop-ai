const mongoose = require("mongoose");
const User = require("../../models/User.model");
const { Tenant, Store } = require("../models/platform");
const { AppError } = require("../utils/helpers");

// Role -> permissions. "x.*" grants every x permission, "*.read" every read,
// "*" everything inside the shop (never super.*, which is the Super Admin's).
const PERMISSIONS = {
  OWNER: ["*"],
  STORE_ADMIN: [
    "customer.*",
    "product.*",
    "emi.*",
    "invoice.*",
    "approval.*",
    "payment.*",
    "nbfc.*",
    "report.store",
    "ledger.read",
    "settings.read",
    "settings.store",
    "store.read",
    "user.read",
    "user.manage",
  ],
  CASHIER: [
    "customer.*",
    "product.read",
    "emi.create",
    "emi.read",
    "emi.followup",
    "invoice.create",
    "invoice.read",
    "approval.create",
    "payment.collect",
    "payment.read",
    "nbfc.*",
    "store.read",
  ],
  ACCOUNTANT: ["*.read", "payment.reconcile", "report.store", "ledger.read"],
  AGENT: ["customer.read", "emi.read", "emi.followup", "payment.collect", "store.read"],
  SUPER_ADMIN: ["super.*"],
};

const ROLE_LABELS = {
  OWNER: "Owner",
  STORE_ADMIN: "Store Admin",
  CASHIER: "Cashier",
  ACCOUNTANT: "Accountant",
  AGENT: "Collection agent",
  SUPER_ADMIN: "Super Admin",
};

const grants = (granted, perm) => {
  if (granted === perm) return true;
  if (granted === "*") return !perm.startsWith("super.");
  if (granted.endsWith(".*")) return perm.startsWith(granted.slice(0, -1));
  if (granted.startsWith("*.")) return perm.endsWith(granted.slice(1));
  return false;
};

const roleCan = (role, perm) => (PERMISSIONS[role] || []).some((g) => grants(g, perm));

const permissionsOf = (roles) => [...new Set(roles.flatMap((r) => PERMISSIONS[r.role] || []))];

const stateFromGstin = (gstin) => (/^\d{2}[A-Z0-9]{13}$/i.test(gstin || "") ? gstin.slice(0, 2) : null);

// First use by a shop owner: create their tenant and a first store
async function bootstrapTenant(owner) {
  const existing = await Tenant.findById(owner._id);
  if (existing) return existing;
  const info = owner.businessInfo || {};
  const name = info.businessName || `${owner.name.split(" ")[0]}'s shop`;
  const stateCode = stateFromGstin(info.gstNumber) || "23";
  const prefix = (name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3) || "INV").toUpperCase().padEnd(2, "X");
  try {
    const tenant = await Tenant.create({ _id: owner._id, name, legalName: name, gstin: info.gstNumber, stateCode, address: info.address, phone: info.businessPhone || owner.phone });
    await Store.create({ tenantId: owner._id, name: "Main store", stateCode, invoicePrefix: prefix, address: info.address, phone: info.businessPhone || owner.phone });
    return tenant;
  } catch (error) {
    if (error.code === 11000) return Tenant.findById(owner._id); // a parallel request created it
    throw error;
  }
}

/**
 * Works out, for the signed-in user, which shop (tenant) they act for, their
 * roles and which stores they may see. Puts it on req.emi.
 *  - shop owner (role "user"): OWNER of their own shop, every store
 *  - staff (role "staff"): roles given by the owner, per store
 *  - Super Admin: only the /super routes (or "Open as shop" for a shop view)
 */
const emiContext = async (req, res, next) => {
  try {
    const user = req.user;
    if (user.role === "admin") {
      throw new AppError(403, "Super Admin ke liye Super Admin panel hai; dukaan ka panel dekhne ke liye 'Open as shop' use karo");
    }

    let owner = user;
    let roles;
    if (user.role === "staff") {
      if (!user.tenantId || user.staffActive === false) throw new AppError(403, "Aapka staff account band hai");
      owner = await User.findById(user.tenantId).select("name role subscription businessInfo phone");
      if (!owner) throw new AppError(403, "Dukaan nahi mili");
      roles = (user.emiRoles || []).map((r) => ({ role: r.role, storeId: r.storeId || null }));
      if (!roles.length) throw new AppError(403, "Aapko abhi koi role nahi diya gaya hai");
    } else {
      roles = [{ role: "OWNER", storeId: null }];
    }

    if (owner.subscription?.status !== "active") {
      throw new AppError(403, "Dukaan ka subscription active nahi hai");
    }

    const tenant = await bootstrapTenant(owner);
    if (tenant.status === "SUSPENDED") {
      throw new AppError(403, `Dukaan suspended hai${tenant.suspendedReason ? `: ${tenant.suspendedReason}` : ""}`);
    }

    const allStores = roles.some((r) => !r.storeId);
    req.emi = {
      tenantId: owner._id,
      tenant,
      roles,
      isOwner: roles.some((r) => r.role === "OWNER"),
      storeIds: allStores ? null : roles.map((r) => new mongoose.Types.ObjectId(String(r.storeId))),
      permissions: permissionsOf(roles),
    };
    next();
  } catch (error) {
    next(error);
  }
};

// Can this request do `perm`, at `storeId` if given?
const can = (req, perm, storeId) =>
  req.emi.roles.some((r) => (!storeId || !r.storeId || String(r.storeId) === String(storeId)) && roleCan(r.role, perm));

// Route guard. With a :storeId in the URL, the role must cover that store.
const need = (perm) => (req, res, next) => {
  // Platform screens: both admin panels may look (super.read); only the
  // Super Admin may change anything (every other super.* permission)
  if (perm.startsWith("super.")) {
    if (req.user?.role === "admin" && (req.adminLevel !== "admin" || perm === "super.read")) return next();
    return next(new AppError(403, "Ye sirf Super Admin kar sakta hai"));
  }
  if (!can(req, perm, req.params.storeId)) {
    return next(new AppError(403, `Aapke role ko "${perm}" ki permission nahi hai`));
  }
  next();
};

// Collection agents only ever see the contracts assigned to them
const agentOnly = (req) => req.emi.roles.every((r) => r.role === "AGENT");

module.exports = { PERMISSIONS, ROLE_LABELS, roleCan, can, need, emiContext, agentOnly, bootstrapTenant, permissionsOf };
