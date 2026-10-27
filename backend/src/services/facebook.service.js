const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const messageService = require("./message.service");
const facebookAPI = require("../utils/facebook.api");

const ATTACHMENT_TYPES = { image: "image", video: "video", audio: "audio", file: "document" };

class FacebookService {
  // Connect Facebook account
  async connectAccount(userId, connectionData) {
    const { pageId, pageName, accessToken } = connectionData;

    if (!pageId || !accessToken) {
      throw new Error("Page ID and Access Token are required");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify the access token with Facebook
    let page;
    try {
      page = await facebookAPI.verifyAccessToken(accessToken, pageId);
    } catch (error) {
      throw new Error("Invalid Facebook credentials");
    }

    user.facebookConfig = {
      isConnected: true,
      pageId,
      pageName: pageName || page?.name || "Facebook Page",
      accessToken,
    };

    await user.save();

    return {
      isConnected: true,
      pageName: user.facebookConfig.pageName,
      pageId: user.facebookConfig.pageId,
    };
  }

  // Disconnect Facebook account
  async disconnectAccount(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.facebookConfig = {
      isConnected: false,
      pageId: null,
      pageName: null,
      accessToken: null,
    };

    await user.save();
    return true;
  }

  // Send a Messenger message through the shared delivery pipeline
  async sendMessage(userId, messageData) {
    const { recipientId, text, type = "text", mediaUrl } = messageData;

    if (!recipientId) {
      throw new Error("Recipient ID is required");
    }

    let customer = await Customer.findOne({
      userId,
      platformId: recipientId,
      platform: "facebook",
    });

    if (!customer) {
      customer = await Customer.create({
        userId,
        name: messageData.recipientName || "Facebook User",
        platformId: recipientId,
        platform: "facebook",
      });
    }

    const message = await messageService.sendMessage(userId, {
      customerId: customer._id,
      platform: "facebook",
      type,
      content: { text, mediaUrl },
    });

    return { success: message.status !== "failed", message, customer };
  }

  // Handle incoming webhook events: messages, deliveries and reads
  async handleWebhook(webhookData) {
    if (webhookData?.object !== "page") {
      return;
    }

    for (const entry of webhookData.entry || []) {
      for (const event of entry.messaging || []) {
        const pageId = event.recipient?.id;
        const senderId = event.sender?.id;

        if (event.message && !event.message.is_echo) {
          await this.processIncomingMessage(pageId, senderId, event);
        } else if (event.delivery) {
          for (const mid of event.delivery.mids || []) {
            await messageService.applyDeliveryStatus(mid, "delivered");
          }
        } else if (event.read?.watermark) {
          await this.processRead(pageId, senderId, event.read.watermark);
        }
      }
    }
  }

  async findPageOwner(pageId) {
    return User.findOne({
      "facebookConfig.pageId": pageId,
      "facebookConfig.isConnected": true,
    });
  }

  // Process incoming message
  async processIncomingMessage(pageId, senderId, event) {
    const user = await this.findPageOwner(pageId);

    if (!user) {
      console.error("User not found for Facebook page:", pageId);
      return;
    }

    const message = event.message;
    const attachment = message.attachments?.[0];
    const type = (attachment && ATTACHMENT_TYPES[attachment.type]) || "text";

    await messageService.receiveMessage({
      user,
      platform: "facebook",
      sender: {
        platformId: senderId,
        // Only looked up when this sender is a new customer
        resolveName: async () => {
          try {
            const info = await facebookAPI.getUserInfo(
              user.facebookConfig.accessToken,
              senderId
            );
            return info.name;
          } catch (error) {
            return "Facebook User";
          }
        },
      },
      platformMessageId: message.mid,
      type,
      content: {
        text: message.text || "",
        mediaUrl: attachment?.payload?.url,
      },
      timestamp: new Date(event.timestamp || Date.now()),
    });
  }

  // The customer read everything we sent up to `watermark`
  async processRead(pageId, senderId, watermark) {
    const user = await this.findPageOwner(pageId);
    if (!user) return;

    const customer = await Customer.findOne({
      userId: user._id,
      platform: "facebook",
      platformId: senderId,
    });
    if (!customer) return;

    await messageService.markReadUpTo(user._id, customer._id, new Date(watermark));
  }
}

module.exports = new FacebookService();
