const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const instagramApi = require("../utils/instagram.api");

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

  // Send Instagram message
  async sendMessage(userId, messageData) {
    const { recipientId, message } = messageData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.instagramConfig.isConnected) {
      throw new Error("Instagram not connected");
    }

    // Send via Instagram API
    const response = await instagramApi.sendMessage({
      accessToken: user.instagramConfig.accessToken,
      recipientId,
      message,
    });

    // Find or create customer
    let customer = await Customer.findOne({
      userId,
      platformId: recipientId,
      platform: "instagram",
    });

    if (!customer) {
      customer = await Customer.create({
        userId,
        platformId: recipientId,
        platform: "instagram",
      });
    }

    // Save message to database
    await Message.create({
      userId,
      customerId: customer._id,
      platform: "instagram",
      direction: "outgoing",
      type: "text",
      content: { text: message },
      status: "sent",
    });

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { "stats.totalMessages": 1 },
    });

    return response;
  }

  // Handle incoming webhook
  async handleWebhook(webhookData) {
    const { entry } = webhookData;

    if (!entry || entry.length === 0) {
      return;
    }

    for (const item of entry) {
      const messaging = item.messaging || [];

      for (const event of messaging) {
        if (event.message) {
          await this.processIncomingMessage(item.id, event);
        }
      }
    }
  }

  // Process incoming message
  async processIncomingMessage(businessAccountId, event) {
    const senderId = event.sender.id;
    const messageText = event.message.text;

    // Find user by Instagram business account ID
    const user = await User.findOne({
      "instagramConfig.businessAccountId": businessAccountId,
    });

    if (!user) return;

    // Find or create customer
    let customer = await Customer.findOne({
      userId: user._id,
      platformId: senderId,
      platform: "instagram",
    });

    if (!customer) {
      customer = await Customer.create({
        userId: user._id,
        platformId: senderId,
        platform: "instagram",
      });

      await User.findByIdAndUpdate(user._id, {
        $inc: { "stats.totalCustomers": 1 },
      });
    }

    // Save incoming message
    await Message.create({
      userId: user._id,
      customerId: customer._id,
      platform: "instagram",
      direction: "incoming",
      type: "text",
      content: { text: messageText },
      status: "received",
      metadata: { messageId: event.message.mid },
    });

    // Update customer last message date
    customer.lastMessageDate = new Date();
    await customer.save();

    // Update user stats
    await User.findByIdAndUpdate(user._id, {
      $inc: { "stats.totalMessages": 1 },
    });
  }
}

module.exports = new InstagramService();
