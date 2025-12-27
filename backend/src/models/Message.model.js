const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    platform: {
      type: String,
      enum: ["whatsapp", "instagram"],
      required: true,
    },
    direction: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "document", "product"],
      default: "text",
    },
    content: {
      text: String,
      mediaUrl: String,
      caption: String,
    },
    isAIGenerated: {
      type: Boolean,
      default: false,
    },
    isRead: {
    type: Boolean,
    default: false
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "read", "failed"],
      default: "sent",
    },
    metadata: {
      messageId: String, // Platform message ID
      timestamp: Date,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
