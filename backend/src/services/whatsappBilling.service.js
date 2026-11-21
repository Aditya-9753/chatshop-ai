const crypto = require("crypto");
const Customer = require("../models/Customer.model");
const Product = require("../models/Product.model");
const WhatsAppBillDraft = require("../models/WhatsAppBillDraft.model");
const User = require("../models/User.model");
const messageService = require("./message.service");
const whatsappBillQueue = require("./whatsappBillQueue.service");
const invoicePdf = require("../emi/services/invoicePdf.service");
const { Store, Tenant } = require("../emi/models/platform");
const { previewSale, createSale } = require("../emi/services/checkout.service");
const { resolveSettings } = require("../emi/services/settings.service");

const REQUEST = /^(?:bill|invoice|order)\s*:\s*([\s\S]+)$/i;
const BILL_INTENT = /\b(?:bill|invoice|order|buy|purchase|kharid|khareed)\b/i;
const STATUS_INTENT = /\b(?:where|status|track|delivery|deliver|paid|due|dues|balance|payment)\b/i;
const MAX_LINES = 5;
const DRAFT_LIFETIME_MS = 15 * 60 * 1000;

const amount = (paise) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format((Number(paise) || 0) / 100);

const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

function parseItems(body) {
  const lines = String(body || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length || lines.length > MAX_LINES) return null;

  const items = [];
  for (const line of lines) {
    const match = line.match(/^(\d{1,2})\s*[x×]\s*(.{2,100})$/i);
    if (!match) return null;
    const qty = Number(match[1]);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) return null;
    items.push({ qty, name: match[2].trim() });
  }
  return items;
}

function invoiceRequest(req, tenant) {
  return {
    user: req,
    emi: {
      tenantId: req._id,
      tenant,
      roles: [{ role: "OWNER", storeId: null }],
      isOwner: true,
      storeIds: null,
    },
  };
}

async function sendReply(user, customerMessage, text) {
  const customerId = customerMessage.customerId;
  const messageId = customerMessage.metadata?.platformMessageId;
  const result = await messageService.sendMessage(user._id, {
    customerId,
    platform: "whatsapp",
    type: "text",
    isAIGenerated: true,
    idempotencyKey: messageId ? `whatsapp-bill-response:${messageId}` : undefined,
    content: { text },
  });
  if (result.status === "failed") {
    throw new Error(result.errorDetails?.message || "WhatsApp reply could not be delivered");
  }
  return result;
}

