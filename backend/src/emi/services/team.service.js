const bcrypt = require("bcryptjs");
const { assertWithinLimit } = require("../../billing/subscriptions");
const User = require("../../models/User.model");
const { Store, Tenant, CustomRole } = require("../models/platform");
const { AppError, audit, isOid } = require("../utils/helpers");
const { can, CUSTOM_ABILITIES, ROLE_LABELS } = require("../middleware/rbac");
const authService = require("../../services/auth.service");

const STAFF_FIELDS = "name email phone role tenantId emiRoles staffActive approvalStatus approvalNote isVerified phoneVerified createdAt";

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
  const customIds = roles.filter((r) => r.role === "CUSTOM").map((r) => r.customRoleId);
  if (customIds.some((id) => !isOid(id))) throw new AppError(422, "Apna banaya role chuno");
  const customFound = await CustomRole.countDocuments({ tenantId: req.emi.tenantId, _id: { $in: customIds }, active: { $ne: false } });
  if (customFound !== new Set(customIds.map(String)).size) throw new AppError(422, "Ye role nahi mila");
  for (const r of roles) {
    if (!["STORE_ADMIN", "CASHIER", "ACCOUNTANT", "AGENT", "CUSTOM"].includes(r.role)) throw new AppError(422, `Role ${r.role} galat hai`);
    if (req.emi.isOwner) continue;
    if (r.role === "STORE_ADMIN") throw new AppError(403, "Store Admin sirf Owner bana sakta hai");
    if (!r.storeId || !can(req, "user.manage", r.storeId)) throw new AppError(403, "Sirf apne store ka staff bana sakte ho");
  }
  return roles.map((r) => ({ role: r.role, storeId: r.storeId || null, ...(r.role === "CUSTOM" && { customRoleId: r.customRoleId }) }));
}

// ---- Roles the shop owner makes up ----

// Custom roles with how many staff hold each, plus the work a role can be given
async function listRoles(req) {
  const [roles, holders] = await Promise.all([
    CustomRole.find({ tenantId: req.emi.tenantId }).sort({ name: 1 }).lean(),
    User.aggregate([
      { $match: { tenantId: req.emi.tenantId, role: "staff", "emiRoles.role": "CUSTOM" } },
      { $unwind: "$emiRoles" },
      { $group: { _id: "$emiRoles.customRoleId", users: { $addToSet: "$_id" } } },
    ]),
  ]);
  const count = new Map(holders.map((h) => [String(h._id), h.users.length]));
  const abilities = Object.entries(CUSTOM_ABILITIES).map(([key, a]) => ({ key, label: a.label, detail: a.detail }));
  return { roles: roles.map((r) => ({ ...r, staffCount: count.get(String(r._id)) || 0 })), abilities };
}

const cleanAbilities = (abilities) => {
  const keys = [...new Set(abilities)];
  const bad = keys.filter((k) => !CUSTOM_ABILITIES[k]);
  if (bad.length) throw new AppError(422, `Ye kaam galat hai: ${bad.join(", ")}`);
  return keys;
};

const ownerOnly = (req) => {
  if (!req.emi.isOwner) throw new AppError(403, "Naye role sirf shop owner bana sakta hai");
};

async function saveRole(req, roleId, { name, abilities, active }) {
  ownerOnly(req);
  const taken = await CustomRole.findOne({ tenantId: req.emi.tenantId, name, ...(roleId && { _id: { $ne: roleId } }) }).collation({ locale: "en", strength: 2 });
  if (taken || Object.values(ROLE_LABELS).some((l) => l.toLowerCase() === name.toLowerCase())) throw new AppError(409, `"${name}" naam ka role pehle se hai`);
  const clean = cleanAbilities(abilities);
  let role;
  if (roleId) {
    role = await CustomRole.findOne({ tenantId: req.emi.tenantId, _id: roleId });
    if (!role) throw new AppError(404, "Role nahi mila");
    const nextActive = active === undefined ? role.active !== false : active;
    const before = { name: role.name, abilities: role.abilities, active: role.active !== false };
    Object.assign(role, { name, abilities: clean, active: nextActive });
    await role.save();
    if (before.active && !nextActive) {
      await User.updateMany(
        { tenantId: req.emi.tenantId, role: "staff", "emiRoles.customRoleId": role._id },
        { $inc: { staffAuthVersion: 1 } }
      );
    }
    await audit(req, "role.update", { entity: "CustomRole", entityId: role._id, before, after: { name, abilities: clean, active: nextActive } });
  } else {
    const isActive = active !== false;
    role = await CustomRole.create({ tenantId: req.emi.tenantId, name, abilities: clean, active: isActive, createdBy: req.user._id });
    await audit(req, "role.create", { entity: "CustomRole", entityId: role._id, after: { name, abilities: clean, active: isActive } });
  }
  return role;
}

