// Demo data for EMI & billing. Safe to re-run: it only adds what is missing
// and never deletes anything. Every demo login's password is Password@123.
//
//   npm run seed:emi
//
// Refuses to run against a non-local database unless --force is given:
// demo logins with a known password must never reach production.
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./src/models/User.model");
const Customer = require("./src/models/Customer.model");
const Product = require("./src/models/Product.model");
const { Tenant, Store } = require("./src/emi/models/platform");
const { InventoryItem } = require("./src/emi/models/sales");
const { NbfcPartner } = require("./src/emi/models/finance");

const PASSWORD = "Password@123";
const uri = process.env.MONGODB_URI || "";
const local = /mongodb(\+srv)?:\/\/(localhost|127\.0\.0\.1)/.test(uri);

async function user(email, data) {
  const existing = await User.findOne({ email });
  if (existing) return [existing, false];
  const created = await User.create({ email, password: await bcrypt.hash(PASSWORD, 10), isVerified: true, phone: "+919000000000", ...data });
  return [created, true];
}

async function run() {
  if (!local && !process.argv.includes("--force")) {
    throw new Error("MONGODB_URI is not a local database. Demo logins must not go to production (use --force for a staging copy).");
  }
  await mongoose.connect(uri);
  await Promise.all([Tenant, Store, InventoryItem, NbfcPartner, Customer, Product, User].map((m) => m.syncIndexes()));
  const log = (what, created) => console.log(`${created ? "➕" : "✔️ "} ${what}`);

  // Super Admin (ChatShop admin) and the shop owner
  const [, superCreated] = await user("super@crm.local", { name: "Super Admin", role: "admin" });
  log("super@crm.local (Super Admin panel)", superCreated);

  const yearOut = new Date(Date.now() + 365 * 86400000);
  const [owner, ownerCreated] = await user("owner@crm.local", {
    name: "Demo Owner",
    businessInfo: { businessName: "Bhopal Mobiles", gstNumber: "23ABCDE1234F1Z5", address: "MP Nagar, Bhopal" },
    subscription: { plan: "business", status: "active", startDate: new Date(), endDate: yearOut },
  });
  log("owner@crm.local (shop owner, all stores)", ownerCreated);

  let tenant = await Tenant.findById(owner._id);
  if (!tenant) {
    tenant = await Tenant.create({ _id: owner._id, name: "Bhopal Mobiles", legalName: "Bhopal Mobiles Pvt Ltd", gstin: "23ABCDE1234F1Z5", stateCode: "23", address: "MP Nagar, Bhopal 462011", phone: "+919000000001" });
  }
  let store = await Store.findOne({ tenantId: owner._id, invoicePrefix: "BPL" });
  if (!store) {
    // A tenant made on first login has a default store; rename it into the demo one
    store = await Store.findOne({ tenantId: owner._id });
    if (store && !(await Store.exists({ tenantId: owner._id, invoicePrefix: "BPL" }))) {
      Object.assign(store, { name: "Bhopal – MP Nagar", stateCode: "23", invoicePrefix: "BPL", address: "MP Nagar, Bhopal 462011" });
      await store.save();
    } else {
      store = await Store.create({ tenantId: owner._id, name: "Bhopal – MP Nagar", stateCode: "23", invoicePrefix: "BPL", address: "MP Nagar, Bhopal 462011" });
    }
  }
  log(`store ${store.name} (prefix BPL)`, false);

  const staff = [
    ["admin@crm.local", "Store Admin", "STORE_ADMIN"],
    ["cashier@crm.local", "Cashier", "CASHIER"],
    ["accounts@crm.local", "Accountant", "ACCOUNTANT"],
    ["agent@crm.local", "Collection Agent", "AGENT"],
  ];
  for (const [email, name, role] of staff) {
    const [, created] = await user(email, { name, role: "staff", tenantId: owner._id, emiRoles: [{ role, storeId: role === "ACCOUNTANT" ? null : store._id }] });
    log(`${email} (${name})`, created);
  }

  // Two phone models, five IMEIs each
  const assets = path.join(__dirname, "seed-assets/products");
  const uploads = path.join(__dirname, "uploads/products");
  fs.mkdirSync(uploads, { recursive: true });
  const phones = [
    { name: "Samsung Galaxy S24", price: 79999, file: "samsung-galaxy-s24.png", imeiBase: "35693811" },
    { name: "iPhone 15 Pro", price: 134900, file: "iphone-15-pro.jpg", imeiBase: "35385211" },
  ];
  for (const p of phones) {
    let product = await Product.findOne({ userId: owner._id, name: p.name });
    if (!product) {
      fs.copyFileSync(path.join(assets, p.file), path.join(uploads, `seed-${p.file}`));
      product = await Product.create({ userId: owner._id, name: p.name, price: p.price, category: "Mobiles", hsn: "8517", gstRatePct: 18, serialized: true, stock: 0, images: [`/uploads/products/seed-${p.file}`] });
    }
    let added = 0;
    for (let i = 1; i <= 5; i++) {
      const imei = `${p.imeiBase}${String(1000000 + i).slice(1)}`;
      const res = await InventoryItem.updateOne(
        { tenantId: owner._id, imei },
        { $setOnInsert: { tenantId: owner._id, storeId: store._id, productId: product._id, imei, status: "IN_STOCK" } },
        { upsert: true }
      );
      added += res.upsertedCount;
    }
    if (added) await Product.updateOne({ _id: product._id }, { $inc: { stock: added } });
    log(`${p.name}: ${added} IMEI(s) added`, added > 0);
  }

  // One KYC-verified customer
  let customer = await Customer.findOne({ userId: owner._id, phone: "+919876543210" });
  if (!customer) {
    customer = await Customer.create({
      userId: owner._id,
      platform: "whatsapp",
      name: "Ravi Kumar",
      phone: "+919876543210",
      pan: "ABCDE1234F",
      address: "Arera Colony, Bhopal",
      stateCode: "23",
      kycStatus: "VERIFIED",
      kycDocs: [{ type: "PAN", number: "ABCDE1234F" }],
      kycVerifiedAt: new Date(),
      riskGrade: "A",
    });
  }
  log("customer Ravi Kumar (KYC verified)", false);

  // One NBFC partner (platform level)
  const partner = await NbfcPartner.findOneAndUpdate(
    { name: "Demo Finance Ltd" },
    { $setOnInsert: { name: "Demo Finance Ltd", subventionPct: 3, settlementDays: 7, active: true } },
    { upsert: true, new: true }
  );
  log(`NBFC partner ${partner.name} (3% subvention)`, false);

  console.log(`\n✅ EMI demo ready. Every login above uses the password ${PASSWORD}.`);
  console.log("   Shop owner and staff sign in at /login; super@crm.local signs in at /admin/login.");
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("❌ EMI seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
