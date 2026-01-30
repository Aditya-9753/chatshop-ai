const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    platform: { type: String, enum: ["whatsapp", "instagram"], required: true },

    // --- CACHED DATA FOR INBOX (Speed Optimization) ---
    // We store the last message here so we don't have to query the Message table just to show the list
    lastMessage: {
      content: String, // "Hello, how much is..."
      type: String,    // "text", "image"
      timestamp: Date,
    },
    
    // --- COUNTERS ---
    unreadCount: { type: Number, default: 0 },
    
    // --- STATUS MANAGEMENT ---
    status: { 
      type: String, 
      enum: ["open", "closed", "archived", "snoozed"], 
      default: "open" 
    },
    
    // --- ASSIGNMENT (For Teams) ---
    // If you add team members later, you can assign chats to specific agents
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // --- TAGS ---
    tags: [{ type: String }], // e.g., ["urgent", "pending_payment"]
  },
  { timestamps: true }
);

// Compound index to ensure one conversation per customer per platform
conversationSchema.index({ userId: 1, customerId: 1, platform: 1 }, { unique: true });

// Index for sorting the inbox (Show newest chats first)
conversationSchema.index({ userId: 1, "lastMessage.timestamp": -1 });

module.exports = mongoose.model("Conversation", conversationSchema);