async function getActiveDraft(tenantId, customerId) {
  return WhatsAppBillDraft.findOne({
    tenantId,
    customerId,
    status: { $in: ["pending", "issuing", "issued"] },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
}

async function createQuote(user, customerMessage, customer, requestBody) {
  const requestedItems = parseItems(requestBody);
  if (!requestedItems) {
    await sendReply(
      user,
      customerMessage,
      "Bill ke liye har line `2 x Product name` format mein bhejein, jaise:\nBILL:\n1 x Product name\n2 x Another product",
    );
    return true;
  }

  if (!/^\d{2}$/.test(String(customer.stateCode || ""))) {
    await sendReply(
      user,
      customerMessage,
      "Tax invoice banane se pehle shop team ko aapka GST state confirm karna hoga. Team aapki madad karegi.",
    );
    return true;
  }

  const stores = await Store.find({ tenantId: user._id, active: true })
    .sort({ createdAt: 1 })
    .limit(2)
    .lean();
  if (stores.length !== 1) {
    await sendReply(
      user,
      customerMessage,
      "Aapke order ke liye sahi branch shop team confirm karegi. Team aapko bill bhejegi.",
    );
    return true;
  }

  const store = stores[0];
  const tenant = await Tenant.findOne({ _id: user._id, status: "ACTIVE" });
  if (!tenant || user.subscription?.status !== "active") {
    await sendReply(
      user,
      customerMessage,
      "Online bill service abhi available nahi hai. Shop team aapki madad karegi.",
    );
    return true;
  }

  const settings = await resolveSettings(user._id, store._id);
  if (!settings.credit?.enabled) {
    await sendReply(
      user,
      customerMessage,
      "Is shop mein WhatsApp bill ke liye pay-later enabled nahi hai. Shop team payment confirm karke bill bhejegi.",
    );
    return true;
  }

  const items = [];
  for (const requested of requestedItems) {
    const matches = await Product.find({
      userId: user._id,
      isActive: true,
      name: { $regex: `^${requested.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    })
      .select("_id name price serialized stock")
      .limit(2)
      .lean();
    if (matches.length !== 1) {
      await sendReply(
        user,
        customerMessage,
        `“${requested.name}” ko exact catalog item se match nahi kar paaye. Shop team aapki madad karegi.`,
      );
      return true;
    }
    if (matches[0].serialized) {
      await sendReply(
        user,
        customerMessage,
        "Is item ka serial/IMEI shop team verify karegi, phir bill bhejegi.",
      );
      return true;
    }
    items.push({
      productId: matches[0]._id,
      qty: requested.qty,
      quotedName: matches[0].name,
      quotedPrice: matches[0].price,
    });
  }

  const req = invoiceRequest(user, tenant);
  const saleBody = {
    customerId: customer._id,
    items: items.map(({ productId, qty }) => ({ productId, qty })),
    payments: [],
    finance: { type: "CREDIT" },
    note: "Customer-confirmed WhatsApp bill",
  };
  const quote = await previewSale(req, store._id, saleBody);
  if (!quote.ok) {
    await sendReply(
      user,
      customerMessage,
      "Abhi is order ka bill confirm nahi ho pa raha (stock ya billing rule). Shop team aapki madad karegi.",
    );
    return true;
  }

  try {
    invoicePdf.assertDeliveryConfig();
  } catch (error) {
    console.error("WhatsApp invoice delivery is not configured:", error.message);
    await sendReply(
      user,
      customerMessage,
      "WhatsApp bill delivery abhi setup nahi hai. Shop team aapko bill bhejegi.",
    );
    return true;
  }

  await WhatsAppBillDraft.updateMany(
    { tenantId: user._id, customerId: customer._id, status: "pending" },
    { $set: { status: "cancelled" } },
  );
  const code = crypto.randomBytes(6).toString("hex").toUpperCase();
  const draft = await WhatsAppBillDraft.create({
    tenantId: user._id,
    customerId: customer._id,
    storeId: store._id,
    items,
    dueDate: quote.invoice.dueDate,
    grossTotal: quote.invoice.grossTotal,
    customerStateCode: customer.stateCode,
    interState: quote.invoice.interState,
    confirmationHash: hashCode(code),
    expiresAt: new Date(Date.now() + DRAFT_LIFETIME_MS),
  });
  const lineSummary = quote.invoice.lines
    .map((line) => `${line.qty} x ${line.name}: ${amount(line.gross)}`)
    .join("\n");
  const expiry = new Date(draft.expiresAt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  await sendReply(
    user,
    customerMessage,
    `Unpaid bill ka quote:\n${lineSummary}\nTotal: ${amount(quote.invoice.grossTotal)}\nDue date: ${quote.invoice.dueDate}\nStock aur dues sirf confirm karne ke baad update honge. 15 minute ke andar bhejein: CONFIRM ${code} (cancel ke liye CANCEL).`,
  );
  console.info(`WhatsApp bill quote ${draft._id} created; expires at ${expiry}`);
  return true;
}

async function confirmQuote(user, customerMessage, customer, draft) {
  const alreadyIssued = draft.status === "issued";
  const claimed =
    ["issuing", "issued"].includes(draft.status)
      ? draft
      : await WhatsAppBillDraft.findOneAndUpdate(
          {
            _id: draft._id,
            status: "pending",
            expiresAt: { $gt: new Date() },
          },
          { $set: { status: "issuing" } },
          { new: true },
        );
  if (!claimed) {
    await sendReply(
      user,
      customerMessage,
      "Ye quote expire ho gaya hai. Naya bill quote mangwayein ya shop team se baat karein.",
    );
    return true;
  }

  const tenant = await Tenant.findOne({ _id: user._id, status: "ACTIVE" });
  if (!alreadyIssued && (!tenant || user.subscription?.status !== "active")) {
    await WhatsAppBillDraft.updateOne(
      { _id: claimed._id, status: { $in: ["pending", "issuing"] } },
      { $set: { status: "cancelled" } },
    );
    await sendReply(
      user,
      customerMessage,
      "Shop billing ab available nahi hai. Shop team aapki madad karegi.",
    );
    return true;
  }
  const req = invoiceRequest(user, tenant);
  const saleBody = {
    customerId: customer._id,
    items: claimed.items.map(({ productId, qty }) => ({ productId, qty })),
    payments: [],
    finance: { type: "CREDIT", dueDate: claimed.dueDate },
    note: "Customer-confirmed WhatsApp bill",
  };
  if (!alreadyIssued) {
    const productIds = [
      ...new Set(claimed.items.map((item) => String(item.productId))),
    ];
    const currentProducts = await Product.find({
      userId: user._id,
      _id: { $in: productIds },
      isActive: true,
    })
      .select("_id name price")
      .lean();
    const currentPrices = new Map(
      currentProducts.map((product) => [
        String(product._id),
        { name: product.name, price: product.price },
      ]),
    );
    const priceChanged =
      currentPrices.size !== productIds.length ||
      claimed.items.some(
        (item) => {
          const current = currentPrices.get(String(item.productId));
          return (
            current?.price !== item.quotedPrice ||
            current?.name !== item.quotedName
          );
        },
      );
    const currentQuote = priceChanged
      ? null
      : await previewSale(req, claimed.storeId, saleBody);
    if (
      priceChanged ||
      !currentQuote?.ok ||
      customer.stateCode !== claimed.customerStateCode ||
      currentQuote.invoice.grossTotal !== claimed.grossTotal ||
      currentQuote.invoice.interState !== claimed.interState ||
      currentQuote.invoice.dueDate !== claimed.dueDate
    ) {
      await WhatsAppBillDraft.updateOne(
        { _id: claimed._id, status: { $in: ["pending", "issuing"] } },
        { $set: { status: "cancelled" } },
      );
      await sendReply(
        user,
        customerMessage,
        "Quote ki price, stock, tax ya due date badal gayi hai. Purana quote use nahi hua; naya BILL quote bhejein.",
      );
      return true;
    }
  }
  let sale;
  try {
    sale = await createSale(
      req,
      claimed.storeId,
      saleBody,
      `whatsapp-bill-draft-${claimed._id}`,
    );
  } catch (error) {
    if (error.status && error.status < 500) {
      await WhatsAppBillDraft.updateOne(
        { _id: claimed._id, status: "issuing" },
        { $set: { status: "cancelled" } },
      );
      await sendReply(
        user,
        customerMessage,
        "Quote ab available nahi hai (stock ya billing setting badal gayi). Shop team aapki madad karegi.",
      );
      return true;
    }
    throw error;
  }

  await WhatsAppBillDraft.updateOne(
    { _id: claimed._id },
    { $set: { status: "issued", invoiceId: sale.invoiceId } },
  );
  await whatsappBillQueue.enqueue({
    tenantId: user._id,
    invoiceId: sale.invoiceId,
    customerId: customer._id,
    idempotencyKey: `whatsapp-chat-bill-${claimed._id}`,
  });
  await sendReply(
    user,
    customerMessage,
    `Bill ${sale.invoiceNo} ban gaya. Total ${amount(sale.grossTotal)} hai; payment due date invoice mein hai. PDF abhi WhatsApp par bheja ja raha hai.`,
  );
  return true;
}

async function handleIncoming(user, customerMessage) {
  if (
    !user.aiConfig?.isEnabled ||
    !user.aiConfig?.whatsappAutoReplyEnabled ||
    !user.aiConfig?.whatsappBillCreationEnabled ||
    !user.whatsappConfig?.isConnected ||
    customerMessage.platform !== "whatsapp" ||
    customerMessage.type !== "text"
  ) {
    return false;
  }

  const text = String(customerMessage.content?.text || "").trim();
  const command = text.match(REQUEST);
  const pendingAction = /^(?:CONFIRM|CANCEL)\b/i.test(text);
  if (
    !command &&
    !pendingAction &&
    (!BILL_INTENT.test(text) || STATUS_INTENT.test(text))
  ) {
    return false;
  }
  const customer = await Customer.findOne({
    _id: customerMessage.customerId,
    userId: user._id,
    platform: "whatsapp",
    isBlocked: { $ne: true },
  }).select("_id stateCode");
  if (!customer) return false;

  const activeDraft = await getActiveDraft(user._id, customer._id);
  const confirmation = text.match(/^CONFIRM\s+([A-F\d]{12})$/i);
  if (activeDraft?.status === "issuing" && command) {
    await sendReply(
      user,
      customerMessage,
      "Aapka confirmed bill process ho raha hai. Naya quote bhejne se pehle thoda wait karein.",
    );
    return true;
  }
  if (confirmation) {
    if (!activeDraft || hashCode(confirmation[1].toUpperCase()) !== activeDraft.confirmationHash) {
      await sendReply(
        user,
        customerMessage,
        "Confirmation code valid nahi hai ya quote expire ho gaya. Naya bill quote mangwayein.",
      );
      return true;
    }
    return confirmQuote(user, customerMessage, customer, activeDraft);
  }

  if (/^CANCEL$/i.test(text) && activeDraft) {
    if (activeDraft.status !== "pending") {
      await sendReply(
        user,
        customerMessage,
        "Bill already issue ho chuka hai ya process mein hai. Cancellation ke liye shop team se baat karein.",
      );
      return true;
    }
    await WhatsAppBillDraft.updateOne(
      { _id: activeDraft._id, status: "pending" },
      { $set: { status: "cancelled" } },
    );
    await sendReply(user, customerMessage, "Bill quote cancel kar diya.");
    return true;
  }

  if (!command) {
    await sendReply(
      user,
      customerMessage,
      "Catalog bill ke liye bhejein:\nBILL:\n1 x Product name\nConfirm karne se pehle total aur due date dikhayi jayegi.",
    );
    return true;
  }
  return createQuote(user, customerMessage, customer, command[1]);
}

module.exports = { handleIncoming, _parseItems: parseItems };
