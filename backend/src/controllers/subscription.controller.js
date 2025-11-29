const subscriptionService = require("../services/subscription.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Get all subscription plans
exports.getPlans = async (req, res) => {
  try {
    const plans = subscriptionService.getPlans();
    return ResponseHandler.success(res, plans);
  } catch (error) {
    console.error("Get plans error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Create subscription order
exports.createSubscription = async (req, res) => {
  try {
    const { plan } = req.body;
    const orderData = await subscriptionService.createSubscription(
      req.user._id,
      plan
    );
    return ResponseHandler.success(res, orderData);
  } catch (error) {
    console.error("Create subscription error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const subscription = await subscriptionService.verifyPayment(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      subscription,
      "Subscription activated successfully"
    );
  } catch (error) {
    console.error("Verify payment error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Get subscription details
exports.getSubscriptionDetails = async (req, res) => {
  try {
    const subscription = await subscriptionService.getSubscriptionDetails(
      req.user._id
    );
    return ResponseHandler.success(res, subscription);
  } catch (error) {
    console.error("Get subscription details error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const subscription = await subscriptionService.cancelSubscription(
      req.user._id
    );
    return ResponseHandler.success(
      res,
      subscription,
      "Subscription cancelled successfully"
    );
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return ResponseHandler.error(res, error.message);
  }
};
