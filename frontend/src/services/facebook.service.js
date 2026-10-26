import api from "./api.service";
import { API_CONFIG } from "../config/api.config";

// Connect Facebook Page
export const connectFacebook = async (connectionData) => {
  return await api.post(API_CONFIG.FACEBOOK.CONNECT, connectionData);
};

// Disconnect Facebook
export const disconnectFacebook = async () => {
  return await api.post(API_CONFIG.FACEBOOK.DISCONNECT);
};

// Send message via Facebook
export const sendFacebookMessage = async (messageData) => {
  return await api.post(API_CONFIG.FACEBOOK.SEND_MESSAGE, messageData);
};

// Update Facebook configuration
export const updateFacebookConfig = async (configData) => {
  return await api.put(API_CONFIG.USER.FACEBOOK_CONFIG, configData);
};

// Get Facebook connection status
export const getFacebookStatus = async () => {
  return await api.get(API_CONFIG.USER.FACEBOOK_CONFIG);
};

const facebookService = {
  connectFacebook,
  disconnectFacebook,
  sendFacebookMessage,
  updateFacebookConfig,
  getFacebookStatus,
};

export default facebookService;
