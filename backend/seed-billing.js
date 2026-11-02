// Four test shops for billing, each with products, customers, staff and a
// few sales that fit its trade. Safe to re-run: it only adds what is missing
// and never deletes anything. Every shop login's password is Shop@12345,
// every staff login's is Staff@12345.
//
//   npm run seed:billing
//
// Refuses to run against a non-local database unless --force is given:
// demo logins with a known password must never reach production.
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./src/models/User.model");
const Customer = require("./src/models/Customer.model");
const Product = require("./src/models/Product.model");
const PlatformSettings = require("./src/models/PlatformSettings.model");
const { Tenant, Store } = require("./src/emi/models/platform");
const { InventoryItem, Invoice } = require("./src/emi/models/sales");
const { createSale } = require("./src/emi/services/checkout.service");
const { ensureDefaultPlans } = require("./src/billing/plans");

const SHOP_PASSWORD = "Shop@12345";
const STAFF_PASSWORD = "Staff@12345";
const uri = process.env.MONGODB_URI || "";
const local = /mongodb(\+srv)?:\/\/(localhost|127\.0\.0\.1)/.test(uri);
const DAY_MS = 24 * 60 * 60 * 1000;
const rupee = (r) => Math.round(r * 100);
const istDate = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * DAY_MS).toISOString().slice(0, 10);

// ChatShop AI as the supplier on platform invoices (only if not set yet)
const SUPPLIER = { legalName: "ChatShop AI Pvt Ltd", gstin: "23AAACC1234A1Z5", stateCode: "23", address: "MP Nagar, Bhopal, Madhya Pradesh 462011", sac: "998314", invoicePrefix: "CSA" };

// p(name, price ₹, HSN, GST %, stock, category) — stock is ignored for phones (counted from IMEIs)
const p = (name, price, hsn, gstRatePct, stock, category, extra = {}) => ({ name, price, hsn, gstRatePct, stock, category, ...extra });

