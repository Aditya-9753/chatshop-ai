const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // --- CORE IDENTITY ---
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    // Optional: Group messages by a Conversation ID (Industry Standard for speed)
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
      // specific logic can generate this (e.g., userId + customerId)
    },

    // --- PLATFORM INFO ---
    platform: {
      type: String,
      enum: ["whatsapp", "instagram", "facebook"],
      required: true,
    },
    direction: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true,
    },

    // --- CONTENT & TYPE ---
    type: {
      type: String,
      enum: [
        "text",
        "image",
        "video",
        "audio",
        "document",
        "product",
        "location",
        "sticker",
        "template",
      ],
      default: "text",
    },
    content: {
      text: String,
      mediaUrl: String,
      caption: String,
      thumbnailUrl: String, // Good for Videos/Documents previews
      fileName: String, // Good for Documents
      mimeType: String, // File MIME type
      duration: Number, // Audio/Video duration in seconds
      fileSize: Number, // File size in bytes
      location: {
        // Industry Standard for Location messages
        latitude: Number,
        longitude: Number,
        name: String,
        address: String,
      },
    },

    // --- CONTEXT & THREADING (Industry Standard) ---
    // Handles "Replying to" a specific message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // Handles Forwarded messages
    isForwarded: {
      type: Boolean,
      default: false,
    },

    // --- DELETION LOGIC (Your Request) ---
    // "Soft Delete": We keep the data but flag it
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      enum: ["user", "customer", "system"], // Who deleted it?
    },

    // --- EDITING LOGIC (Industry Standard) ---
    isEdited: {
      type: Boolean,
      default: false,
    },
    // Keeps a history of what the message was BEFORE the edit
    editHistory: [
      {
        previousContent: String,
        editedAt: Date,
      },
    ],

    // --- AI & AUTOMATION ---
    isAIGenerated: {
      type: Boolean,
      default: false,
    },
    aiMetadata: {
      modelUsed: String, // e.g., "gpt-4", "claude"
      tokensUsed: Number, // Good for cost tracking
      intent: String, // e.g., "order_inquiry", "complaint"
    },

    // --- STATUS & DELIVERY ---
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    seenBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        seenAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "read", "failed"],
      default: "queued", // "queued" is better initial state than "sent"
    },
    // If status is "failed", store WHY here
    errorDetails: {
      code: String,
      message: String, // e.g., "Recipient phone number not valid"
      timestamp: Date,
    },

    // --- REACTIONS (Like/Heart) ---
    reactions: [
      {
        emoji: String, // The emoji used
        reactedBy: String, // 'customer' or 'user'
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // --- EXTERNAL MAPPING ---
    metadata: {
      platformMessageId: { type: String, unique: true, sparse: true }, // The WhatsApp/Meta ID
      timestamp: Date,
    },
  },
  {
    timestamps: true,
  },
);

// --- INDEXES FOR PERFORMANCE ---
// 1. Fetching chat history for a specific customer & user
messageSchema.index({ userId: 1, customerId: 1, createdAt: -1 });

// 2. Fetching only NOT deleted messages (for standard UI view)
messageSchema.index({ userId: 1, isDeleted: 1 });

module.exports = mongoose.model("Message", messageSchema);
