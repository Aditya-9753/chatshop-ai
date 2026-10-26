const facebookService = require("../services/facebook.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Connect Facebook account
exports.connectFacebook = async (req, res) => {
  try {
    const result = await facebookService.connectAccount(req.user._id, req.body);
    return ResponseHandler.success(
      res,
      result,
      "Facebook connected successfully"
    );
  } catch (error) {
    console.error("Connect Facebook error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Disconnect Facebook account
exports.disconnectFacebook = async (req, res) => {
  try {
    await facebookService.disconnectAccount(req.user._id);
    return ResponseHandler.success(
      res,
      null,
      "Facebook disconnected successfully"
    );
  } catch (error) {
    console.error("Disconnect Facebook error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Send Facebook message
exports.sendFacebookMessage = async (req, res) => {
  try {
    const result = await facebookService.sendMessage(req.user._id, req.body);
    return ResponseHandler.success(res, result, "Message sent successfully");
  } catch (error) {
    console.error("Send Facebook message error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Verify webhook
exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    if (mode === "subscribe") {
      console.log("Facebook webhook verified");
      return res.status(200).send(challenge);
    }
  }
  return res.sendStatus(403);
};

// @desc    Handle webhook events
exports.handleWebhook = async (req, res) => {
  try {
    await facebookService.handleWebhook(req.body);
    return res.sendStatus(200);
  } catch (error) {
    console.error("Handle Facebook webhook error:", error);
    return res.sendStatus(500);
  }
};
