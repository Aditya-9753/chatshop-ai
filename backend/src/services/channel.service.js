const whatsappApi = require("../utils/whatsapp.api");
const instagramApi = require("../utils/instagram.api");
const facebookApi = require("../utils/facebook.api");
const { ChannelError, toPublicMediaUrl } = require("../utils/meta");

const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"];

const PLATFORM_NAMES = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};

// One entry point for delivering an outgoing message to the customer's
// platform. Resolves to { platformMessageId } or throws a ChannelError.
class ChannelService {
  async send(platform, user, customer, message) {
    switch (platform) {
      case "whatsapp":
        return this.sendWhatsApp(user, customer, message);
      case "instagram":
        return this.sendInstagram(user, customer, message);
      case "facebook":
        return this.sendFacebook(user, customer, message);
      default:
        throw new ChannelError("UNKNOWN_PLATFORM", `Unknown platform "${platform}"`);
    }
  }

  requireConnected(config, platform) {
    if (!config?.isConnected || !config.accessToken) {
      throw new ChannelError(
        "NOT_CONNECTED",
        `${PLATFORM_NAMES[platform]} is not connected. Connect it in Settings → Channels.`
      );
    }
  }

  // Text to send with the message (caption for media, body for text)
  textOf(message) {
    return message.content?.text || message.content?.caption || "";
  }

  async sendWhatsApp(user, customer, message) {
    const config = user.whatsappConfig;
    this.requireConnected(config, "whatsapp");

    if (!config.phoneNumberId) {
      throw new ChannelError(
        "MISSING_PHONE_NUMBER_ID",
        "WhatsApp phone number ID is missing. Reconnect WhatsApp in Settings → Channels."
      );
    }

    const to = customer.platformId || customer.phone;
    if (!to) {
      throw new ChannelError("NO_RECIPIENT", "This customer has no WhatsApp number.");
    }

    const isMedia = MEDIA_TYPES.includes(message.type) && message.content?.mediaUrl;
    const location = message.content?.location;
    const type = isMedia
      ? message.type
      : message.type === "location" && location?.latitude != null
        ? "location"
        : "text";

    const response = await whatsappApi.sendMessage({
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      to,
      type,
      message: this.textOf(message),
      mediaUrl: isMedia ? toPublicMediaUrl(message.content.mediaUrl) : undefined,
      fileName: message.content?.fileName,
      location,
    });

    return { platformMessageId: response.messages?.[0]?.id };
  }

  async sendInstagram(user, customer, message) {
    const config = user.instagramConfig;
    this.requireConnected(config, "instagram");

    if (!customer.platformId) {
      throw new ChannelError("NO_RECIPIENT", "This customer has no Instagram ID.");
    }

    const response = MEDIA_TYPES.includes(message.type) && message.content?.mediaUrl
      ? await instagramApi.sendMediaMessage(
          config.accessToken,
          customer.platformId,
          toPublicMediaUrl(message.content.mediaUrl),
          message.type === "document" ? "file" : message.type
        )
      : await instagramApi.sendMessage({
          accessToken: config.accessToken,
          recipientId: customer.platformId,
          message: this.textOf(message),
        });

    return { platformMessageId: response.message_id };
  }

  async sendFacebook(user, customer, message) {
    const config = user.facebookConfig;
    this.requireConnected(config, "facebook");

    if (!customer.platformId) {
      throw new ChannelError("NO_RECIPIENT", "This customer has no Messenger ID.");
    }

    const response = MEDIA_TYPES.includes(message.type) && message.content?.mediaUrl
      ? await facebookApi.sendMediaMessage(
          config.accessToken,
          customer.platformId,
          message.type,
          toPublicMediaUrl(message.content.mediaUrl)
        )
      : await facebookApi.sendTextMessage(
          config.accessToken,
          customer.platformId,
          this.textOf(message)
        );

    return { platformMessageId: response.message_id };
  }
}

module.exports = new ChannelService();
