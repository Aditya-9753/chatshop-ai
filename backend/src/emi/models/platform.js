const mongoose = require("mongoose");
const { tenantScope } = require("../plugins/tenantScope");

const { ObjectId, Mixed } = mongoose.Schema.Types;

// A tenant is one ChatShop shop: its _id is the shop owner's user id, so the
// EMI module hangs off the same account as the inbox, orders and catalog.
const tenantSchema = new mongoose.Schema(
  {
    _id: { type: ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    legalName: String,
    gstin: { type: String, uppercase: true, trim: true },
    stateCode: { type: String, default: "23" }, // GST state code of the head office
    address: String,
    phone: String,
    plan: { type: String, default: "standard" },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE" },
    suspendedReason: String,
  },
  { timestamps: true }
);

// A branch. Invoice and receipt numbers run per store with its own prefix.
const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    stateCode: { type: String, required: true },
    invoicePrefix: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z0-9]{2,6}$/ },
    address: String,
    phone: String,
    gstin: { type: String, uppercase: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
storeSchema.plugin(tenantScope);
storeSchema.index({ tenantId: 1, invoicePrefix: 1 }, { unique: true });

// One override row per scope: PLATFORM (scopeId null), TENANT or STORE
const settingSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ["PLATFORM", "TENANT", "STORE"], required: true },
    scopeId: { type: ObjectId, default: null },
    value: { type: Mixed, default: {} },
    updatedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, minimize: false }
);
settingSchema.index({ scope: 1, scopeId: 1 }, { unique: true });

// Gap-free sequences (INV:<storeId>, RCPT:<storeId>, EMI:<storeId>)
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
counterSchema.plugin(tenantScope);
counterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

const Tenant = mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);
const Store = mongoose.models.Store || mongoose.model("Store", storeSchema);
const Setting = mongoose.models.Setting || mongoose.model("Setting", settingSchema);
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

module.exports = { Tenant, Store, Setting, Counter };
