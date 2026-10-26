/**
 * Application Constants
 * Centralized constants for the entire application
 */

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

// User Roles
const USER_ROLES = {
  ADMIN: "admin",
  USER: "user",
};

// Subscription Plans
const SUBSCRIPTION_PLANS = {
  FREE: "free",
  BASIC: "basic",
  PREMIUM: "premium",
};

// Subscription Status
const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

// Order Status
const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  REFUNDED: "refunded",
};

// Message Types
const MESSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  DOCUMENT: "document",
  AUDIO: "audio",
  TEMPLATE: "template",
};

// Message Status
const MESSAGE_STATUS = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
};

// Customer Sources
const CUSTOMER_SOURCES = {
  WHATSAPP: "whatsapp",
  INSTAGRAM: "instagram",
  MANUAL: "manual",
};

// File Upload Limits
const UPLOAD_LIMITS = {
  IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  VIDEO_SIZE: 50 * 1024 * 1024, // 50MB
  DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
};

// Allowed File Types
const ALLOWED_FILE_TYPES = {
  IMAGES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  VIDEOS: ["video/mp4", "video/mpeg", "video/quicktime"],
  DOCUMENTS: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
};

// Rate Limiting
const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
};

// JWT Configuration
const JWT_CONFIG = {
  EXPIRES_IN: "7d",
  ALGORITHM: "HS256",
};

// Pagination Defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

// Error Messages
const ERROR_MESSAGES = {
  UNAUTHORIZED: "Unauthorized access",
  FORBIDDEN: "You do not have permission to perform this action",
  NOT_FOUND: "Resource not found",
  VALIDATION_ERROR: "Validation failed",
  INTERNAL_ERROR: "Internal server error",
  INVALID_CREDENTIALS: "Invalid email or password",
  USER_EXISTS: "User already exists with this email",
  USER_NOT_FOUND: "User not found",
  INVALID_TOKEN: "Invalid or expired token",
  EMAIL_NOT_VERIFIED: "Please verify your email first",
};

// Success Messages
const SUCCESS_MESSAGES = {
  LOGIN: "Login successful",
  REGISTER: "Registration successful",
  LOGOUT: "Logout successful",
  EMAIL_VERIFIED: "Email verified successfully",
  PASSWORD_RESET: "Password reset successful",
  PROFILE_UPDATED: "Profile updated successfully",
  PASSWORD_UPDATED: "Password updated successfully",
  DELETED: "Deleted successfully",
  CREATED: "Created successfully",
  UPDATED: "Updated successfully",
};

module.exports = {
  HTTP_STATUS,
  USER_ROLES,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  CUSTOMER_SOURCES,
  UPLOAD_LIMITS,
  ALLOWED_FILE_TYPES,
  RATE_LIMIT,
  JWT_CONFIG,
  PAGINATION,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};
