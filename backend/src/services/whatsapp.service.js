const User = require("../models/User.model");
const Customer = require("../models/Customer.model");
const Message = require("../models/Message.model");
const whatsappApi = require("../utils/whatsapp.api");

class WhatsAppService {
  // Connect WhatsApp account
  async connectAccount(userId, connectionData) {
    const { phoneNumber, businessAccountId, accessToken } = connectionData;

    if (!phoneNumber || !businessAccountId || !accessToken) {
      throw new Error("Please provide all required fields");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.whatsappConfig.isConnected = true;
    user.whatsappConfig.phoneNumber = phoneNumber;
    user.whatsappConfig.businessAccountId = businessAccountId;
    user.whatsappConfig.accessToken = accessToken;

    await user.save();

    return {
      isConnected: true,
      phoneNumber,
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
    user.whatsappConfig.businessAccountId = "";
    user.whatsappConfig.accessToken = "";

    await user.save();
    return true;
  }

  // Send WhatsApp message
  async sendMessage(userId, messageData) {
    const { to, type, message, mediaUrl } = messageData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.whatsappConfig.isConnected) {
      throw new Error("WhatsApp not connected");
    }

    // Send via WhatsApp API
    const response = await whatsappApi.sendMessage({
      businessAccountId: user.whatsappConfig.businessAccountId,
      accessToken: user.whatsappConfig.accessToken,
      to,
      type,
      message,
      mediaUrl,
    });

    // Find or create customer
    let customer = await Customer.findOne({
      userId,
      phone: to,
      platform: "whatsapp",
    });

    if (!customer) {
      customer = await Customer.create({
        userId,
        phone: to,
        platform: "whatsapp",
        platformId: to,
      });
    }

    // Save message to database
    await Message.create({
      userId,
      customerId: customer._id,
      platform: "whatsapp",
      direction: "outgoing",
      type,
      content: { text: message, mediaUrl },
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
      const changes = item.changes || [];

      for (const change of changes) {
        if (change.value?.messages) {
          await this.processIncomingMessages(change.value);
        }
      }
    }
  }

  // Process incoming messages
  async processIncomingMessages(data) {
    const messages = data.messages;

    for (const msg of messages) {
      const from = msg.from;
      const messageType = msg.type;
      const messageContent = msg[messageType];

      // Find user by business account ID
      const user = await User.findOne({
        "whatsappConfig.businessAccountId": data.metadata.phone_number_id,
      });

      if (!user) continue;

      // Find or create customer
      let customer = await Customer.findOne({
        userId: user._id,
        phone: from,
        platform: "whatsapp",
      });

      if (!customer) {
        customer = await Customer.create({
          userId: user._id,
          phone: from,
          platform: "whatsapp",
          platformId: from,
          name: data.contacts?.[0]?.profile?.name || "Unknown",
        });

        await User.findByIdAndUpdate(user._id, {
          $inc: { "stats.totalCustomers": 1 },
        });
      }

      // Save incoming message
      await Message.create({
        userId: user._id,
        customerId: customer._id,
        platform: "whatsapp",
        direction: "incoming",
        type: messageType,
        content: {
          text: messageContent.body || messageContent.caption,
          mediaUrl: messageContent.url || messageContent.link,
        },
        status: "received",
        metadata: { messageId: msg.id },
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
}

module.exports = new WhatsAppService();