const SHOPS = [
  {
    key: "sharma",
    owner: { name: "Rahul Sharma", email: "sharma.mobiles@example.com", phone: "+919876500001" },
    business: { businessName: "Sharma Mobiles", businessType: "Electronics", gstNumber: "23ABCDE1234F1Z5", address: "Shop 12, MP Nagar Zone 1, Bhopal, MP 462011", businessEmail: "sharma.mobiles@example.com", businessPhone: "+919876500001" },
    legalName: "Sharma Mobiles",
    stateCode: "23",
    store: { name: "Bhopal – MP Nagar", prefix: "SHM" },
    products: [
      p("Redmi Note 13 5G (8/256 GB)", 17999, "8517", 18, 0, "Mobiles", { serialized: true, imeiBase: "86420711" }),
      p("Samsung Galaxy A35 5G (8/128 GB)", 30999, "8517", 18, 0, "Mobiles", { serialized: true, imeiBase: "35281611" }),
      p("Phone Cover (silicone)", 500, "3926", 18, 50, "Accessories"),
      p("Charger 25W Type-C", 1200, "8504", 18, 20, "Accessories"),
      p("Bluetooth Earbuds", 2500, "8518", 18, 10, "Accessories"),
      p("Tempered Glass", 250, "7007", 18, 100, "Accessories"),
    ],
    customers: [
      { name: "Ravi Kumar", phone: "+919812300001", address: "Arera Colony, Bhopal", kyc: "ABCDE1234F" },
      { name: "Pooja Singh", phone: "+919812300002", address: "Kolar Road, Bhopal" },
      { name: "Mohan Lal", phone: "+919812300003", address: "New Market, Bhopal" },
    ],
    staff: [{ name: "Kavita Cashier", email: "kavita.cashier@example.com", role: "CASHIER" }],
    sales: [
      { key: "seed-billing-sharma-1", label: "phone, full UPI payment", customer: 0, items: [{ product: 0, imei: true }], payments: [{ method: "UPI", amount: 17999, txnRef: "UPI-SHM-1" }] },
      { key: "seed-billing-sharma-2", label: "earbuds + cover, pay later (₹1,000 now)", customer: 1, items: [{ product: 4, qty: 1 }, { product: 2, qty: 1 }], payments: [{ method: "CASH", amount: 1000 }], credit: 15 },
    ],
  },
  {
    key: "patil",
    owner: { name: "Sunil Patil", email: "patil.cement@example.com", phone: "+919876500002" },
    business: { businessName: "Patil Cement Traders", businessType: "Other", gstNumber: "27AAKCP4321Q1Z8", address: "Plot 7, Kothrud Industrial Area, Pune, Maharashtra 411038", businessEmail: "patil.cement@example.com", businessPhone: "+919876500002" },
    legalName: "Patil Cement Traders",
    stateCode: "27",
    store: { name: "Pune – Kothrud Godown", prefix: "PCT" },
    products: [
      p("UltraTech Cement OPC 53 (50 kg bag)", 420, "2523", 28, 500, "Cement"),
      p("ACC Cement PPC (50 kg bag)", 390, "2523", 28, 400, "Cement"),
      p("TMT Steel Bar 12 mm (per kg)", 68, "7214", 18, 2000, "Steel"),
      p("Red Bricks (per 1000)", 7500, "6901", 12, 40, "Bricks"),
      p("River Sand (per tonne)", 1800, "2505", 5, 60, "Sand & aggregates"),
    ],
    customers: [
      { name: "Deshmukh Builders", phone: "+919822100001", address: "Baner, Pune", gstin: "27AADFD1111A1Z1" },
      { name: "Anil Kulkarni", phone: "+919822100002", address: "Karve Nagar, Pune" },
      { name: "Shinde Constructions", phone: "+919822100003", address: "Hadapsar, Pune" },
    ],
    staff: [{ name: "Ganesh Accountant", email: "ganesh.accounts@example.com", role: "ACCOUNTANT" }],
    sales: [
      { key: "seed-billing-patil-1", label: "100 cement bags, pay later in 30 days (nothing paid now)", customer: 0, items: [{ product: 0, qty: 100 }], payments: [], credit: 30 },
      { key: "seed-billing-patil-2", label: "steel + sand, bank transfer", customer: 1, items: [{ product: 2, qty: 200 }, { product: 4, qty: 2 }], payments: [{ method: "BANK", amount: 200 * 68 + 2 * 1800, txnRef: "NEFT-PCT-1" }] },
    ],
  },
  {
    key: "gupta",
    owner: { name: "Meena Gupta", email: "gupta.kirana@example.com", phone: "+919876500003" },
    // No GSTIN: a small shop not registered for GST
    business: { businessName: "Gupta Kirana Store", businessType: "Food & grocery", gstNumber: "", address: "Rajwada Chowk, Indore, MP 452002", businessEmail: "gupta.kirana@example.com", businessPhone: "+919876500003" },
    legalName: "Gupta Kirana Store",
    stateCode: "23",
    store: { name: "Indore – Rajwada", prefix: "GKS" },
    products: [
      p("Aashirvaad Atta (10 kg)", 480, "1101", 5, 40, "Staples"),
      p("Tata Salt (1 kg)", 28, "2501", 0, 120, "Staples"),
      p("Fortune Sunflower Oil (1 L)", 155, "1512", 5, 60, "Oil & ghee"),
      p("Toor Dal (1 kg)", 160, "0713", 5, 80, "Staples"),
      p("Amul Butter (500 g)", 285, "0405", 12, 25, "Dairy"),
      p("Surf Excel (1 kg)", 140, "3402", 18, 50, "Household"),
    ],
    customers: [
      { name: "Sunita Joshi", phone: "+919826200001", address: "Sarafa, Indore" },
      { name: "Rakesh Yadav", phone: "+919826200002", address: "Malharganj, Indore" },
      { name: "Farida Khan", phone: "+919826200003", address: "Chhatripura, Indore" },
    ],
    staff: [],
    sales: [
      { key: "seed-billing-gupta-1", label: "monthly ration, cash", customer: 0, items: [{ product: 0, qty: 1 }, { product: 2, qty: 2 }, { product: 3, qty: 2 }, { product: 1, qty: 1 }], payments: [{ method: "CASH", amount: 480 + 2 * 155 + 2 * 160 + 28 }] },
      { key: "seed-billing-gupta-2", label: "regular customer, pay later (khata)", customer: 1, items: [{ product: 4, qty: 1 }, { product: 5, qty: 2 }], payments: [], credit: 7 },
    ],
  },
  {
    key: "verma",
    owner: { name: "Amit Verma", email: "verma.garments@example.com", phone: "+919876500004" },
    business: { businessName: "Verma Garments", businessType: "Fashion & apparel", gstNumber: "23AAJFV5678K1Z2", address: "Sarafa Bazaar, Gwalior, MP 474001", businessEmail: "verma.garments@example.com", businessPhone: "+919876500004" },
    legalName: "Verma Garments",
    stateCode: "23",
    store: { name: "Gwalior – Sarafa Bazaar", prefix: "VGM" },
    products: [
      // Clothes: 5% GST up to ₹1,000 a piece, 12% above
      p("Men's Cotton Shirt", 899, "6205", 5, 30, "Men"),
      p("Men's Slim Fit Jeans", 1599, "6203", 12, 25, "Men"),
      p("Women's Printed Kurti", 1299, "6204", 12, 35, "Women"),
      p("Kids Cotton T-shirt", 399, "6109", 5, 50, "Kids"),
      p("Banarasi Silk Saree", 3499, "5007", 5, 12, "Women"),
    ],
    customers: [
      { name: "Priya Tomar", phone: "+919827300001", address: "Lashkar, Gwalior" },
      { name: "Vikas Rathore", phone: "+919827300002", address: "Morar, Gwalior" },
      { name: "Anjali Bhadoria", phone: "+919827300003", address: "City Centre, Gwalior" },
    ],
    staff: [{ name: "Neha Cashier", email: "neha.cashier@example.com", role: "CASHIER" }],
    sales: [
      { key: "seed-billing-verma-1", label: "saree + kurti, card", customer: 0, items: [{ product: 4, qty: 1 }, { product: 2, qty: 1 }], payments: [{ method: "DEBIT_CARD", amount: 3499 + 1299, txnRef: "CARD-VGM-1" }] },
      { key: "seed-billing-verma-2", label: "shirts + jeans, pay later (₹1,500 now)", customer: 1, items: [{ product: 0, qty: 2 }, { product: 1, qty: 1 }], payments: [{ method: "UPI", amount: 1500, txnRef: "UPI-VGM-1" }], credit: 10 },
    ],
  },
];

