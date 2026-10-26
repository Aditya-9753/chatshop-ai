const instagramService = require("../services/instagram.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Connect Instagram account
exports.connectInstagram = async (req, res) => {
  try {
    const result = await instagramService.connectAccount(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      result,
      "Instagram connected successfully"
    );
  } catch (error) {
    console.error("Connect Instagram error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Disconnect Instagram account
exports.disconnectInstagram = async (req, res) => {
  try {
    await instagramService.disconnectAccount(req.user._id);
    return ResponseHandler.success(
      res,
      null,
      "Instagram disconnected successfully"
    );
  } catch (error) {
    console.error("Disconnect Instagram error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Send Instagram message
exports.sendInstagramMessage = async (req, res) => {
  try {
    const result = await instagramService.sendMessage(req.user._id, req.body);
    return ResponseHandler.success(res, result, "Message sent successfully");
  } catch (error) {
    console.error("Send Instagram message error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Verify webhook
exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    if (mode === "subscribe") {
      console.log("Instagram webhook verified");
      return res.status(200).send(challenge);
    }
  }
  return res.sendStatus(403);
};

// @desc    Handle webhook events
exports.handleWebhook = async (req, res) => {
  try {
    await instagramService.handleWebhook(req.body);
    return res.sendStatus(200);
  } catch (error) {
    console.error("Handle Instagram webhook error:", error);
    return res.sendStatus(500);
  }
};
