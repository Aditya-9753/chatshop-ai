const bcrypt = require("bcryptjs");
const User = require("../../models/User.model");
const { Store, Tenant } = require("../models/platform");
const { AppError, audit, isOid } = require("../utils/helpers");
const { can } = require("../middleware/rbac");

const STAFF_FIELDS = "name email phone role tenantId emiRoles staffActive approvalStatus approvalNote createdAt";

async function listStores(req) {
  const filter = { tenantId: req.emi.tenantId };
  if (req.emi.storeIds) filter._id = { $in: req.emi.storeIds };
  return Store.find(filter).sort({ createdAt: 1 }).lean();
}

const STORE_FIELDS = ["name", "stateCode", "invoicePrefix", "address", "phone", "gstin", "active"];
const pick = (body, fields) => Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

async function createStore(req, body) {
  try {
    const store = await Store.create({ tenantId: req.emi.tenantId, ...pick(body, STORE_FIELDS) });
    await audit(req, "store.create", { entity: "Store", entityId: store._id, after: pick(store, STORE_FIELDS) });
    return store;
  } catch (error) {
    if (error.code === 11000) throw new AppError(409, `Invoice prefix "${body.invoicePrefix}" pehle se kisi store ka hai`);
    throw error;
  }
}

async function updateStore(req, storeId, body) {
  const store = await Store.findOne({ tenantId: req.emi.tenantId, _id: storeId });
  if (!store) throw new AppError(404, "Store nahi mila");
  const before = pick(store, STORE_FIELDS);
  // Changing the prefix mid-year would break the invoice series
  if (body.invoicePrefix && body.invoicePrefix.toUpperCase() !== store.invoicePrefix) {
    throw new AppError(422, "Invoice prefix badla nahi ja sakta; naya store banao");
  }
  Object.assign(store, pick(body, STORE_FIELDS.filter((f) => f !== "invoicePrefix")));
  await store.save();
  await audit(req, "store.update", { entity: "Store", entityId: store._id, before, after: pick(store, STORE_FIELDS) });
  return store;
}

// Shop details printed on invoices (owner only)
async function updateTenant(req, body) {
  const tenant = await Tenant.findById(req.emi.tenantId);
  const fields = ["name", "legalName", "gstin", "stateCode", "address", "phone"];
  const before = pick(tenant, fields);
  Object.assign(tenant, pick(body, fields));
  await tenant.save();
  await audit(req, "tenant.update", { entity: "Tenant", entityId: tenant._id, before, after: pick(tenant, fields) });
  return tenant;
}

// Roles a request may hand out: the owner anything; a Store Admin only
// cashier/accountant/agent roles in stores they run
async function checkRoles(req, roles) {
  if (!Array.isArray(roles) || roles.length === 0) throw new AppError(422, "Kam se kam ek role do");
  const storeIds = roles.map((r) => r.storeId).filter(Boolean);
  if (storeIds.some((id) => !isOid(id))) throw new AppError(422, "Store galat hai");
  const found = await Store.countDocuments({ tenantId: req.emi.tenantId, _id: { $in: storeIds } });
  if (found !== new Set(storeIds.map(String)).size) throw new AppError(422, "Store nahi mila");
  for (const r of roles) {
    if (!["STORE_ADMIN", "CASHIER", "ACCOUNTANT", "AGENT"].includes(r.role)) throw new AppError(422, `Role ${r.role} galat hai`);
    if (req.emi.isOwner) continue;
    if (r.role === "STORE_ADMIN") throw new AppError(403, "Store Admin sirf Owner bana sakta hai");
    if (!r.storeId || !can(req, "user.manage", r.storeId)) throw new AppError(403, "Sirf apne store ka staff bana sakte ho");
  }
  return roles.map((r) => ({ role: r.role, storeId: r.storeId || null }));
}

async function listStaff(req) {
  const staff = await User.find({ tenantId: req.emi.tenantId, role: "staff" }).select(STAFF_FIELDS).sort({ createdAt: 1 }).lean();
  if (!req.emi.storeIds) return staff;
  const mine = req.emi.storeIds.map(String);
  return staff.filter((u) => u.emiRoles.some((r) => r.storeId && mine.includes(String(r.storeId))));
}

// Staff added by a shop wait for the Super Admin (`approved` is only true
// when the Super Admin adds them)
async function createStaff(req, { name, email, phone, password, roles }, { approved = false } = {}) {
  const emiRoles = await checkRoles(req, roles);
  if (!password || password.length < 8) throw new AppError(422, "Password kam se kam 8 characters ka ho");
  if (await User.exists({ email: String(email).toLowerCase() })) throw new AppError(409, "Is email se account pehle se hai");
  const user = await User.create({
    name,
    email,
    phone: phone || "-",
    password: await bcrypt.hash(password, 10),
    role: "staff",
    tenantId: req.emi.tenantId,
    emiRoles,
    approvalStatus: approved ? "APPROVED" : "PENDING",
    isVerified: true,
  });
  await audit(req, "staff.create", { entity: "User", entityId: user._id, after: { email: user.email, roles: emiRoles, approvalStatus: user.approvalStatus } });
  return User.findById(user._id).select(STAFF_FIELDS).lean();
}

async function updateStaff(req, staffId, { roles, staffActive, password, name, phone }) {
  const user = await User.findOne({ _id: staffId, tenantId: req.emi.tenantId, role: "staff" });
  if (!user) throw new AppError(404, "Staff nahi mila");
  // A Store Admin may only touch staff of their own stores
  await checkRoles(req, user.emiRoles.length ? user.emiRoles : [{ role: "CASHIER", storeId: null }]).catch(() => {
    throw new AppError(403, "Is staff ko aap badal nahi sakte");
  });
  const before = { roles: user.emiRoles, staffActive: user.staffActive };
  if (roles) user.emiRoles = await checkRoles(req, roles);
  if (typeof staffActive === "boolean") user.staffActive = staffActive;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (password) {
    if (password.length < 8) throw new AppError(422, "Password kam se kam 8 characters ka ho");
    user.password = await bcrypt.hash(password, 10);
    user.passwordChangedAt = new Date();
  }
  // Switching someone off or changing their roles ends their sessions
  if (staffActive === false || roles) user.passwordChangedAt = new Date();
  await user.save();
  await audit(req, "staff.update", { entity: "User", entityId: user._id, before, after: { roles: user.emiRoles, staffActive: user.staffActive, passwordReset: Boolean(password) } });
  return User.findById(user._id).select(STAFF_FIELDS).lean();
}

module.exports = { listStores, createStore, updateStore, updateTenant, listStaff, createStaff, updateStaff };