const log = (what, created) => console.log(`${created ? "➕" : "✔️ "} ${what}`);

async function upsertUser(email, data, password) {
  const existing = await User.findOne({ email });
  if (existing) return [existing, false];
  return [await User.create({ email, password: await bcrypt.hash(password, 10), isVerified: true, ...data }), true];
}

async function seedShop(shop) {
  console.log(`\n🏪 ${shop.business.businessName}`);

  // Owner: a fresh 14-day Premium trial, like a real sign-up
  const [owner, created] = await upsertUser(
    shop.owner.email,
    {
      name: shop.owner.name,
      phone: shop.owner.phone,
      role: "user",
      businessInfo: shop.business,
      subscription: { plan: "premium", status: "active", trial: true, startDate: new Date(), endDate: new Date(Date.now() + 14 * DAY_MS) },
    },
    SHOP_PASSWORD
  );
  log(`owner ${shop.owner.email}${created ? ` (trial, password ${SHOP_PASSWORD})` : " (already registered: password unchanged)"}`, created);

  // Registered by hand before: fill in only the business details still empty
  if (!created) {
    const fill = Object.fromEntries(Object.entries(shop.business).filter(([k, v]) => v && !owner.businessInfo?.[k]).map(([k, v]) => [`businessInfo.${k}`, v]));
    if (Object.keys(fill).length) {
      await User.updateOne({ _id: owner._id }, { $set: fill });
      Object.assign((owner.businessInfo ||= {}), shop.business);
      log(`filled in ${Object.keys(fill).map((k) => k.split(".")[1]).join(", ")}`, true);
    }
  }

  // EMI & billing approved, with the shop's own GST state and one store
  let tenant = await Tenant.findById(owner._id);
  if (!tenant) {
    tenant = await Tenant.create({
      _id: owner._id,
      name: shop.business.businessName,
      legalName: shop.legalName,
      gstin: shop.business.gstNumber || undefined,
      stateCode: shop.stateCode,
      address: shop.business.address,
      phone: shop.owner.phone,
      status: "ACTIVE",
      decidedAt: new Date(),
    });
    log("EMI & billing approved", true);
  } else {
    if (tenant.status === "PENDING") {
      tenant.status = "ACTIVE";
      tenant.decidedAt = new Date();
      log("EMI & billing approved", true);
    }
    if (!tenant.gstin && shop.business.gstNumber) {
      tenant.gstin = shop.business.gstNumber;
      tenant.stateCode = shop.stateCode;
    }
    if (!tenant.address) tenant.address = shop.business.address;
    await tenant.save();
  }

  let store = await Store.findOne({ tenantId: owner._id, invoicePrefix: shop.store.prefix });
  if (!store) {
    // A tenant made on first login has a default store: turn it into this one
    store = await Store.findOne({ tenantId: owner._id });
    if (store) Object.assign(store, { name: shop.store.name, stateCode: shop.stateCode, invoicePrefix: shop.store.prefix, address: shop.business.address, gstin: shop.business.gstNumber || undefined });
    else store = new Store({ tenantId: owner._id, name: shop.store.name, stateCode: shop.stateCode, invoicePrefix: shop.store.prefix, address: shop.business.address, gstin: shop.business.gstNumber || undefined, phone: shop.owner.phone });
    await store.save();
    log(`store ${shop.store.name} (invoices ${shop.store.prefix}-000001…)`, true);
  } else if (!store.gstin && shop.business.gstNumber) {
    store.gstin = shop.business.gstNumber;
    await store.save();
  }

  // Products, and phones' IMEIs in the store
  const products = [];
  for (const item of shop.products) {
    let product = await Product.findOne({ userId: owner._id, name: item.name });
    const isNew = !product;
    if (!product) {
      product = await Product.create({
        userId: owner._id,
        name: item.name,
        price: item.price,
        category: item.category,
        hsn: item.hsn,
        gstRatePct: item.gstRatePct,
        serialized: Boolean(item.serialized),
        stock: item.serialized ? 0 : item.stock,
        sku: `${shop.store.prefix}-${String(products.length + 1).padStart(3, "0")}`,
        isActive: true,
      });
    }
    if (item.serialized) {
      let added = 0;
      for (let i = 1; i <= 5; i++) {
        const imei = `${item.imeiBase}${String(1000000 + i).slice(1)}`;
        const res = await InventoryItem.updateOne(
          { tenantId: owner._id, imei },
          { $setOnInsert: { tenantId: owner._id, storeId: store._id, productId: product._id, imei, status: "IN_STOCK", addedBy: owner._id } },
          { upsert: true }
        );
        added += res.upsertedCount;
      }
      if (added) await Product.updateOne({ _id: product._id }, { $inc: { stock: added } });
      log(`${item.name} · ₹${item.price} · GST ${item.gstRatePct}% · ${added ? `${added} IMEIs added` : "IMEIs in stock"}`, isNew || added > 0);
    } else {
      log(`${item.name} · ₹${item.price} · GST ${item.gstRatePct}% · stock ${item.stock}`, isNew);
    }
    products.push(product);
  }

  // Customers, in the shop's own state
  const customers = [];
  for (const c of shop.customers) {
    let customer = await Customer.findOne({ userId: owner._id, phone: c.phone });
    const isNew = !customer;
    if (!customer) {
      customer = await Customer.create({
        userId: owner._id,
        platform: "whatsapp",
        name: c.name,
        phone: c.phone,
        address: c.address,
        stateCode: shop.stateCode,
        gstin: c.gstin,
        ...(c.kyc
          ? { pan: c.kyc, kycStatus: "VERIFIED", kycDocs: [{ type: "PAN", number: c.kyc, addedAt: new Date() }], kycVerifiedAt: new Date(), kycVerifiedBy: owner._id, riskGrade: "A" }
          : { kycStatus: "NONE" }),
      });
    }
    log(`customer ${c.name}${c.kyc ? " (KYC verified)" : ""}`, isNew);
    customers.push(customer);
  }

  // Staff, approved by the owner
  for (const s of shop.staff) {
    const [, staffCreated] = await upsertUser(
      s.email,
      { name: s.name, phone: shop.owner.phone, role: "staff", tenantId: owner._id, emiRoles: [{ role: s.role, storeId: store._id }], approvalStatus: "APPROVED", staffActive: true },
      STAFF_PASSWORD
    );
    log(`staff ${s.email} (${s.role.toLowerCase()})`, staffCreated);
  }

  // Sales through the real checkout: invoices, payments, journals and orders.
  // A fixed Idempotency-Key per sale, so a re-run finds it instead of selling again.
  const req = { user: owner, ip: "seed", emi: { tenantId: owner._id, tenant, roles: [{ role: "OWNER", storeId: null }], isOwner: true, storeIds: null } };
  for (const sale of shop.sales) {
    const existing = await Invoice.findOne({ tenantId: owner._id, idempotencyKey: sale.key });
    if (existing) {
      log(`sale ${existing.invoiceNo}: ${sale.label}`, false);
      continue;
    }
    const items = [];
    for (const it of sale.items) {
      const product = products[it.product];
      if (it.imei) {
        const unit = await InventoryItem.findOne({ tenantId: owner._id, storeId: store._id, productId: product._id, status: "IN_STOCK" });
        if (!unit) {
          console.log(`⚠️  ${sale.label}: no ${product.name} IMEI left, skipped`);
          items.length = 0;
          break;
        }
        items.push({ productId: String(product._id), imei: unit.imei });
      } else {
        items.push({ productId: String(product._id), qty: it.qty || 1 });
      }
    }
    if (!items.length) continue;
    const body = {
      customerId: String(customers[sale.customer]._id),
      items,
      payments: sale.payments.map((pay) => ({ ...pay, amount: rupee(pay.amount) })),
      finance: sale.credit ? { type: "CREDIT", dueDate: istDate(sale.credit) } : { type: "NONE" },
    };
    const result = await createSale(req, store._id, body, sale.key);
    log(`sale ${result.invoiceNo}: ${sale.label} → ${result.status}`, true);
  }
}

