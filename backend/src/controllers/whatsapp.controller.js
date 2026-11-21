const whatsappService = require("../services/whatsapp.service");
const whatsappWebhookQueue = require("../services/whatsappWebhookQueue.service");
const embeddedSignup = require("../services/whatsappEmbeddedSignup.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Connect WhatsApp account
exports.connectWhatsApp = async (req, res) => {
  try {
    const result = await whatsappService.connectAccount(req.user._id, req.body);
    return ResponseHandler.success(
      res,
      result,
      "WhatsApp connected successfully"
    );
  } catch (error) {
    console.error("Connect WhatsApp error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Disconnect WhatsApp account
exports.disconnectWhatsApp = async (req, res) => {
  try {
    await whatsappService.disconnectAccount(req.user._id);
    return ResponseHandler.success(
      res,
      null,
      "WhatsApp disconnected successfully"
    );
  } catch (error) {
    console.error("Disconnect WhatsApp error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

exports.getEmbeddedSignupConfig = (_req, res) => {
  return ResponseHandler.success(res, embeddedSignup.publicConfig());
};

exports.exchangeEmbeddedSignupCode = async (req, res) => {
  try {
    const result = await embeddedSignup.exchangeCode(req.user._id, req.body);
    return ResponseHandler.success(res, result, "Meta account authorized");
  } catch (error) {
    console.error("WhatsApp Embedded Signup exchange failed:", error.message);
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
      ...(error.code && { code: error.code }),
    });
  }
};

exports.completeEmbeddedSignup = async (req, res) => {
  try {
    const result = await embeddedSignup.completeSetup(req.user._id, req.body.pin);
    return ResponseHandler.success(res, result, "WhatsApp connected successfully");
  } catch (error) {
    console.error("WhatsApp Embedded Signup setup failed:", error.message);
    return res.status(error.status || 400).json({
      success: false,
      message: error.message,
      ...(error.code && { code: error.code }),
    });
  }
};

// @desc    Send WhatsApp message
exports.sendWhatsAppMessage = async (req, res) => {
  try {
    const result = await whatsappService.sendMessage(req.user._id, req.body);
    return ResponseHandler.success(res, result, "Message sent successfully");
  } catch (error) {
    console.error("Send WhatsApp message error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Verify webhook
exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    if (mode === "subscribe") {
      console.log("WhatsApp webhook verified");
      return res.status(200).send(challenge);
    }
  }
  return res.sendStatus(403);
};

// @desc    Handle webhook events
exports.handleWebhook = async (req, res) => {
  try {
    await whatsappWebhookQueue.enqueueWebhook(req.body);
    return res.sendStatus(200);
  } catch (error) {
    console.error("Queue WhatsApp webhook error:", error);
    return res.sendStatus(503);
  }
};
