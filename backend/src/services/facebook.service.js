const User = require("../models/User.model");
const Message = require("../models/Message.model");
const Customer = require("../models/Customer.model");
const facebookAPI = require("../utils/facebook.api");

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
    try {
      await facebookAPI.verifyAccessToken(accessToken, pageId);
    } catch (error) {
      throw new Error("Invalid Facebook credentials");
    }

    user.facebookConfig = {
      isConnected: true,
      pageId,
      pageName: pageName || "Facebook Page",
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

  // Send message via Facebook
  async sendMessage(userId, messageData) {
    const { recipientId, text, type = "text", mediaUrl } = messageData;

    if (!recipientId) {
      throw new Error("Recipient ID is required");
    }

    const user = await User.findById(userId);
    if (!user || !user.facebookConfig?.isConnected) {
      throw new Error("Facebook account not connected");
    }

    // Send message via Facebook API
    let messageSent;
    try {
      if (type === "text") {
        messageSent = await facebookAPI.sendTextMessage(
          user.facebookConfig.accessToken,
          recipientId,
          text
        );
      } else {
        messageSent = await facebookAPI.sendMediaMessage(
          user.facebookConfig.accessToken,
          recipientId,
          type,
          mediaUrl
        );
      }
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    // Find or create customer
    let customer = await Customer.findOne({
      userId: user._id,
      platformId: recipientId,
      platform: "facebook",
    });

    if (!customer) {
      customer = await Customer.create({
        userId: user._id,
        name: messageData.recipientName || "Facebook User",
        platformId: recipientId,
        platform: "facebook",
      });
    }

    // Save message to database
    const message = await Message.create({
      userId: user._id,
      customerId: customer._id,
      platform: "facebook",
      direction: "outgoing",
      type,
      content: {
        text: type === "text" ? text : null,
        mediaUrl: type !== "text" ? mediaUrl : null,
      },
      status: "sent",
      metadata: {
        messageId: messageSent.message_id,
        timestamp: new Date(),
      },
    });

    // Update user stats
    user.stats.messagesSent += 1;
    user.stats.platforms.facebook += 1;
    await user.save();

    return {
      success: true,
      message,
      customer,
    };
  }

  // Handle incoming webhook events
  async handleWebhook(webhookData) {
    if (webhookData.object !== "page") {
      return;
    }

    for (const entry of webhookData.entry) {
      const messaging = entry.messaging[0];
      if (!messaging) continue;

      const senderId = messaging.sender.id;
      const recipientId = messaging.recipient.id;
      const message = messaging.message;

      if (message) {
        await this.processIncomingMessage(recipientId, senderId, message);
      }
    }
  }

  // Process incoming message
  async processIncomingMessage(pageId, senderId, messageData) {
    // Find user by page ID
    const user = await User.findOne({
      "facebookConfig.pageId": pageId,
      "facebookConfig.isConnected": true,
    });

    if (!user) {
      console.error("User not found for Facebook page:", pageId);
      return;
    }

    // Find or create customer
    let customer = await Customer.findOne({
      userId: user._id,
      platformId: senderId,
      platform: "facebook",
    });

    if (!customer) {
      // Fetch user info from Facebook
      let userName = "Facebook User";
      try {
        const userInfo = await facebookAPI.getUserInfo(
          user.facebookConfig.accessToken,
          senderId
        );
        userName = userInfo.name || userName;
      } catch (error) {
        console.error("Failed to fetch Facebook user info:", error);
      }

      customer = await Customer.create({
        userId: user._id,
        name: userName,
        platformId: senderId,
        platform: "facebook",
      });
    }

    // Determine message type and content
    let messageType = "text";
    let content = {
      text: messageData.text || null,
      mediaUrl: null,
    };

    if (messageData.attachments && messageData.attachments.length > 0) {
      const attachment = messageData.attachments[0];
      messageType = attachment.type; // image, video, audio, file
      content.mediaUrl = attachment.payload.url;
    }

    // Save message to database
    await Message.create({
      userId: user._id,
      customerId: customer._id,
      platform: "facebook",
      direction: "incoming",
      type: messageType,
      content,
      status: "received",
      metadata: {
        messageId: messageData.mid,
        timestamp: new Date(),
      },
    });

    // Update user stats
    user.stats.messagesReceived += 1;
    user.stats.platforms.facebook += 1;
    await user.save();

    // Update customer last contact
    customer.lastContacted = new Date();
    await customer.save();
  }
}

module.exports = new FacebookService();
