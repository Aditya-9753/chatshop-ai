const axios = require("axios");

const { GRAPH_API_URL: FACEBOOK_API_URL, toMetaError } = require("./meta");

class FacebookAPI {
  // Verify access token
  async verifyAccessToken(accessToken, pageId) {
    try {
      const response = await axios.get(`${FACEBOOK_API_URL}/${pageId}`, {
        params: {
          fields: "id,name",
          access_token: accessToken,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error("Invalid access token or page ID");
    }
  }

  // Send text message
  async sendTextMessage(accessToken, recipientId, text) {
    try {
      const response = await axios.post(
        `${FACEBOOK_API_URL}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text },
        },
        {
          params: { access_token: accessToken },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Facebook API Error:", error.response?.data || error);
      throw toMetaError(error, "Failed to send message");
    }
  }

  // Send media message (image, video, audio, file)
  async sendMediaMessage(accessToken, recipientId, type, mediaUrl) {
    try {
      const attachmentType = type === "document" ? "file" : type;
      const response = await axios.post(
        `${FACEBOOK_API_URL}/me/messages`,
        {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: attachmentType,
              payload: {
                url: mediaUrl,
                is_reusable: true,
              },
            },
          },
        },
        {
          params: { access_token: accessToken },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Facebook API Error:", error.response?.data || error);
      throw toMetaError(error, "Failed to send media");
    }
  }

  // Get user info
  async getUserInfo(accessToken, userId) {
    try {
      const response = await axios.get(`${FACEBOOK_API_URL}/${userId}`, {
        params: {
          fields: "id,name,profile_pic",
          access_token: accessToken,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Facebook API Error:", error.response?.data || error);
      throw new Error("Failed to fetch user info");
    }
  }

  // Send quick replies
  async sendQuickReplies(accessToken, recipientId, text, quickReplies) {
    try {
      const response = await axios.post(
        `${FACEBOOK_API_URL}/me/messages`,
        {
          recipient: { id: recipientId },
          message: {
            text,
            quick_replies: quickReplies.map((reply) => ({
              content_type: "text",
              title: reply,
              payload: reply,
            })),
          },
        },
        {
          params: { access_token: accessToken },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Facebook API Error:", error.response?.data || error);
      throw toMetaError(error, "Failed to send quick replies");
    }
  }

  // Send button template
  async sendButtonTemplate(accessToken, recipientId, text, buttons) {
    try {
      const response = await axios.post(
        `${FACEBOOK_API_URL}/me/messages`,
        {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "button",
                text,
                buttons: buttons.map((button) => ({
                  type: "web_url",
                  url: button.url,
                  title: button.title,
                })),
              },
            },
          },
        },
        {
          params: { access_token: accessToken },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Facebook API Error:", error.response?.data || error);
      throw toMetaError(error, "Failed to send button template");
    }
  }
}

module.exports = new FacebookAPI();
