const crypto = require("crypto");
const Razorpay = require("razorpay");
const { BillingError } = require("./domain");

/**
 * Payment gateway adapter for platform billing.
 *
 *  - RAZORPAY: real keys (rzp_test_… / rzp_live_…) in RAZORPAY_KEY_ID and
 *    RAZORPAY_KEY_SECRET; webhooks signed with RAZORPAY_WEBHOOK_SECRET.
 *  - MOCK: a stand-in for local testing without keys. Never in production.
 *    The shop's "pay" screen offers Succeed / Fail buttons, which go through
 *    the same event processing as a real webhook.
 *
 * PAYMENT_GATEWAY=razorpay|mock forces a mode; otherwise real-looking keys
 * mean Razorpay, and no keys outside production mean MOCK.
 */

const hasRazorpayKeys = () => /^rzp_(test|live)_/.test(process.env.RAZORPAY_KEY_ID || "") && Boolean(process.env.RAZORPAY_KEY_SECRET);

function mode() {
  const forced = String(process.env.PAYMENT_GATEWAY || "").toLowerCase();
  if (forced === "razorpay") return "RAZORPAY";
  if (forced === "mock") return process.env.NODE_ENV === "production" ? "NONE" : "MOCK";
  if (hasRazorpayKeys()) return "RAZORPAY";
  return process.env.NODE_ENV === "production" ? "NONE" : "MOCK";
}

let client = null;
let clientKey = null;
function razorpay() {
  if (!hasRazorpayKeys()) throw new BillingError(503, "Razorpay keys are not set (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)");
  if (!client || clientKey !== process.env.RAZORPAY_KEY_ID) {
    client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    clientKey = process.env.RAZORPAY_KEY_ID;
  }
  return client;
}

const randomId = (prefix) => `${prefix}_${crypto.randomBytes(7).toString("hex")}`;

const safeEqualHex = (a, b) => {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const gateway = {
  mode,

  // What the browser needs to open checkout (never the secret)
  publicConfig() {
    const m = mode();
    return { mode: m, keyId: m === "RAZORPAY" ? process.env.RAZORPAY_KEY_ID : null };
  },

  async createOrder({ amountPaise, receipt, notes }) {
    const m = mode();
    if (m === "MOCK") return { id: randomId("order_mock"), amount: amountPaise, currency: "INR", gateway: "MOCK" };
    if (m !== "RAZORPAY") throw new BillingError(503, "Online payment is not set up yet. Contact support to pay.");
    try {
      const order = await razorpay().orders.create({ amount: amountPaise, currency: "INR", receipt, notes, payment_capture: 1 });
      return { id: order.id, amount: order.amount, currency: order.currency, gateway: "RAZORPAY" };
    } catch (error) {
      console.error("Razorpay order failed:", error?.error?.description || error.message);
      throw new BillingError(502, "Couldn't start the payment with Razorpay. Please try again.");
    }
  },

  // Signature Razorpay Checkout returns to the browser: HMAC(order|payment)
  verifyCheckoutSignature(orderId, paymentId, signature) {
    if (!process.env.RAZORPAY_KEY_SECRET) return false;
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    return safeEqualHex(expected, signature);
  },

  // Webhook signature: HMAC-SHA256 of the exact raw body
  verifyWebhookSignature(rawBody, signature) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !rawBody || !signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqualHex(expected, signature);
  },

  async fetchPayment(paymentId) {
    return razorpay().payments.fetch(paymentId);
  },

  async fetchOrderPayments(orderId) {
    const result = await razorpay().orders.fetchPayments(orderId);
    return result?.items || [];
  },

  // Returns { id, status: "processed" | "pending" | "failed" }
  async refund({ gateway: kind, gatewayPaymentId, amountPaise, refundRef }) {
    if (kind === "MOCK") return { id: randomId("rfnd_mock"), status: "processed" };
    try {
      const refund = await razorpay().payments.refund(gatewayPaymentId, { amount: amountPaise, notes: { refundRef }, receipt: refundRef });
      return { id: refund.id, status: refund.status };
    } catch (error) {
      throw new BillingError(502, error?.error?.description || "Razorpay refused the refund");
    }
  },

  randomId,
};

module.exports = gateway;
