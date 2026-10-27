const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const Message = require("../models/Message.model");
const Conversation = require("../models/Conversation.model");
const InternalNote = require("../models/InternalNote.model");
const PlatformSettings = require("../models/PlatformSettings.model");
const Announcement = require("../models/Announcement.model");
const AuditLog = require("../models/AuditLog.model");
const sendEmail = require("../utils/sendEmail");
const cache = require("../utils/cache");
const { REVENUE_MATCH } = require("../utils/revenue");
const { version } = require("../../package.json");

const DAY_MS = 24 * 60 * 60 * 1000;
const DB_STATES = ["disconnected", "connected", "connecting", "disconnecting"];
const PLANS = ["starter", "business", "premium", "one-time"];

const nodemailer = require("nodemailer");

const emailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

// sendEmail swallows failures in development; treat those as not sent
const delivered = (info) => Boolean(info) && !info.error && info.messageId !== "test-mode-no-email";

// Log in to the SMTP server to see if email can really go out (cached 5 min)
const checkSmtp = () =>
  cache.remember("admin:smtp", 5 * 60_000, async () => {
    if (!emailConfigured()) return { configured: false, working: false };
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
      });
      await transporter.verify();
      return { configured: true, working: true };
    } catch (error) {
      return { configured: true, working: false, error: error.message.split(/\r?\n/)[0].slice(0, 160) };
    }
  });

