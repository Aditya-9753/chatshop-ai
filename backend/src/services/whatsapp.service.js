const fs = require("fs/promises");
const path = require("path");
const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const messageService = require("./message.service");
const whatsappApi = require("../utils/whatsapp.api");

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
const MEDIA_FOLDERS = {
  image: "images",
  sticker: "images",
  video: "videos",
  audio: "audio",
  document: "documents",
};

class WhatsAppService {
  // Connect WhatsApp account. The credentials are checked against Meta
  // first, so a typo shows up here rather than as failed messages later.
  async connectAccount(userId, connectionData) {
    const { phoneNumber, phoneNumberId, businessAccountId, accessToken } =
      connectionData;

    if (!phoneNumberId || !accessToken) {
      throw new Error("Phone number ID and access token are required");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    let verified;
    try {
      verified = await whatsappApi.getPhoneNumber(phoneNumberId, accessToken);
    } catch (error) {
      throw new Error(`Could not verify WhatsApp credentials: ${error.message}`);
    }

    user.whatsappConfig.isConnected = true;
    user.whatsappConfig.phoneNumberId = phoneNumberId;
    user.whatsappConfig.phoneNumber =
      phoneNumber || verified.display_phone_number || "";
    user.whatsappConfig.businessAccountId = businessAccountId || "";
    user.whatsappConfig.accessToken = accessToken;

    await user.save();

    return {
      isConnected: true,
      phoneNumber: user.whatsappConfig.phoneNumber,
      phoneNumberId,
      verifiedName: verified.verified_name,
    };
  }

  // Disconnect WhatsApp account
  async disconnectAccount(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.whatsappConfig.isConnected = false;
    user.whatsappConfig.phoneNumber = "";
    user.whatsappConfig.phoneNumberId = "";
    user.whatsappConfig.businessAccountId = "";
    user.whatsappConfig.accessToken = "";

    await user.save();
    return true;
  }

  // Send a WhatsApp message to a phone number (creating the customer if
  // needed). Delivery goes through the same pipeline as inbox replies.
  async sendMessage(userId, messageData) {
    const { to, type = "text", message, mediaUrl } = messageData;
    if (!to) {
      throw new Error("Recipient phone number is required");
    }

    const platformId = String(to).replace(/\D/g, "");
    let customer = await Customer.findOne({ userId, platform: "whatsapp", platformId });

    if (!customer) {
      customer = await Customer.create({
        userId,
        phone: `+${platformId}`,
        name: `+${platformId}`,
        platform: "whatsapp",
        platformId,
      });
    }

    return messageService.sendMessage(userId, {
      customerId: customer._id,
      platform: "whatsapp",
      type,
      content: { text: message, mediaUrl },
    });
  }

  // Handle incoming webhook: new messages and delivery statuses
  async handleWebhook(webhookData) {
    if (webhookData?.object !== "whatsapp_business_account") {
      return;
    }

    for (const item of webhookData.entry || []) {
      for (const change of item.changes || []) {
        const value = change.value || {};
        if (value.messages) {
          await this.processIncomingMessages(value);
        }
        if (value.statuses) {
          await this.processStatuses(value.statuses);
        }
      }
    }
  }

  // Process incoming messages
  async processIncomingMessages(data) {
    const phoneNumberId = data.metadata?.phone_number_id;
    if (!phoneNumberId) return;

    const user = await User.findOne({
      "whatsappConfig.phoneNumberId": phoneNumberId,
      "whatsappConfig.isConnected": true,
    });
    if (!user) {
      console.warn(`WhatsApp webhook for unknown phone number ID ${phoneNumberId}`);
      return;
    }

    for (const msg of data.messages) {
      if (msg.type === "reaction") {
        await this.applyReaction(msg);
        continue;
      }

      const contact = data.contacts?.find((c) => c.wa_id === msg.from);
      const { type, content } = this.parseMessage(msg);

      if (content.mediaId) {
        content.mediaUrl = await this.saveMedia(user, type, content);
      }

      await messageService.receiveMessage({
        user,
        platform: "whatsapp",
        sender: { platformId: msg.from, name: contact?.profile?.name },
        platformMessageId: msg.id,
        type,
        content,
        timestamp: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
      });
    }
  }

  // Map a WhatsApp message to our { type, content } shape
  parseMessage(msg) {
    switch (msg.type) {
      case "text":
        return { type: "text", content: { text: msg.text?.body || "" } };

      case "image":
      case "video":
      case "audio":
      case "sticker":
      case "document": {
        const media = msg[msg.type] || {};
        return {
          type: msg.type,
          content: {
            caption: media.caption,
            mediaId: media.id,
            mimeType: media.mime_type,
            fileName: media.filename,
          },
        };
      }

      case "location": {
        const { latitude, longitude, name, address } = msg.location || {};
        return {
          type: "location",
          content: {
            text: name || address || "Shared a location",
            location: { latitude, longitude, name, address },
          },
        };
      }

      case "interactive": {
        const reply = msg.interactive?.button_reply || msg.interactive?.list_reply;
        return { type: "text", content: { text: reply?.title || "" } };
      }

      case "button":
        return { type: "text", content: { text: msg.button?.text || "" } };

      case "contacts": {
        const names = (msg.contacts || [])
          .map((c) => c.name?.formatted_name)
          .filter(Boolean)
          .join(", ");
        return { type: "text", content: { text: `Shared contact: ${names || "unknown"}` } };
      }

      case "order": {
        const count = msg.order?.product_items?.length || 0;
        return { type: "text", content: { text: `Sent an order with ${count} item(s)` } };
      }

      default:
        return { type: "text", content: { text: "[Unsupported message type]" } };
    }
  }

  // Incoming media is only an ID; download it so the inbox can show it.
  // Best effort: on failure the message is still saved, without the file.
  async saveMedia(user, type, content) {
    try {
      const { accessToken } = user.whatsappConfig;
      const media = await whatsappApi.getMediaUrl(content.mediaId, accessToken);
      const buffer = await whatsappApi.downloadMedia(media.url, accessToken);

      const mime = content.mimeType || media.mime_type || "";
      const extension = (mime.split("/")[1] || "bin").split(";")[0].trim();
      const folder = MEDIA_FOLDERS[type] || "documents";
      const fileName = `wa-${content.mediaId}.${extension}`;

      await fs.mkdir(path.join(UPLOADS_DIR, "messages", folder), { recursive: true });
      await fs.writeFile(path.join(UPLOADS_DIR, "messages", folder, fileName), buffer);

      content.fileSize = buffer.length;
      return `/uploads/messages/${folder}/${fileName}`;
    } catch (error) {
      console.warn("WhatsApp media download failed:", error.message);
      return undefined;
    }
  }

  // A customer reacted to a message with an emoji (empty emoji = removed)
  async applyReaction(msg) {
    const { message_id: messageId, emoji } = msg.reaction || {};
    if (!messageId) return;

    await Message.updateOne(
      { "metadata.platformMessageId": messageId },
      { $pull: { reactions: { reactedBy: "customer" } } }
    );
    if (emoji) {
      await Message.updateOne(
        { "metadata.platformMessageId": messageId },
        { $push: { reactions: { emoji, reactedBy: "customer" } } }
      );
    }
  }

  // Delivery receipts for messages we sent: sent, delivered, read, failed
  async processStatuses(statuses) {
    for (const status of statuses) {
      const error = status.errors?.[0];
      await messageService.applyDeliveryStatus(status.id, status.status, {
        timestamp: status.timestamp
          ? new Date(Number(status.timestamp) * 1000)
          : new Date(),
        error: error && {
          code: error.code,
          message: error.error_data?.details || error.message || error.title,
        },
      });
    }
  }
}

module.exports = new WhatsAppService();