// Only a role nobody holds can go, so no one is left without work
async function deleteRole(req, roleId) {
  ownerOnly(req);
  const role = await CustomRole.findOne({ tenantId: req.emi.tenantId, _id: roleId });
  if (!role) throw new AppError(404, "Role nahi mila");
  const holders = await User.countDocuments({ tenantId: req.emi.tenantId, role: "staff", "emiRoles.customRoleId": role._id });
  if (holders) throw new AppError(409, `${holders} staff ke paas ye role hai; pehle unka role badlo`);
  await CustomRole.deleteOne({ tenantId: req.emi.tenantId, _id: role._id });
  await audit(req, "role.delete", { entity: "CustomRole", entityId: role._id, before: { name: role.name, abilities: role.abilities } });
  return { deleted: true };
}

async function listStaff(req) {
  const staff = await User.find({ tenantId: req.emi.tenantId, role: "staff" }).select(STAFF_FIELDS).sort({ createdAt: 1 }).lean();
  if (!req.emi.storeIds) return staff;
  const mine = req.emi.storeIds.map(String);
  return staff.filter((u) => u.emiRoles.some((r) => r.storeId && mine.includes(String(r.storeId))));
}

// Staff the shop owner adds can sign in straight away; staff a Store Admin
// adds wait until the owner approves them (`approved` forces it, e.g. when
// the Super Admin adds staff)
async function createStaff(req, { name, email, phone, password, roles }, { approved = req.emi.isOwner } = {}) {
  await assertWithinLimit(req.emi.tenantId, "staff");
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
    isVerified: false,
    phoneVerified: false,
  });
  const [emailDelivery, phoneDelivery] = await Promise.allSettled([
    authService.sendEmailVerification(user._id),
    user.phone !== "-" ? authService.sendPhoneVerification(user._id) : Promise.resolve({ sent: false }),
  ]);
  if (emailDelivery.status === "rejected") console.error("Staff email verification failed:", emailDelivery.reason.message);
  if (phoneDelivery.status === "rejected") console.error("Staff mobile verification failed:", phoneDelivery.reason.message);
  await audit(req, "staff.create", { entity: "User", entityId: user._id, after: { email: user.email, roles: emiRoles, approvalStatus: user.approvalStatus } });
  const staff = await User.findById(user._id).select(STAFF_FIELDS).lean();
  return {
    ...staff,
    verification: {
      emailSent: emailDelivery.status === "fulfilled" && emailDelivery.value.sent === true,
      phoneSent: phoneDelivery.status === "fulfilled" && phoneDelivery.value.sent === true,
    },
  };
}

// The shop owner approves or rejects staff a Store Admin asked for
async function decideStaff(req, staffId, { decision, note }) {
  if (!req.emi.isOwner) throw new AppError(403, "Staff ko sirf shop owner approve kar sakta hai");
  const user = await User.findOne({ _id: staffId, tenantId: req.emi.tenantId, role: "staff" });
  if (!user) throw new AppError(404, "Staff nahi mila");
  if (decision === "REJECTED" && !note) throw new AppError(422, "Reject karne ka kaaran likho");
  const before = { approvalStatus: user.approvalStatus };
  user.approvalStatus = decision;
  user.approvalNote = decision === "REJECTED" ? note : undefined;
  if (decision === "REJECTED") user.staffAuthVersion = (user.staffAuthVersion || 0) + 1;
  await user.save();
  await audit(req, `staff.${decision === "APPROVED" ? "approve" : "reject"}`, { entity: "User", entityId: user._id, before, after: { approvalStatus: decision, email: user.email }, reason: note });
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
  const phoneChanged = phone !== undefined && phone !== user.phone;
  if (phoneChanged) {
    user.phone = phone;
    user.phoneVerified = false;
    user.phoneVerificationOtpHash = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationAttempts = 0;
  }
  if (password) {
    if (password.length < 8) throw new AppError(422, "Password kam se kam 8 characters ka ho");
    user.password = await bcrypt.hash(password, 10);
  }
  // Switching someone off or changing their roles ends their sessions
  if (staffActive === false || roles || password) user.staffAuthVersion = (user.staffAuthVersion || 0) + 1;
  await user.save();
  if (phoneChanged && user.phone !== "-") await authService.sendPhoneVerification(user._id);
  await audit(req, "staff.update", { entity: "User", entityId: user._id, before, after: { roles: user.emiRoles, staffActive: user.staffActive, passwordReset: Boolean(password) } });
  return User.findById(user._id).select(STAFF_FIELDS).lean();
}

module.exports = { listStores, createStore, updateStore, updateTenant, listStaff, createStaff, updateStaff, decideStaff, listRoles, saveRole, deleteRole };
