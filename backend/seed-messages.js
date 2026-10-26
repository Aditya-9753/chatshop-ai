const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const User = require("./src/models/User.model");
const Customer = require("./src/models/Customer.model");
const Message = require("./src/models/Message.model");
const Conversation = require("./src/models/Conversation.model");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Returns [doc, created]: the existing doc matching `keys`, or a newly created one.
// Never updates or deletes anything, so the script is safe to re-run.
const findOrCreate = async (Model, keys, data) => {
  const filter = Object.fromEntries(keys.map((k) => [k, data[k]]));
  const existing = await Model.findOne(filter);
  if (existing) return [existing, false];
  return [await Model.create(data), true];
};

// Seed messages for Raj Kumar account
const seedMessages = async () => {
  try {
    console.log("🌱 Starting to seed messages for Raj Kumar...");

    // Find Raj Kumar user
    const rajKumar = await User.findOne({ email: "raj@example.com" });
    if (!rajKumar) {
      console.error("❌ Raj Kumar user not found. Please run seed.js first.");
      process.exit(1);
    }

    console.log(`✅ Found Raj Kumar: ${rajKumar.name} (${rajKumar._id})`);

    // Nothing is deleted: existing records are kept and only missing ones are added.

    // Create test customers with different platforms
    console.log("👥 Creating test customers...");

    const customerData = [
      {
        name: "Arjun Mehta",
        phone: "+91 98765 44444",
        email: "arjun@customer.com",
        platform: "whatsapp",
        userId: rajKumar._id,
        tags: ["VIP", "Regular Customer"],
        notes: "Prefers evening delivery",
        lastMessageDate: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      },
      {
        name: "Sneha Kapoor",
        phone: "+91 98765 55555",
        email: "sneha@customer.com",
        platform: "instagram",
        userId: rajKumar._id,
        tags: ["New Customer"],
        notes: "Interested in bulk orders",
        lastMessageDate: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      },
      {
        name: "Vikram Singh",
        phone: "+91 98765 66666",
        email: "vikram@customer.com",
        platform: "whatsapp",
        userId: rajKumar._id,
        tags: ["Wholesale"],
        notes: "Business customer",
        lastMessageDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      },
      {
        name: "Pooja Reddy",
        phone: "+91 98765 77777",
        email: "pooja@customer.com",
        platform: "facebook",
        userId: rajKumar._id,
        tags: ["Retail"],
        lastMessageDate: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      },
      {
        name: "Rahul Verma",
        phone: "+91 98765 88888",
        email: "rahul@customer.com",
        platform: "whatsapp",
        userId: rajKumar._id,
        tags: ["Premium"],
        lastMessageDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
    ];

    const customers = [];
    for (const data of customerData) {
      const [customer] = await findOrCreate(Customer, ["userId", "name", "phone"], data);
      customers.push(customer);
    }

    console.log(`✅ ${customers.length} test customers ready`);

    // Create conversations (existing ones are kept, and get no new messages)
    console.log("💬 Creating conversations...");
    const conversations = [];
    const newConversationIds = new Set();

    for (const customer of customers) {
      const [conversation, isNew] = await findOrCreate(Conversation, ["userId", "customerId", "platform"], {
        userId: rajKumar._id,
        customerId: customer._id,
        platform: customer.platform,
        status: "open",
        lastMessage: {
          content: "Sample message",
          timestamp: customer.lastMessageDate,
          direction: "incoming",
        },
        unreadCount: Math.floor(Math.random() * 3), // Random unread count 0-2
      });
      conversations.push(conversation);
      if (isNew) newConversationIds.add(conversation._id.toString());
    }

    console.log(
      `✅ ${conversations.length} conversations ready (${newConversationIds.size} new)`,
    );

    // Create diverse messages for each customer
    console.log("📨 Creating test messages...");
    const allMessages = [];

    // Customer 1: Arjun Mehta - Recent conversation with text and images
    const arjunConv = conversations[0];
    const arjunMessages = [
      {
        userId: rajKumar._id,
        customerId: customers[0]._id,
        conversationId: arjunConv._id,
        platform: "whatsapp",
        direction: "incoming",
        type: "text",
        content: {
          text: "Hi! Do you have the blue shirt in size L?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
      {
        userId: rajKumar._id,
        customerId: customers[0]._id,
        conversationId: arjunConv._id,
        platform: "whatsapp",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Hello Arjun! Yes, we have the blue shirt in size L. Would you like to order it?",
        },
        status: "read",
        isRead: true,
        readAt: new Date(Date.now() - 58 * 60 * 1000),
        createdAt: new Date(Date.now() - 59 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[0]._id,
        conversationId: arjunConv._id,
        platform: "whatsapp",
        direction: "incoming",
        type: "text",
        content: {
          text: "Yes please! Can you show me a picture?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 55 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[0]._id,
        conversationId: arjunConv._id,
        platform: "whatsapp",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Sure! Here's the product image. Price is ₹799 with free shipping.",
        },
        status: "read",
        isRead: true,
        readAt: new Date(Date.now() - 50 * 60 * 1000),
        createdAt: new Date(Date.now() - 52 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[0]._id,
        conversationId: arjunConv._id,
        platform: "whatsapp",
        direction: "incoming",
        type: "text",
        content: {
          text: "Perfect! I'll take it. Can you deliver by evening?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[0]._id,
        conversationId: arjunConv._id,
        platform: "whatsapp",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Absolutely! We can deliver by 6 PM today. Let me create your order.",
        },
        status: "sent",
        createdAt: new Date(Date.now() - 40 * 60 * 1000),
      },
    ];

    // Customer 2: Sneha Kapoor - Instagram with bulk inquiry
    const snehaConv = conversations[1];
    const snehaMessages = [
      {
        userId: rajKumar._id,
        customerId: customers[1]._id,
        conversationId: snehaConv._id,
        platform: "instagram",
        direction: "incoming",
        type: "text",
        content: {
          text: "Hey! I saw your posts. Do you do wholesale?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[1]._id,
        conversationId: snehaConv._id,
        platform: "instagram",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Hi Sneha! Yes, we do wholesale orders. Minimum order is 50 pieces. What are you looking for?",
        },
        status: "read",
        isRead: true,
        readAt: new Date(Date.now() - 2.8 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2.9 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[1]._id,
        conversationId: snehaConv._id,
        platform: "instagram",
        direction: "incoming",
        type: "text",
        content: {
          text: "I need 100 t-shirts, mixed colors and sizes. What's your best price?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[1]._id,
        conversationId: snehaConv._id,
        platform: "instagram",
        direction: "outgoing",
        type: "text",
        content: {
          text: "For 100 pieces, I can offer ₹350 per piece. That includes GST. Shipping will be charged based on location.",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 2.3 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[1]._id,
        conversationId: snehaConv._id,
        platform: "instagram",
        direction: "incoming",
        type: "text",
        content: {
          text: "That sounds good! Can we schedule a call tomorrow to discuss details?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ];

    // Customer 3: Vikram Singh - Business inquiry with edited message
    const vikramConv = conversations[2];
    const vikramMessages = [
      {
        userId: rajKumar._id,
        customerId: customers[2]._id,
        conversationId: vikramConv._id,
        platform: "whatsapp",
        direction: "incoming",
        type: "text",
        content: {
          text: "Good morning! I run a retail store. Looking for regular supply.",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[2]._id,
        conversationId: vikramConv._id,
        platform: "whatsapp",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Good morning Vikram! We'd love to work with you. What's your monthly requirement?",
        },
        status: "read",
        isRead: true,
        readAt: new Date(Date.now() - 5.8 * 60 * 60 * 1000),
        isEdited: true,
        editHistory: [
          {
            previousContent: "Good morning! We'd love to work with you.",
            editedAt: new Date(Date.now() - 5.9 * 60 * 60 * 1000),
          },
        ],
        createdAt: new Date(Date.now() - 5.9 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[2]._id,
        conversationId: vikramConv._id,
        platform: "whatsapp",
        direction: "incoming",
        type: "text",
        content: {
          text: "Around 200-300 units per month. Need competitive pricing and credit terms.",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 5.5 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[2]._id,
        conversationId: vikramConv._id,
        platform: "whatsapp",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Great volume! We can offer:\n• 30% discount on wholesale\n• 30-day credit terms\n• Free shipping\n• Dedicated account manager\n\nShall I send you our catalogue?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 5.2 * 60 * 60 * 1000),
      },
    ];

    // Customer 4: Pooja Reddy - Facebook with product inquiry
    const poojaConv = conversations[3];
    const poojaMessages = [
      {
        userId: rajKumar._id,
        customerId: customers[3]._id,
        conversationId: poojaConv._id,
        platform: "facebook",
        direction: "incoming",
        type: "text",
        content: {
          text: "Hi! I saw your ad. Do you have formal shirts for women?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[3]._id,
        conversationId: poojaConv._id,
        platform: "facebook",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Hello Pooja! Yes, we have a great collection of formal shirts for women. What size are you looking for?",
        },
        status: "read",
        isRead: true,
        readAt: new Date(Date.now() - 11.8 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 11.9 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[3]._id,
        conversationId: poojaConv._id,
        platform: "facebook",
        direction: "incoming",
        type: "text",
        content: {
          text: "I need size M. What colors do you have?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 11.5 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[3]._id,
        conversationId: poojaConv._id,
        platform: "facebook",
        direction: "outgoing",
        type: "text",
        content: {
          text: "We have White, Black, Navy Blue, and Light Pink in size M. All priced at ₹699 each. Would you like to see pictures?",
        },
        status: "sent",
        createdAt: new Date(Date.now() - 11.2 * 60 * 60 * 1000),
      },
    ];

    // Customer 5: Rahul Verma - Premium customer with order follow-up
    const rahulConv = conversations[4];
    const rahulMessages = [
      {
        userId: rajKumar._id,
        customerId: customers[4]._id,
        conversationId: rahulConv._id,
        platform: "whatsapp",
        direction: "incoming",
        type: "text",
        content: {
          text: "Hello! I placed an order yesterday. Can you check the status?",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[4]._id,
        conversationId: rahulConv._id,
        platform: "whatsapp",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Hi Rahul! Let me check your order status... One moment please.",
        },
        status: "read",
        isRead: true,
        readAt: new Date(Date.now() - 23.9 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 23.95 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[4]._id,
        conversationId: rahulConv._id,
        platform: "whatsapp",
        direction: "outgoing",
        type: "text",
        content: {
          text: "✅ Your order #ORD12345 is packed and out for delivery!\n\nTracker: https://track.example.com/12345\n\nExpected delivery: Today by 6 PM\n\nThank you for your patience! 😊",
        },
        status: "read",
        isRead: true,
        readAt: new Date(Date.now() - 23.8 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 23.85 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[4]._id,
        conversationId: rahulConv._id,
        platform: "whatsapp",
        direction: "incoming",
        type: "text",
        content: {
          text: "Perfect! Thanks for the quick update. You guys are amazing! 🙌",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 23.5 * 60 * 60 * 1000),
      },
      {
        userId: rajKumar._id,
        customerId: customers[4]._id,
        conversationId: rahulConv._id,
        platform: "whatsapp",
        direction: "outgoing",
        type: "text",
        content: {
          text: "Thank you for your kind words! We're always here to help. Enjoy your order! 🎉",
        },
        status: "delivered",
        createdAt: new Date(Date.now() - 23.3 * 60 * 60 * 1000),
      },
    ];

    // Combine all messages
    allMessages.push(
      ...arjunMessages,
      ...snehaMessages,
      ...vikramMessages,
      ...poojaMessages,
      ...rahulMessages,
    );

    // Insert messages only for newly created conversations, to avoid duplicates
    const newMessages = allMessages.filter((msg) =>
      newConversationIds.has(msg.conversationId.toString()),
    );
    if (newMessages.length) await Message.insertMany(newMessages);
    console.log(
      `✅ Added ${newMessages.length} test messages (${allMessages.length - newMessages.length} skipped, already existed)`,
    );

    // Update last message only on the newly created conversations
    console.log("🔄 Updating conversation last messages...");
    for (let i = 0; i < conversations.length; i++) {
      if (!newConversationIds.has(conversations[i]._id.toString())) continue;
      const conversationMessages = allMessages.filter(
        (msg) =>
          msg.conversationId.toString() === conversations[i]._id.toString(),
      );
      const lastMsg = conversationMessages[conversationMessages.length - 1];

      if (lastMsg) {
        await Conversation.findByIdAndUpdate(conversations[i]._id, {
          lastMessage: {
            content: lastMsg.content.text || "Media message",
            timestamp: lastMsg.createdAt,
            direction: lastMsg.direction,
            type: lastMsg.type,
          },
          unreadCount:
            lastMsg.direction === "incoming" && !lastMsg.isRead
              ? 1
              : conversations[i].unreadCount,
        });
      }
    }

    console.log("✅ Updated conversation last messages");

    console.log("\n🎉 Message seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   • User: ${rajKumar.name}`);
    console.log(`   • Customers: ${customers.length}`);
    console.log(`   • Conversations: ${conversations.length}`);
    console.log(`   • Messages added: ${newMessages.length}`);
    console.log(
      `   • Platforms: WhatsApp (${customers.filter((c) => c.platform === "whatsapp").length}), Instagram (${customers.filter((c) => c.platform === "instagram").length}), Facebook (${customers.filter((c) => c.platform === "facebook").length})`,
    );
    console.log("\n✅ You can now login as:");
    console.log("   Email: raj@example.com");
    console.log("   Password: Test@12345");
    console.log("\n💬 Test the following features:");
    console.log(
      "   • Multi-platform conversations (WhatsApp, Instagram, Facebook)",
    );
    console.log("   • Read receipts (check marks)");
    console.log("   • Edited messages");
    console.log("   • Different message types");
    console.log("   • Unread message counts");
    console.log("   • Conversation filtering by platform");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding messages:", error);
    process.exit(1);
  }
};

// Run the seed function
seedMessages();
