import api from "./api.service";

// ==================== CONVERSATION API ====================

/**
 * Fetch all conversations for the inbox (sorted by newest)
 * @param {Object} filters - Optional filters { platform, status }
 * @returns {Promise} Conversations array
 */
export const fetchConversations = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const url = queryParams ? `/conversations?${queryParams}` : "/conversations";
  return await api.get(url);
};

/**
 * Mark a conversation as read (reset unreadCount to 0)
 * @param {String} conversationId - The conversation ID
 * @returns {Promise} Updated conversation
 */
export const markConversationAsRead = async (conversationId) => {
  return await api.put(`/conversations/${conversationId}/read`);
};

/**
 * Update conversation status
 * @param {String} conversationId - The conversation ID
 * @param {String} status - open, closed, archived, snoozed
 * @returns {Promise} Updated conversation
 */
export const updateConversationStatus = async (conversationId, status) => {
  return await api.put(`/conversations/${conversationId}/status`, { status });
};

/**
 * Assign conversation to a team member
 * @param {String} conversationId - The conversation ID
 * @param {String} assignedToUserId - User ID to assign to
 * @returns {Promise} Updated conversation
 */
export const assignConversation = async (conversationId, assignedToUserId) => {
  return await api.put(`/conversations/${conversationId}/assign`, {
    assignedTo: assignedToUserId,
  });
};

/**
 * Add tags to a conversation
 * @param {String} conversationId - The conversation ID
 * @param {Array} tags - Array of tag strings
 * @returns {Promise} Updated conversation
 */
export const addConversationTags = async (conversationId, tags) => {
  return await api.put(`/conversations/${conversationId}/tags`, { tags });
};

/**
 * Remove tags from a conversation
 * @param {String} conversationId - The conversation ID
 * @param {Array} tags - Array of tag strings to remove
 * @returns {Promise} Updated conversation
 */
export const removeConversationTags = async (conversationId, tags) => {
  return await api.delete(`/conversations/${conversationId}/tags`, {
    data: { tags },
  });
};

// ==================== MESSAGE API ====================

/**
 * Get all messages with pagination and filters
 * @param {Object} filters - { customerId, platform, type, page, limit }
 * @returns {Promise} Messages with pagination info
 */
export const getMessages = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const url = queryParams ? `/messages?${queryParams}` : "/messages";
  return await api.get(url);
};

/**
 * Send a message
 * @param {Object} messageData - { customerId, platform, type, content, replyTo }
 * @returns {Promise} Created message
 */
export const sendMessage = async (messageData) => {
  return await api.post("/messages/send", messageData);
};

/**
 * Delete a message (soft delete)
 * @param {String} messageId - The message ID
 * @returns {Promise} Deleted message
 */
export const deleteMessage = async (messageId) => {
  return await api.delete(`/messages/${messageId}`);
};

/**
 * Edit a message
 * @param {String} messageId - The message ID
 * @param {String} newText - The new message text
 * @returns {Promise} Updated message
 */
export const editMessage = async (messageId, newText) => {
  return await api.put(`/messages/${messageId}/edit`, { text: newText });
};

/**
 * Get messages for a specific customer
 * @param {String} customerId - The customer ID
 * @returns {Promise} Messages array
 */
export const getCustomerMessages = async (customerId) => {
  return await api.get(`/messages/${customerId}`);
};

/**
 * Get message statistics
 * @param {Object} filters - { startDate, endDate }
 * @returns {Promise} Message statistics
 */
export const getMessageStats = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const url = queryParams ? `/messages/stats?${queryParams}` : "/messages/stats";
  return await api.get(url);
};

/**
 * Get conversations (legacy - use fetchConversations instead)
 * @deprecated Use fetchConversations() instead
 * @returns {Promise} Conversations array
 */
export const getConversations = async () => {
  return await api.get("/messages/conversations");
};

export default {
  // Conversation methods
  fetchConversations,
  markConversationAsRead,
  updateConversationStatus,
  assignConversation,
  addConversationTags,
  removeConversationTags,

  // Message methods
  getMessages,
  sendMessage,
  deleteMessage,
  editMessage,
  getCustomerMessages,
  getMessageStats,
  getConversations, // Legacy
};
