const axios = require("axios");

const INSTAGRAM_API_URL = "https://graph.facebook.com/v18.0";

class InstagramAPI {
  // Send message via Instagram Graph API
  async sendMessage(data) {
    const { accessToken, recipientId, message } = data;

    try {
      const response = await axios.post(
        `${INSTAGRAM_API_URL}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text: message },
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
        "Instagram API send message error:",
        error.response?.data || error.message
      );
      throw new Error(
        error.response?.data?.error?.message ||
          "Failed to send Instagram message"
      );
    }
  }

  // Send media message
  async sendMediaMessage(
    accessToken,
    recipientId,
    mediaUrl,
    mediaType = "image"
  ) {
    try {
      const messageData = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: mediaType,
            payload: {
              url: mediaUrl,
            },
          },
        },
      };

      const response = await axios.post(
        `${INSTAGRAM_API_URL}/me/messages`,
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
        "Instagram API send media error:",
        error.response?.data || error.message
      );
      throw new Error("Failed to send media message");
    }
  }

  // Get user profile
  async getUserProfile(userId, accessToken) {
    try {
      const response = await axios.get(`${INSTAGRAM_API_URL}/${userId}`, {
        params: {
          fields: "id,username,name,profile_picture_url",
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error(
        "Instagram API get profile error:",
        error.response?.data || error.message
      );
      throw new Error("Failed to get user profile");
    }
  }

  // Mark message as seen
  async markAsSeen(accessToken, messageId) {
    try {
      const response = await axios.post(
        `${INSTAGRAM_API_URL}/me/messages`,
        {
          recipient: { id: messageId },
          sender_action: "mark_seen",
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
        "Instagram API mark as seen error:",
        error.response?.data || error.message
      );
      throw new Error("Failed to mark message as seen");
    }
  }
}

module.exports = new InstagramAPI();
