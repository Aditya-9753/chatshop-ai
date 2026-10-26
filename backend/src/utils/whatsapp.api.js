const axios = require("axios");

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

class WhatsAppAPI {
  // Send message via WhatsApp Business API
  async sendMessage(data) {
    const { businessAccountId, accessToken, to, type, message, mediaUrl } =
      data;

    try {
      // Prepare message payload
      let messageData = {
        messaging_product: "whatsapp",
        to,
        type,
      };

      if (type === "text") {
        messageData.text = { body: message };
      } else if (type === "image") {
        messageData.image = { link: mediaUrl, caption: message };
      } else if (type === "video") {
        messageData.video = { link: mediaUrl, caption: message };
      } else if (type === "document") {
        messageData.document = { link: mediaUrl, caption: message };
      } else if (type === "audio") {
        messageData.audio = { link: mediaUrl };
      }

      // Send request to WhatsApp API
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${businessAccountId}/messages`,
        messageData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "WhatsApp API send message error:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.error?.message ||
          "Failed to send WhatsApp message"
      );
    }
  }

  // Mark message as read
  async markAsRead(businessAccountId, accessToken, messageId) {
    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${businessAccountId}/messages`,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "WhatsApp API mark as read error:",
        error.response?.data || error.message
      );
      throw new Error("Failed to mark message as read");
    }
  }

  // Get media URL
  async getMediaUrl(mediaId, accessToken) {
    try {
      const response = await axios.get(`${WHATSAPP_API_URL}/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.url;
    } catch (error) {
      console.error(
        "WhatsApp API get media error:",
        error.response?.data || error.message
      );
      throw new Error("Failed to get media URL");
    }
  }

  // Send template message
  async sendTemplate(businessAccountId, accessToken, to, templateData) {
    try {
      const messageData = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: templateData,
      };

      const response = await axios.post(
        `${WHATSAPP_API_URL}/${businessAccountId}/messages`,
        messageData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "WhatsApp API send template error:",
        error.response?.data || error.message
      );
      throw new Error("Failed to send template message");
    }
  }
}

module.exports = new WhatsAppAPI();
