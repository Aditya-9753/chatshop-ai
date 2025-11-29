const User = require("../models/User.model");
const razorpayHelper = require("../utils/razorpay.helper");

// Pricing plans
const PLANS = {
  starter: { name: "Starter", price: 499, originalPrice: 999 },
  business: { name: "Business", price: 1249, originalPrice: 2499 },
  premium: { name: "Premium", price: 4000, originalPrice: 8000 },
  "one-time": { name: "One-Time", price: 10000, originalPrice: 20000 },
};

class SubscriptionService {
  // Get all plans
  getPlans() {
    return PLANS;
  }

  // Create subscription order
  async createSubscription(userId, plan) {
    if (!PLANS[plan]) {
      throw new Error("Invalid plan selected");
    }

    const amount = PLANS[plan].price * 100; // Convert to paise

    // Create Razorpay order
    const order = await razorpayHelper.createOrder({
      amount,
      currency: "INR",
      receipt: `order_${userId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        plan,
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  // Verify payment and activate subscription
  async verifyPayment(userId, paymentData) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } =
      paymentData;

    // Verify signature
    const isValid = razorpayHelper.verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      throw new Error("Payment verification failed");
    }

    // Update user subscription
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.subscription.plan = plan;
    user.subscription.status = "active";
    user.subscription.startDate = new Date();

    if (plan === "one-time") {
      user.subscription.endDate = new Date("2099-12-31"); // Lifetime access
    } else {
      // Monthly subscription
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      user.subscription.endDate = endDate;
    }

    user.subscription.razorpayOrderId = razorpay_order_id;
    user.subscription.razorpayPaymentId = razorpay_payment_id;

    await user.save();
    return user.subscription;
  }

  // Get subscription details
  async getSubscriptionDetails(userId) {
    const user = await User.findById(userId).select("subscription");
    if (!user) {
      throw new Error("User not found");
    }
    return user.subscription;
  }

  // Cancel subscription
  async cancelSubscription(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.subscription.status = "cancelled";
    await user.save();

    return user.subscription;
  }
}

module.exports = new SubscriptionService();
