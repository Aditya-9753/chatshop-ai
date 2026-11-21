function isMetaAIAllowed() {
  return process.env.WHATSAPP_AI_GEMINI_DATA_SHARING_ENABLED === "true";
}

module.exports = { isMetaAIAllowed };
