const Order = require("../../models/Order.model");
const Customer = require("../../models/Customer.model");
const User = require("../../models/User.model");

// Ties a counter sale to the rest of ChatShop: every invoice gets a matching
// order, so Orders, Dashboard, Analytics and the customer's totals include
// store sales the same way as WhatsApp/Instagram orders.

const toRupees = (paise) => Math.round(paise) / 100;

// Invoice status -> ChatShop order status and payment status
const ORDER_STATES = {
  PAID: ["delivered", "paid"],
  EMI_ACTIVE: ["delivered", "paid"],
  EMI_CLOSED: ["delivered", "paid"],
  FORECLOSED: ["delivered", "paid"],
  NBFC_PENDING: ["delivered", "paid"],
  PENDING_APPROVAL: ["pending", "pending"],
  CANCELLED: ["cancelled", "refunded"],
};

const FINANCE_LABELS = { NONE: "", SHOP_EMI: "Shop EMI", NBFC: "NBFC finance" };

async function createOrderForInvoice(invoice, payments, session) {
  const [status, paymentStatus] = ORDER_STATES[invoice.status];
  const methods = [...new Set(payments.map((p) => p.method))];
  const paymentMethod = methods.length === 1 && methods[0] === "UPI" && invoice.financeType === "NONE" ? "upi" : "other";
  const [order] = await Order.create(
    [
      {
        userId: invoice.tenantId,
        customerId: invoice.customerId,
        orderNumber: `${invoice.invoiceNo}-${String(invoice.tenantId).slice(-6).toUpperCase()}`,
        platform: "store",
        items: invoice.lines.map((l) => ({
          productId: l.productId,
          name: l.imei ? `${l.name} (IMEI ${l.imei})` : l.name,
          quantity: l.qty,
          price: toRupees(l.unitPrice),
          total: toRupees(l.gross),
        })),
        subtotal: toRupees(invoice.taxable),
        tax: toRupees(invoice.cgst + invoice.sgst + invoice.igst),
        taxType: invoice.interState ? "gst" : "cgst_sgst",
        discount: toRupees(invoice.discount),
        total: toRupees(invoice.grossTotal),
        status,
        paymentStatus,
        paymentMethod,
        invoiceId: invoice._id,
        notes: ["Counter sale", `Invoice ${invoice.invoiceNo}`, FINANCE_LABELS[invoice.financeType]].filter(Boolean).join(" · "),
      },
    ],
    { session }
  );
  const total = toRupees(invoice.grossTotal);
  await Customer.updateOne({ _id: invoice.customerId }, { $inc: { totalOrders: 1, totalSpent: total } }, { session });
  await User.updateOne({ _id: invoice.tenantId }, { $inc: { "stats.totalOrders": 1, "stats.totalRevenue": total } }, { session });
  return order;
}

const takeBackStats = async (invoice, session) => {
  const total = toRupees(invoice.grossTotal);
  await Customer.updateOne({ _id: invoice.customerId }, { $inc: { totalOrders: -1, totalSpent: -total } }, { session });
  await User.updateOne({ _id: invoice.tenantId }, { $inc: { "stats.totalOrders": -1, "stats.totalRevenue": -total } }, { session });
};

// Keep the order in step when the invoice changes state
async function syncOrder(invoice, session) {
  if (!invoice.orderId) return;
  const [status, paymentStatus] = ORDER_STATES[invoice.status];
  await Order.updateOne({ _id: invoice.orderId }, { status, paymentStatus }, { session });
  if (invoice.status === "CANCELLED") await takeBackStats(invoice, session);
}

// Undo createOrderForInvoice (a sale that failed half way without a transaction)
async function removeOrder(invoice, order) {
  await Order.deleteOne({ _id: order._id });
  await takeBackStats(invoice, null);
}

// Last ten digits, for matching numbers typed with or without +91 / spaces
const phoneDigits = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

// Numbers saved as +91XXXXXXXXXX so WhatsApp can reach them and an incoming
// WhatsApp message from the same person lands on the same customer
const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return digits ? `+${digits}` : "";
};

const findCustomerByPhone = (tenantId, phone) => {
  const digits = phoneDigits(phone);
  if (digits.length < 10) return null;
  return Customer.findOne({ userId: tenantId, phone: new RegExp(`${digits.split("").join("\\D*")}\\D*$`) });
};

module.exports = { createOrderForInvoice, syncOrder, removeOrder, phoneDigits, normalizePhone, findCustomerByPhone, toRupees };
