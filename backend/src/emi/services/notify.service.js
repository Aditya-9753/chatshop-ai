const Customer = require("../../models/Customer.model");
const User = require("../../models/User.model");
const { Notification } = require("../models/finance");
const { TEMPLATES } = require("./emi.service");

// Lazy: message.service pulls in the realtime layer
const messageService = () => require("../../services/message.service");

/**
 * Send queued EMI reminders through the shop's own WhatsApp, as normal
 * outgoing messages: they show up in the shop's inbox next to the customer's
 * chat, with delivery ticks. SMS has no provider yet, so those are skipped.
 */
async function processNotifications(limit = 50) {
  const queued = await Notification.find({ status: "QUEUED" }).setOptions({ allTenants: true }).sort({ createdAt: 1 }).limit(limit);
  const result = { sent: 0, failed: 0, skipped: 0 };

  for (const n of queued) {
    const mark = async (status, extra = {}) => {
      await Notification.updateOne({ tenantId: n.tenantId, _id: n._id }, { status, ...extra });
      result[status === "SENT" ? "sent" : status === "FAILED" ? "failed" : "skipped"]++;
    };

    if (n.channel !== "WHATSAPP") {
      await mark("SKIPPED", { error: "SMS provider abhi juda nahi hai" });
      continue;
    }
    const [owner, customer] = await Promise.all([
      User.findById(n.tenantId).select("whatsappConfig"),
      Customer.findOne({ _id: n.customerId, userId: n.tenantId }),
    ]);
    if (!owner?.whatsappConfig?.isConnected) {
      await mark("FAILED", { error: "Dukaan ka WhatsApp connect nahi hai (Settings → Channels)" });
      continue;
    }
    if (!customer || customer.platform !== "whatsapp" || !(customer.phone || customer.platformId)) {
      await mark("SKIPPED", { error: "Customer ka WhatsApp number nahi hai" });
      continue;
    }

    const text = (TEMPLATES[n.template] || (() => null))(n.payload || {});
    if (!text) {
      await mark("SKIPPED", { error: `Template ${n.template} nahi hai` });
      continue;
    }
    try {
      const message = await messageService().sendMessage(n.tenantId, { customerId: customer._id, platform: "whatsapp", type: "text", content: { text } });
      if (message.status === "failed") {
        await mark("FAILED", { error: message.errorDetails?.message || "Bheja nahi ja saka", messageId: message._id });
      } else {
        await mark("SENT", { sentAt: new Date(), messageId: message._id });
      }
    } catch (error) {
      await mark("FAILED", { error: error.message });
    }
  }
  return result;
}

module.exports = { processNotifications };
