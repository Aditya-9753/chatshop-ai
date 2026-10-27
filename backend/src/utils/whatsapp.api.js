const axios = require("axios");
const { GRAPH_API_URL, toMetaError } = require("./meta");

// WhatsApp Cloud API. Every call is addressed to the business phone
// number ID (not the WhatsApp Business Account ID).
class WhatsAppAPI {
  headers(accessToken) {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  // WhatsApp expects the recipient as digits only, with country code
  normalizeRecipient(to) {
    return String(to || "").replace(/\D/g, "");
  }

  buildPayload({ to, type, message, mediaUrl, fileName, location }) {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: this.normalizeRecipient(to),
      type,
    };

    switch (type) {
      case "image":
      case "video":
        payload[type] = { link: mediaUrl, ...(message && { caption: message }) };
        break;
      case "document":
        payload.document = {
          link: mediaUrl,
          ...(message && { caption: message }),
          ...(fileName && { filename: fileName }),
        };
        break;
      case "audio":
      case "sticker":
        payload[type] = { link: mediaUrl };
        break;
      case "location":
        payload.location = location;
        break;
      default:
        payload.type = "text";
        payload.text = { body: message, preview_url: true };
    }

    return payload;
  }

  // Send a message; resolves to Meta's response ({ messages: [{ id }] })
  async sendMessage({ phoneNumberId, accessToken, ...message }) {
    try {
      const response = await axios.post(
        `${GRAPH_API_URL}/${phoneNumberId}/messages`,
        this.buildPayload(message),
        { headers: this.headers(accessToken), timeout: 15000 }
      );
      return response.data;
    } catch (error) {
      console.error(
        "WhatsApp API send message error:",
        error.response?.data || error.message
      );
      throw toMetaError(error, "Failed to send WhatsApp message");
    }
  }

  // Send a read receipt for an incoming message (blue ticks on the phone)
  async markAsRead(phoneNumberId, accessToken, messageId) {
    try {
      const response = await axios.post(
        `${GRAPH_API_URL}/${phoneNumberId}/messages`,
        { messaging_product: "whatsapp", status: "read", message_id: messageId },
        { headers: this.headers(accessToken), timeout: 10000 }
      );
      return response.data;
    } catch (error) {
      throw toMetaError(error, "Failed to mark message as read");
    }
  }

  // Check the credentials by reading the phone number they belong to
  async getPhoneNumber(phoneNumberId, accessToken) {
    try {
      const response = await axios.get(`${GRAPH_API_URL}/${phoneNumberId}`, {
        params: { fields: "display_phone_number,verified_name" },
        headers: this.headers(accessToken),
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      throw toMetaError(error, "Could not verify WhatsApp credentials");
    }
  }

  // Incoming media arrives as an ID; resolve it to a short-lived URL
  async getMediaUrl(mediaId, accessToken) {
    try {
      const response = await axios.get(`${GRAPH_API_URL}/${mediaId}`, {
        headers: this.headers(accessToken),
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      throw toMetaError(error, "Failed to get media URL");
    }
  }

  // The media URL itself also requires the access token
  async downloadMedia(url, accessToken) {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "arraybuffer",
      timeout: 15000,
      maxContentLength: 20 * 1024 * 1024,
    });
    return Buffer.from(response.data);
  }

  async sendTemplate(phoneNumberId, accessToken, to, templateData) {
    try {
      const response = await axios.post(
        `${GRAPH_API_URL}/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: this.normalizeRecipient(to),
          type: "template",
          template: templateData,
        },
        { headers: this.headers(accessToken), timeout: 15000 }
      );
      return response.data;
    } catch (error) {
      throw toMetaError(error, "Failed to send template message");
    }
  }
}

module.exports = new WhatsAppAPI();