const escapeHtml = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Values for a CSV cell: quoted, with quotes doubled
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const toCsv = (header, rows) => [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

/**
 * The super admin's tools: platform settings, system status, adding
 * shops, broadcasts, exports and backups, cache and the audit log.
 */
class AdminToolsService {
  // ---------- Settings ----------
  async getSettings() {
    return (
      (await PlatformSettings.findOne({ key: "platform" })) ||
      (await PlatformSettings.create({ key: "platform" }))
    );
  }

  async updateSettings(data) {
    const settings = await this.getSettings();
    for (const field of ["platformName", "supportEmail", "contactPhone"]) {
      if (typeof data[field] === "string") settings[field] = data[field].trim();
    }
    if (settings.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail)) {
      throw new Error("Support email isn't a valid email address");
    }
    for (const flag of ["emailNotifications", "newUserAlerts", "systemUpdates"]) {
      if (typeof data.notifications?.[flag] === "boolean") settings.notifications[flag] = data.notifications[flag];
    }
    await settings.save();
    return settings;
  }

  // What anyone (landing page, help widget) may know
  async publicSettings() {
    const { platformName, supportEmail, contactPhone } = await this.getSettings();
    return { platformName, supportEmail, contactPhone };
  }

  // ---------- System status ----------
  async systemStatus() {
    const started = Date.now();
    let dbPing = null;
    try {
      await mongoose.connection.db.admin().ping();
      dbPing = Date.now() - started;
    } catch {
      dbPing = null;
    }
    const memory = process.memoryUsage();

    return {
      server: {
        status: "online",
        version,
        environment: process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: new Date(Date.now() - process.uptime() * 1000),
        memoryMb: Math.round(memory.rss / 1024 / 1024),
      },
      database: {
        state: DB_STATES[mongoose.connection.readyState] || "unknown",
        connected: mongoose.connection.readyState === 1,
        name: mongoose.connection.name,
        pingMs: dbPing,
      },
      email: await checkSmtp(),
      webhooks: { signatureSecretSet: Boolean(process.env.META_APP_SECRET) },
      cache: { entries: cache.size() },
      checkedAt: new Date(),
    };
  }

  // ---------- Month-over-month trends for the overview cards ----------
  async trends() {
    return cache.remember("admin:trends", 60_000, async () => {
      const now = Date.now();
      const monthAgo = new Date(now - 30 * DAY_MS);
      const twoMonthsAgo = new Date(now - 60 * DAY_MS);
      const shops = { role: { $ne: "admin" } };

      const [usersNow, usersBefore, subsNow, subsBefore, activeNow, activeBefore, revenue] = await Promise.all([
        User.countDocuments(shops),
        User.countDocuments({ ...shops, createdAt: { $lt: monthAgo } }),
        User.countDocuments({ ...shops, "subscription.status": "active" }),
        User.countDocuments({ ...shops, "subscription.status": "active", "subscription.startDate": { $lt: monthAgo } }),
        User.countDocuments({ ...shops, updatedAt: { $gte: monthAgo } }),
        User.countDocuments({ ...shops, updatedAt: { $gte: twoMonthsAgo, $lt: monthAgo } }),
        Order.aggregate([
          { $match: { ...REVENUE_MATCH, createdAt: { $gte: twoMonthsAgo } } },
          { $group: { _id: { $cond: [{ $gte: ["$createdAt", monthAgo] }, "current", "previous"] }, total: { $sum: "$total" } } },
        ]),
      ]);

      const pick = (period) => revenue.find((r) => r._id === period)?.total || 0;
      return {
        users: { current: usersNow, previous: usersBefore },
        activeSubscriptions: { current: subsNow, previous: subsBefore },
        activeUsers: { current: activeNow, previous: activeBefore },
        orderRevenue: { current: pick("current"), previous: pick("previous") },
      };
    });
  }

  // ---------- Add a shop ----------
  async createShop({ name, email, phone, password, businessName, plan }) {
    if (!name?.trim() || !email?.trim() || !password) throw new Error("Name, email and password are required");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    if (await User.exists({ email: email.trim().toLowerCase() })) throw new Error("A user with this email already exists");
    if (plan && !PLANS.includes(plan)) throw new Error("Unknown plan");

    const user = await User.create({
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || "-",
      password: await bcrypt.hash(password, 10),
      isVerified: true,
      businessInfo: businessName ? { businessName: businessName.trim() } : undefined,
      subscription: plan
        ? { plan, status: "active", startDate: new Date(), endDate: new Date(Date.now() + 30 * DAY_MS) }
        : { plan: null, status: "inactive" },
    });
    cache.clear();
    return user;
  }

  // ---------- Broadcasts ----------
  async broadcast({ title, message, recipients = [] }, sender) {
    if (!title?.trim() || !message?.trim()) throw new Error("Write a title and a message");

    const ids = recipients.filter((id) => mongoose.isValidObjectId(id));
    const users = await User.find(ids.length ? { _id: { $in: ids } } : { role: { $ne: "admin" } }).select("name email");
    if (!users.length) throw new Error("No shops to send to");

    const announcement = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      recipients: ids,
      sentBy: sender._id,
    });

    // Email as well when SMTP is set up. That can take a while for many
    // shops, so it runs after the response; the result lands on the record.
    if (emailConfigured()) {
      announcement.emailStatus = "sending";
      await announcement.save();
      this.emailBroadcast(announcement, users).catch((error) => console.warn("Broadcast email failed:", error.message));
    } else {
      announcement.emailSkipped = true;
      await announcement.save();
    }

    return { announcement, recipients: users.length };
  }

  async emailBroadcast(announcement, users) {
    const settings = await this.getSettings();
    const html = `<h2>${escapeHtml(announcement.title)}</h2><p style="white-space:pre-line">${escapeHtml(announcement.message)}</p><p style="color:#5f5f6b">— ${escapeHtml(settings.platformName)}</p>`;
    const targets = [...users];
    if (settings.notifications.emailNotifications && settings.notifications.systemUpdates) {
      targets.push(...(await User.find({ role: "admin" }).select("name email")));
    }

    let sent = 0;
    let failed = 0;
    for (const user of targets) {
      try {
        const info = await sendEmail({ to: user.email, subject: `${settings.platformName}: ${announcement.title}`, html });
        delivered(info) ? (sent += 1) : (failed += 1);
      } catch {
        failed += 1;
      }
    }
    await Announcement.updateOne({ _id: announcement._id }, { emailedCount: sent, emailFailedCount: failed, emailStatus: "done" });
  }

  async announcements(limit = 50) {
    return Announcement.find().populate("recipients", "name email").populate("sentBy", "name email").sort({ createdAt: -1 }).limit(limit).lean();
  }

  // Shown as a banner to shops: the last 30 days, addressed to everyone or to them
  async announcementsFor(userId) {
    return Announcement.find({
      createdAt: { $gte: new Date(Date.now() - 30 * DAY_MS) },
      $or: [{ recipients: { $size: 0 } }, { recipients: userId }],
    })
      .select("title message createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
  }

  // New shop signed up: email the admins if they asked for it
  async notifyNewShop(user) {
    try {
      const settings = await this.getSettings();
      const { emailNotifications, newUserAlerts } = settings.notifications;
      if (!emailNotifications || !newUserAlerts || !emailConfigured()) return;
      const admins = await User.find({ role: "admin" }).select("email");
      for (const admin of admins) {
        await sendEmail({
          to: admin.email,
          subject: `${settings.platformName}: new shop signed up`,
          html: `<p><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)}) just created a workspace.</p>`,
        });
      }
    } catch (error) {
      console.warn("New shop alert failed:", error.message);
    }
  }

  // ---------- Exports and backups ----------
  async exportCsv(kind) {
    const shop = (u) => u?.businessInfo?.businessName || u?.name || "";
    const date = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

    switch (kind) {
      case "shops": {
        const users = await User.find({ role: { $ne: "admin" } }).sort({ createdAt: -1 }).lean();
        return toCsv(
          ["Name", "Business", "Email", "Phone", "Plan", "Status", "Joined"],
          users.map((u) => [u.name, u.businessInfo?.businessName, u.email, u.phone, u.subscription?.plan, u.subscription?.status, date(u.createdAt)])
        );
      }
      case "orders": {
        const orders = await Order.find().populate("userId", "name businessInfo.businessName").populate("customerId", "name phone").sort({ createdAt: -1 }).lean();
        return toCsv(
          ["Order", "Date", "Shop", "Customer", "Phone", "Channel", "Total", "Status", "Payment"],
          orders.map((o) => [o.orderNumber, date(o.createdAt), shop(o.userId), o.customerId?.name, o.customerId?.phone, o.platform, o.total, o.status, o.paymentStatus])
        );
      }
      case "customers": {
        const customers = await Customer.find().populate("userId", "name businessInfo.businessName").sort({ createdAt: -1 }).lean();
        return toCsv(
          ["Name", "Shop", "Phone", "Email", "Channel", "Orders", "Spent", "Since"],
          customers.map((c) => [c.name, shop(c.userId), c.phone, c.email, c.platform, c.totalOrders, c.totalSpent, date(c.createdAt)])
        );
      }
      case "products": {
        const products = await Product.find().populate("userId", "name businessInfo.businessName").sort({ createdAt: -1 }).lean();
        return toCsv(
          ["Name", "Shop", "Category", "SKU", "Price", "Stock", "Available"],
          products.map((p) => [p.name, shop(p.userId), p.category, p.sku, p.price, p.stock, p.isActive !== false ? "yes" : "no"])
        );
      }
      default:
        throw new Error("Unknown export");
    }
  }

  // Full JSON backup of the data. Passwords, reset tokens, 2FA secrets and
  // channel access tokens are left out (toJSON on User strips them).
  async backup() {
    const [users, customers, orders, products, conversations, messages, notes, settings, announcements] = await Promise.all([
      User.find(),
      Customer.find().lean(),
      Order.find().lean(),
      Product.find().lean(),
      Conversation.find().lean(),
      Message.find().lean(),
      InternalNote.find().lean(),
      PlatformSettings.find().lean(),
      Announcement.find().lean(),
    ]);

    return {
      exportedAt: new Date(),
      version,
      counts: { users: users.length, customers: customers.length, orders: orders.length, products: products.length, conversations: conversations.length, messages: messages.length },
      users: users.map((u) => u.toJSON()),
      customers,
      orders,
      products,
      conversations,
      messages,
      internalNotes: notes,
      platformSettings: settings,
      announcements,
    };
  }

  clearCache() {
    return cache.clear();
  }

  async auditLog(limit = 100) {
    return AuditLog.find().sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 100, 500)).lean();
  }

  // The second password on the admin account that opens the limited Admin panel
  async adminPanelStatus(userId) {
    const user = await User.findById(userId).select("+adminPanel.password");
    return { set: Boolean(user?.adminPanel?.password), changedAt: user?.adminPanel?.changedAt || null };
  }

  async setAdminPanelPassword(userId, password) {
    if (!password || String(password).length < 6) throw new Error("Use at least 6 characters");
    const user = await User.findById(userId).select("+password");
    // Same as the Super Admin password would always log in as Super Admin
    if (await bcrypt.compare(password, user.password)) {
      throw new Error("Use a different password from the Super Admin one");
    }
    // 1s back, like passwordChangedAt: logs out older Admin panel sessions
    user.adminPanel = { password: await bcrypt.hash(password, 10), changedAt: new Date(Date.now() - 1000) };
    await user.save();
    return this.adminPanelStatus(userId);
  }
}

module.exports = new AdminToolsService();