async function run() {
  if (!local && !process.argv.includes("--force")) {
    throw new Error("MONGODB_URI is not a local database. Demo logins must not go to production (use --force for a staging copy).");
  }
  await mongoose.connect(uri);
  await Promise.all([User, Customer, Product, Tenant, Store, InventoryItem, Invoice].map((m) => m.syncIndexes()));

  await ensureDefaultPlans();
  const settings = (await PlatformSettings.findOne({ key: "platform" })) || (await PlatformSettings.create({ key: "platform" }));
  if (!settings.billing?.gstin) {
    Object.assign(settings.billing, SUPPLIER);
    await settings.save();
    log(`ChatShop supplier: ${SUPPLIER.legalName}, GSTIN ${SUPPLIER.gstin}`, true);
  } else {
    log(`ChatShop supplier: GSTIN ${settings.billing.gstin} (already set, left as is)`, false);
  }

  for (const shop of SHOPS) await seedShop(shop);

  console.log(`\n✅ Billing test shops ready.`);
  console.log(`   Shop owners: password ${SHOP_PASSWORD} · staff: password ${STAFF_PASSWORD} · sign in at /login`);
  SHOPS.forEach((s) => console.log(`   - ${s.business.businessName.padEnd(22)} ${s.owner.email}`));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("❌ Billing seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
