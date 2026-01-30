const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
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
      index: true,
    },
    platform: {
      type: String,
      enum: ["whatsapp", "instagram", "facebook"],
      required: true,
    },

    // --- CACHED DATA FOR INBOX ---
    lastMessage: {
      content: { type: String }, 
      // ⬇️ FIX: We wrap 'type' in an object so Mongoose knows it's a field name
      type: { 
        type: String, 
        enum: ["text", "image", "video", "audio", "document", "template"],
        default: "text"
      },
      timestamp: { type: Date }
    },
    
    unreadCount: { type: Number, default: 0 },
    
    status: { 
      type: String, 
      enum: ["open", "closed", "archived", "snoozed"], 
      default: "open" 
    },
    
    tags: [{ type: String }],
  },
  { timestamps: true }
);

// Indexes
conversationSchema.index({ userId: 1, customerId: 1, platform: 1 }, { unique: true });
conversationSchema.index({ userId: 1, "lastMessage.timestamp": -1 });

module.exports = mongoose.model("Conversation", conversationSchema);