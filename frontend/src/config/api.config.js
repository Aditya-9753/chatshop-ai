// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  TIMEOUT: 30000,
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    VERIFY_EMAIL: "/auth/verify-email",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
  },

  // User
  USER: {
    PROFILE: "/users/profile",
    UPDATE_PROFILE: "/users/profile",
    UPDATE_PASSWORD: "/users/password",
    WHATSAPP_CONFIG: "/users/whatsapp-config",
    INSTAGRAM_CONFIG: "/users/instagram-config",
    AI_CONFIG: "/users/ai-config",
    BUSINESS_INFO: "/users/business-info",
    DELETE_ACCOUNT: "/users/account",
  },

  // Subscription
  SUBSCRIPTION: {
    PLANS: "/subscriptions/plans",
    CREATE: "/subscriptions/create",
    VERIFY: "/subscriptions/verify",
    CURRENT: "/subscriptions/current",
    CANCEL: "/subscriptions/cancel",
  },

  // WhatsApp
  WHATSAPP: {
    CONNECT: "/whatsapp/connect",
    DISCONNECT: "/whatsapp/disconnect",
    SEND_MESSAGE: "/whatsapp/send-message",
    WEBHOOK: "/whatsapp/webhook",
  },

  // Instagram
  INSTAGRAM: {
    CONNECT: "/instagram/connect",
    DISCONNECT: "/instagram/disconnect",
    SEND_MESSAGE: "/instagram/send-message",
    WEBHOOK: "/instagram/webhook",
  },

  // Customers
  CUSTOMERS: {
    LIST: "/customers",
    GET: (id) => `/customers/${id}`,
    CREATE: "/customers",
    UPDATE: (id) => `/customers/${id}`,
    DELETE: (id) => `/customers/${id}`,
    BLOCK: (id) => `/customers/${id}/block`,
  },

  // Messages
  MESSAGES: {
    LIST: "/messages",
    GET: (id) => `/messages/${id}`,
    CREATE: "/messages",
    UPDATE: (id) => `/messages/${id}`,
    DELETE: (id) => `/messages/${id}`,
    STATS: "/messages/stats",
  },

  // Products
  PRODUCTS: {
    LIST: "/products",
    GET: (id) => `/products/${id}`,
    CREATE: "/products",
    UPDATE: (id) => `/products/${id}`,
    DELETE: (id) => `/products/${id}`,
  },

  // Orders
  ORDERS: {
    LIST: "/orders",
    GET: (id) => `/orders/${id}`,
    CREATE: "/orders",
    UPDATE_STATUS: (id) => `/orders/${id}/status`,
    STATS: "/orders/stats",
  },

  // Analytics
  ANALYTICS: {
    DASHBOARD: "/analytics/dashboard",
    REVENUE: "/analytics/revenue",
    CUSTOMERS: "/analytics/customers",
    MESSAGES: "/analytics/messages",
    PRODUCTS: "/analytics/top-products",
  },

  // Admin
  ADMIN: {
    DASHBOARD: "/admin/dashboard",
    USERS: "/admin/users",
    USER: (id) => `/admin/users/${id}`,
    UPDATE_USER: (id) => `/admin/users/${id}`,
    DELETE_USER: (id) => `/admin/users/${id}`,
    STATS: "/admin/stats",
  },
};
