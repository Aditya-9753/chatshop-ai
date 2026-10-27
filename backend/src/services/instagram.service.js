const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const messageService = require("./message.service");

const ATTACHMENT_TYPES = { image: "image", video: "video", audio: "audio", file: "document" };

class InstagramService {
  // Connect Instagram account
  async connectAccount(userId, connectionData) {
    const { username, businessAccountId, accessToken } = connectionData;

    if (!username || !businessAccountId || !accessToken) {
      throw new Error("Please provide all required fields");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.instagramConfig.isConnected = true;
    user.instagramConfig.username = username;
    user.instagramConfig.businessAccountId = businessAccountId;
    user.instagramConfig.accessToken = accessToken;

    await user.save();

    return {
      isConnected: true,
      username,
    };
  }

  // Disconnect Instagram account
  async disconnectAccount(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.instagramConfig.isConnected = false;
    user.instagramConfig.username = "";
    user.instagramConfig.businessAccountId = "";
    user.instagramConfig.accessToken = "";

    await user.save();
    return true;
  }

  // Send an Instagram message through the shared delivery pipeline
  async sendMessage(userId, messageData) {
    const { recipientId, message } = messageData;
    if (!recipientId) {
      throw new Error("Recipient ID is required");
    }

    let customer = await Customer.findOne({
      userId,
      platformId: recipientId,
      platform: "instagram",
    });

    if (!customer) {
      customer = await Customer.create({
        userId,
        name: "Instagram user",
        platformId: recipientId,
        platform: "instagram",
      });
    }

    return messageService.sendMessage(userId, {
      customerId: customer._id,
      platform: "instagram",
      type: "text",
      content: { text: message },
    });
  }

  // Handle incoming webhook
  async handleWebhook(webhookData) {
    if (webhookData?.object !== "instagram") {
      return;
    }

    for (const item of webhookData.entry || []) {
      for (const event of item.messaging || []) {
        if (event.message && !event.message.is_echo) {
          await this.processIncomingMessage(item.id, event);
        } else if (event.read?.mid) {
          await messageService.applyDeliveryStatus(event.read.mid, "read", {
            timestamp: new Date(event.timestamp || Date.now()),
          });
        }
      }
    }
  }

  // Process incoming message
  async processIncomingMessage(businessAccountId, event) {
    const user = await User.findOne({
      "instagramConfig.businessAccountId": businessAccountId,
      "instagramConfig.isConnected": true,
    });

    if (!user) return;

    const attachment = event.message.attachments?.[0];
    const type = (attachment && ATTACHMENT_TYPES[attachment.type]) || "text";

    await messageService.receiveMessage({
      user,
      platform: "instagram",
      sender: { platformId: event.sender.id },
      platformMessageId: event.message.mid,
      type,
      content: {
        text: event.message.text || "",
        mediaUrl: attachment?.payload?.url,
      },
      timestamp: new Date(event.timestamp || Date.now()),
    });
  }
}

module.exports = new InstagramService();
