const Razorpay = require("razorpay");
const crypto = require("crypto");

// Initialize Razorpay only if credentials are provided
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log("✅ Razorpay initialized");
} else {
  console.log("⚠️  Razorpay not configured (testing mode)");
}

class RazorpayHelper {
  // Create order
  async createOrder(orderData) {
    if (!razorpay) {
      throw new Error("Razorpay not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env");
    }
    try {
      const order = await razorpay.orders.create(orderData);
      return order;
    } catch (error) {
      console.error("Razorpay create order error:", error);
      throw new Error("Failed to create payment order");
    }
  }

  // Verify payment signature
  verifySignature(orderId, paymentId, signature) {
    if (!razorpay) {
      throw new Error("Razorpay not configured");
    }
    try {
      const sign = orderId + "|" + paymentId;
      const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

      return signature === expectedSign;
    } catch (error) {
      console.error("Razorpay verify signature error:", error);
      return false;
    }
  }

  // Get payment details
  async getPaymentDetails(paymentId) {
    try {
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error("Razorpay get payment error:", error);
      throw new Error("Failed to fetch payment details");
    }
  }

  // Refund payment
  async refundPayment(paymentId, amount = null) {
    try {
      const refundData = amount ? { amount } : {};
      const refund = await razorpay.payments.refund(paymentId, refundData);
      return refund;
    } catch (error) {
      console.error("Razorpay refund error:", error);
      throw new Error("Failed to process refund");
    }
  }
}

module.exports = new RazorpayHelper();
