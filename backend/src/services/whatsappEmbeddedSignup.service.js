const axios = require("axios");
const User = require("../models/User.model");
const whatsappApi = require("../utils/whatsapp.api");
const tokenVault = require("../utils/tokenVault");
const { GRAPH_API_URL } = require("../utils/meta");

function requireMetaConfig() {
  const { META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID } =
    process.env;
  if (!META_APP_ID || !META_APP_SECRET || !META_EMBEDDED_SIGNUP_CONFIG_ID) {
    throw new Error("Meta Embedded Signup is not configured on this server");
  }
  return { appId: META_APP_ID, appSecret: META_APP_SECRET };
}

function metaHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

function metaFailure(error, step) {
  const detail = error.response?.data?.error?.message;
  const failure = new Error(
    detail ? `Meta ${step} failed: ${detail}` : `Meta ${step} request failed`,
  );
  failure.status = 502;
  failure.code = error.response?.data?.error?.code
    ? String(error.response.data.error.code)
    : "META_REQUEST_FAILED";
  return failure;
}

async function exchangeCode(userId, { code, phoneNumberId, businessAccountId }) {
  const { appId, appSecret } = requireMetaConfig();
  tokenVault.encrypt("validate-encryption-key");

  if (
    typeof code !== "string" ||
    !code ||
    code.length > 4096 ||
    !/^\d+$/.test(String(phoneNumberId || "")) ||
    !/^\d+$/.test(String(businessAccountId || ""))
  ) {
    const error = new Error("Embedded Signup returned invalid account details");
    error.status = 400;
    throw error;
  }

  let tokenResult;
  try {
    const response = await axios.get(`${GRAPH_API_URL}/oauth/access_token`, {
      params: { client_id: appId, client_secret: appSecret, code },
      timeout: 10000,
    });
    tokenResult = response.data;
  } catch (error) {
    throw metaFailure(error, "authorization-code exchange");
  }

  const accessToken = tokenResult?.access_token;
  if (!accessToken) {
    const error = new Error("Meta did not return a business access token");
    error.status = 502;
    throw error;
  }

  let phone, phones;
  try {
    [phone, phones] = await Promise.all([
      whatsappApi.getPhoneNumber(phoneNumberId, accessToken),
      axios.get(`${GRAPH_API_URL}/${businessAccountId}/phone_numbers`, {
        params: { fields: "id", limit: 100 },
        headers: metaHeaders(accessToken),
        timeout: 10000,
      }),
    ]);
  } catch (error) {
    throw metaFailure(error, "WhatsApp asset validation");
  }
  if (!(phones.data?.data || []).some((number) => number.id === String(phoneNumberId))) {
    const error = new Error(
      "The selected phone number does not belong to the authorized WhatsApp account",
    );
    error.status = 403;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  user.whatsappConfig.isConnected = false;
  user.whatsappConfig.phoneNumberId = String(phoneNumberId);
  user.whatsappConfig.businessAccountId = String(businessAccountId);
  user.whatsappConfig.phoneNumber = phone.display_phone_number || "";
  user.whatsappConfig.accessToken = tokenVault.encrypt(accessToken);
  user.whatsappConfig.accessTokenExpiresAt = tokenResult.expires_in
    ? new Date(Date.now() + Number(tokenResult.expires_in) * 1000)
    : undefined;
  user.whatsappConfig.setupStatus = "pending";
  user.whatsappConfig.webhookSubscribed = false;
  user.whatsappConfig.phoneRegistered = false;
  await user.save();

  return {
    setupStatus: "pending",
    phoneNumber: user.whatsappConfig.phoneNumber,
    phoneNumberId: user.whatsappConfig.phoneNumberId,
    verifiedName: phone.verified_name,
  };
}

async function completeSetup(userId, pin) {
  requireMetaConfig();
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    const error = new Error("WhatsApp two-step verification PIN must be 6 digits");
    error.status = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  const config = user.whatsappConfig;
  if (!config?.phoneNumberId || !config.businessAccountId || !config.accessToken) {
    const error = new Error("Start Embedded Signup before completing setup");
    error.status = 409;
    throw error;
  }
  if (config.setupStatus !== "pending") {
    const error = new Error("WhatsApp setup is not pending");
    error.status = 409;
    throw error;
  }

  const accessToken = tokenVault.decrypt(config.accessToken);
  if (!config.webhookSubscribed) {
    try {
      await axios.post(
        `${GRAPH_API_URL}/${config.businessAccountId}/subscribed_apps`,
        {},
        { headers: metaHeaders(accessToken), timeout: 10000 },
      );
      config.webhookSubscribed = true;
      await user.save();
    } catch (error) {
      throw metaFailure(error, "webhook subscription");
    }
  }

  if (!config.phoneRegistered) {
    try {
      await axios.post(
        `${GRAPH_API_URL}/${config.phoneNumberId}/register`,
        { messaging_product: "whatsapp", pin },
        { headers: { ...metaHeaders(accessToken), "Content-Type": "application/json" }, timeout: 10000 },
      );
      config.phoneRegistered = true;
      await user.save();
    } catch (error) {
      throw metaFailure(error, "phone registration");
    }
  }

  config.setupStatus = "connected";
  config.isConnected = true;
  await user.save();
  return {
    isConnected: true,
    phoneNumber: config.phoneNumber,
    phoneNumberId: config.phoneNumberId,
  };
}

function publicConfig() {
  return {
    enabled: Boolean(
      process.env.META_APP_ID &&
        process.env.META_APP_SECRET &&
        process.env.META_EMBEDDED_SIGNUP_CONFIG_ID,
    ),
    appId: process.env.META_APP_ID || "",
    configId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || "",
    graphVersion: GRAPH_API_URL.split("/").pop(),
  };
}

module.exports = { exchangeCode, completeSetup, publicConfig };
