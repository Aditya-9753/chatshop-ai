const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import models
const User = require("./src/models/User.model");
const Customer = require("./src/models/Customer.model");
const Product = require("./src/models/Product.model");
const Order = require("./src/models/Order.model");
const Message = require("./src/models/Message.model");
const Conversation = require("./src/models/Conversation.model"); // ✅ NEW IMPORT

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

const findOrCreateMany = async (Model, keys, list) => {
  const docs = [];
  let created = 0;
  for (const data of list) {
    const [doc, isNew] = await findOrCreate(Model, keys, data);
    docs.push(doc);
    if (isNew) created++;
  }
  console.log(`   ${Model.modelName}: ${created} added, ${docs.length - created} already existed`);
  return docs;
};

// Test data
const seedData = async () => {
  try {
    console.log("🌱 Starting to seed database...");

    // Nothing is deleted: existing records are kept and only missing ones are added.

    // 1. Create Premium Users
    console.log("👥 Creating premium users...");

    const hashedPassword = await bcrypt.hash("Test@12345", 10);

    const [premiumUser1] = await findOrCreate(User, ["email"], {
      name: "Raj Kumar",
      email: "raj@example.com",
      password: hashedPassword,
      phone: "+91 98765 11111",
      role: "user",
      isVerified: true,
      subscription: {
        plan: "premium",
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });

    const [premiumUser2] = await findOrCreate(User, ["email"], {
      name: "Priya Sharma",
      email: "priya@example.com",
      password: hashedPassword,
      phone: "+91 98765 22222",
      role: "user",
      isVerified: true,
      subscription: {
        plan: "premium",
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    const [starterUser] = await findOrCreate(User, ["email"], {
      name: "Amit Patel",
      email: "amit@example.com",
      password: hashedPassword,
      phone: "+91 98765 33333",
      role: "user",
      isVerified: true,
      subscription: {
        plan: "starter",
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    const [businessUser] = await findOrCreate(User, ["email"], {
      name: "Neha Shah",
      email: "neha@example.com",
      password: hashedPassword,
      phone: "+91 98765 99999",
      role: "user",
      isVerified: true,
      subscription: {
        plan: "business",
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      },
    });

    console.log("✅ 4 test users ready (2 premium, 1 business, 1 starter)");

    // 2. Create Customers for premium user 1
    console.log("👤 Creating customers...");

    const customers = await findOrCreateMany(Customer, ["userId", "name", "phone"], [
      {
        name: "Rahul Verma",
        phone: "+91 98765 44444",
        email: "rahul@gmail.com",
        platform: "whatsapp",
        userId: premiumUser1._id,
        totalOrders: 5,
        totalSpent: 12500,
      },
      {
        name: "Sneha Reddy",
        phone: "+91 98765 55555",
        email: "sneha@gmail.com",
        platform: "whatsapp",
        userId: premiumUser1._id,
        totalOrders: 3,
        totalSpent: 8200,
      },
      {
        name: "Vikas Singh",
        phone: "+91 98765 66666",
        platform: "instagram",
        userId: premiumUser1._id,
        totalOrders: 8,
        totalSpent: 25000,
      },
      {
        name: "Anjali Gupta",
        phone: "+91 98765 77777",
        email: "anjali@gmail.com",
        platform: "whatsapp",
        userId: premiumUser1._id,
        totalOrders: 2,
        totalSpent: 5400,
      },
      {
        name: "Karan Mehta",
        phone: "+91 98765 88888",
        platform: "instagram",
        userId: premiumUser1._id,
        totalOrders: 6,
        totalSpent: 15600,
      },
    ]);

    console.log(`✅ Created ${customers.length} customers`);

    // 3. Create Products
    console.log("📦 Creating products...");

    const products = await findOrCreateMany(Product, ["userId", "name"], [
      {
        name: "MacBook Pro M3",
        description: "Latest MacBook Pro with M3 chip, 16GB RAM",
        price: 189900,
        stock: 15,
        category: "Electronics",
        userId: premiumUser1._id,
      },
      {
        name: "iPhone 15 Pro",
        description: "iPhone 15 Pro 256GB, Titanium",
        price: 134900,
        stock: 25,
        category: "Electronics",
        userId: premiumUser1._id,
      },
      {
        name: "Samsung Galaxy S24",
        description: "Samsung Galaxy S24 Ultra 512GB",
        price: 124900,
        stock: 20,
        category: "Electronics",
        userId: premiumUser1._id,
      },
      {
        name: "Sony WH-1000XM5",
        description: "Premium Noise Cancelling Headphones",
        price: 29990,
        stock: 40,
        category: "Electronics",
        userId: premiumUser1._id,
      },
      {
        name: "Nike Air Jordan",
        description: "Classic Air Jordan Sneakers",
        price: 12999,
        stock: 50,
        category: "Footwear",
        userId: premiumUser1._id,
      },
      {
        name: "Levi's Denim Jacket",
        description: "Premium Denim Jacket",
        price: 5999,
        stock: 30,
        category: "Clothing",
        userId: premiumUser1._id,
      },
      {
        name: "Ray-Ban Sunglasses",
        description: "Classic Aviator Sunglasses",
        price: 8999,
        stock: 35,
        category: "Accessories",
        userId: premiumUser1._id,
      },
      {
        name: "Titan Watch",
        description: "Elegant Analog Watch",
        price: 6499,
        stock: 25,
        category: "Accessories",
        userId: premiumUser1._id,
      },
    ]);

    console.log(`✅ Created ${products.length} products`);

    // 4. Create Orders
    console.log("🛒 Creating orders...");

    // orderNumber changes every run, so match an existing order by customer + total instead
    const orders = await findOrCreateMany(Order, ["userId", "customerId", "total"], [
      {
        orderNumber: `ORD-${Date.now()}-1`,
        customerId: customers[0]._id,
        userId: premiumUser1._id,
        platform: "whatsapp",
        items: [
          {
            productId: products[1]._id,
            name: products[1].name,
            quantity: 1,
            price: products[1].price,
            total: products[1].price,
          },
        ],
        subtotal: products[1].price,
        total: products[1].price,
        status: "delivered",
        paymentStatus: "paid",
      },
      {
        orderNumber: `ORD-${Date.now()}-2`,
        customerId: customers[1]._id,
        userId: premiumUser1._id,
        platform: "whatsapp",
        items: [
          {
            productId: products[3]._id,
            name: products[3].name,
            quantity: 2,
            price: products[3].price,
            total: products[3].price * 2,
          },
        ],
        subtotal: products[3].price * 2,
        total: products[3].price * 2,
        status: "shipped",
        paymentStatus: "paid",
      },
      {
        orderNumber: `ORD-${Date.now()}-3`,
        customerId: customers[2]._id,
        userId: premiumUser1._id,
        platform: "instagram",
        items: [
          {
            productId: products[0]._id,
            name: products[0].name,
            quantity: 1,
            price: products[0].price,
            total: products[0].price,
          },
          {
            productId: products[3]._id,
            name: products[3].name,
            quantity: 1,
            price: products[3].price,
            total: products[3].price,
          },
        ],
        subtotal: products[0].price + products[3].price,
        total: products[0].price + products[3].price,
        status: "processing",
        paymentStatus: "paid",
      },
      {
        orderNumber: `ORD-${Date.now()}-4`,
        customerId: customers[3]._id,
        userId: premiumUser1._id,
        platform: "whatsapp",
        items: [
          {
            productId: products[4]._id,
            name: products[4].name,
            quantity: 2,
            price: products[4].price,
            total: products[4].price * 2,
          },
        ],
        subtotal: products[4].price * 2,
        total: products[4].price * 2,
        status: "pending",
        paymentStatus: "pending",
      },
      {
        orderNumber: `ORD-${Date.now()}-5`,
        customerId: customers[4]._id,
        userId: premiumUser1._id,
        platform: "instagram",
        items: [
          {
            productId: products[5]._id,
            name: products[5].name,
            quantity: 1,
            price: products[5].price,
            total: products[5].price,
          },
          {
            productId: products[6]._id,
            name: products[6].name,
            quantity: 1,
            price: products[6].price,
            total: products[6].price,
          },
        ],
        subtotal: products[5].price + products[6].price,
        total: products[5].price + products[6].price,
        status: "delivered",
        paymentStatus: "paid",
      },
    ]);

    console.log(`✅ Created ${orders.length} orders`);

    // 5. Create Conversations & Messages
    console.log("💬 Creating conversations & messages...");
    const now = new Date();

    // ----------------------------------------------------
    // CONVERSATION 1: Rahul Verma (WhatsApp)
    // ----------------------------------------------------
    // ✅ NEW: Create the Conversation wrapper first
    const [conv1, conv1New] = await findOrCreate(Conversation, ["userId", "customerId", "platform"], {
        userId: premiumUser1._id,
        customerId: customers[0]._id,
        platform: "whatsapp",
        unreadCount: 0,
        status: "open",
        lastMessage: {
            content: "Yes! Order confirmed. We'll deliver within 2 hours. 🚀",
            type: "text",
            timestamp: new Date(now - 1 * 60 * 60 * 1000 + 30 * 1000)
        }
    });

    // Messages are only added for a newly created conversation, to avoid duplicates
    const messages1 = conv1New ? await Message.insertMany([
      {
        conversationId: conv1._id, // ✅ NEW: Linked to Conversation
        customerId: customers[0]._id,
        userId: premiumUser1._id,
        content: { text: "Hi, I want to order iPhone 15 Pro" },
        direction: "incoming",
        platform: "whatsapp",
        createdAt: new Date(now - 2 * 60 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv1._id,
        customerId: customers[0]._id,
        userId: premiumUser1._id,
        content: { text: "Sure! We have it in stock. Which color would you like?" },
        direction: "outgoing",
        platform: "whatsapp",
        createdAt: new Date(now - 2 * 60 * 60 * 1000 + 2 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv1._id,
        customerId: customers[0]._id,
        userId: premiumUser1._id,
        content: { text: "I'd like the Natural Titanium color. What's the price?" },
        direction: "incoming",
        platform: "whatsapp",
        createdAt: new Date(now - 1.5 * 60 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv1._id,
        customerId: customers[0]._id,
        userId: premiumUser1._id,
        content: { text: "₹1,34,900 for 256GB. Would you like to place the order?" },
        direction: "outgoing",
        platform: "whatsapp",
        createdAt: new Date(now - 1.5 * 60 * 60 * 1000 + 1 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv1._id,
        customerId: customers[0]._id,
        userId: premiumUser1._id,
        content: { text: "Yes, please! Can you deliver today?" },
        direction: "incoming",
        platform: "whatsapp",
        createdAt: new Date(now - 1 * 60 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv1._id,
        customerId: customers[0]._id,
        userId: premiumUser1._id,
        content: { text: "Yes! Order confirmed. We'll deliver within 2 hours. 🚀" },
        direction: "outgoing",
        platform: "whatsapp",
        createdAt: new Date(now - 1 * 60 * 60 * 1000 + 30 * 1000),
        status: "delivered",
      },
    ]) : [];

    // ----------------------------------------------------
    // CONVERSATION 2: Sneha Reddy (WhatsApp)
    // ----------------------------------------------------
    const [conv2, conv2New] = await findOrCreate(Conversation, ["userId", "customerId", "platform"], {
        userId: premiumUser1._id,
        customerId: customers[1]._id,
        platform: "whatsapp",
        unreadCount: 0,
        status: "open",
        lastMessage: {
            content: "Yes! Tracking ID: TRK123456. You can track on our website.",
            type: "text",
            timestamp: new Date(now - 23 * 60 * 60 * 1000 + 2 * 60 * 1000)
        }
    });

    // Messages are only added for a newly created conversation, to avoid duplicates
    const messages2 = conv2New ? await Message.insertMany([
      {
        conversationId: conv2._id,
        customerId: customers[1]._id,
        userId: premiumUser1._id,
        content: { text: "When will my order arrive?" },
        direction: "incoming",
        platform: "whatsapp",
        createdAt: new Date(now - 24 * 60 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv2._id,
        customerId: customers[1]._id,
        userId: premiumUser1._id,
        content: { text: "Your order has been shipped and will arrive in 2-3 days!" },
        direction: "outgoing",
        platform: "whatsapp",
        createdAt: new Date(now - 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
        status: "read",
        // ✅ NEW: Add 'isEdited' example
        isEdited: true,
        editHistory: [{ previousContent: "It will arrive tomorrow", editedAt: new Date(now - 24 * 60 * 60 * 1000 + 6 * 60 * 1000) }]
      },
      {
        conversationId: conv2._id,
        customerId: customers[1]._id,
        userId: premiumUser1._id,
        content: { text: "Great! Can I track my order?" },
        direction: "incoming",
        platform: "whatsapp",
        createdAt: new Date(now - 23 * 60 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv2._id,
        customerId: customers[1]._id,
        userId: premiumUser1._id,
        content: { text: "Yes! Tracking ID: TRK123456. You can track on our website." },
        direction: "outgoing",
        platform: "whatsapp",
        createdAt: new Date(now - 23 * 60 * 60 * 1000 + 2 * 60 * 1000),
        status: "delivered",
      },
    ]) : [];

    // ----------------------------------------------------
    // CONVERSATION 3: Vikas Singh (Instagram)
    // ----------------------------------------------------
    const [conv3, conv3New] = await findOrCreate(Conversation, ["userId", "customerId", "platform"], {
        userId: premiumUser1._id,
        customerId: customers[2]._id,
        platform: "instagram",
        unreadCount: 1, // ✅ NEW: User hasn't read the last message
        status: "open",
        lastMessage: {
            content: "Yes, silver is available! Shall I create the order?",
            type: "text",
            timestamp: new Date(now - 18 * 60 * 1000)
        }
    });

    // Messages are only added for a newly created conversation, to avoid duplicates
    const messages3 = conv3New ? await Message.insertMany([
      {
        conversationId: conv3._id,
        customerId: customers[2]._id,
        userId: premiumUser1._id,
        content: { text: "Do you have MacBook in stock?" },
        direction: "incoming",
        platform: "instagram",
        createdAt: new Date(now - 30 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv3._id,
        customerId: customers[2]._id,
        userId: premiumUser1._id,
        content: { text: "Yes! We have MacBook Pro M3 available. Would you like to place an order?" },
        direction: "outgoing",
        platform: "instagram",
        createdAt: new Date(now - 28 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv3._id,
        customerId: customers[2]._id,
        userId: premiumUser1._id,
        content: { text: "How much?" },
        direction: "incoming",
        platform: "instagram",
        createdAt: new Date(now - 25 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv3._id,
        customerId: customers[2]._id,
        userId: premiumUser1._id,
        content: { text: "₹1,89,900 for 16GB RAM, 512GB SSD version. Best price guaranteed! 💻" },
        direction: "outgoing",
        platform: "instagram",
        createdAt: new Date(now - 24 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv3._id,
        customerId: customers[2]._id,
        userId: premiumUser1._id,
        content: { text: "Awesome! I'll take it. Do you have silver color?" },
        direction: "incoming",
        platform: "instagram",
        createdAt: new Date(now - 20 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv3._id,
        customerId: customers[2]._id,
        userId: premiumUser1._id,
        content: { text: "Yes, silver is available! Shall I create the order?" },
        direction: "outgoing",
        platform: "instagram",
        createdAt: new Date(now - 18 * 60 * 1000),
        status: "delivered", // Not read yet
      },
    ]) : [];

    // ----------------------------------------------------
    // CONVERSATION 4: Anjali Gupta (WhatsApp)
    // ----------------------------------------------------
    const [conv4, conv4New] = await findOrCreate(Conversation, ["userId", "customerId", "platform"], {
        userId: premiumUser1._id,
        customerId: customers[3]._id,
        platform: "whatsapp",
        unreadCount: 0,
        status: "open",
        lastMessage: {
            content: "Yes, Cash on Delivery available! Price is ₹12,999. 👟",
            type: "text",
            timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000)
        }
    });

    // Create a parent message first to demonstrate 'replyTo'
    const parentMsg = conv4New ? await Message.create({
        conversationId: conv4._id,
        customerId: customers[3]._id,
        userId: premiumUser1._id,
        content: { text: "Great choice! We have all sizes available. What's your size?" },
        direction: "outgoing",
        platform: "whatsapp",
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000),
        status: "read"
    }) : null;

    // Messages are only added for a newly created conversation, to avoid duplicates
    const messages4 = conv4New ? await Message.insertMany([
      {
        conversationId: conv4._id,
        customerId: customers[3]._id,
        userId: premiumUser1._id,
        content: { text: "Hello! I'm interested in Nike Air Jordan" },
        direction: "incoming",
        platform: "whatsapp",
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        status: "read",
      },
      // Note: parentMsg is inserted separately above
      {
        conversationId: conv4._id,
        customerId: customers[3]._id,
        userId: premiumUser1._id,
        content: { text: "Size 9. Do you offer COD?" },
        direction: "incoming",
        platform: "whatsapp",
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
        status: "read",
        replyTo: parentMsg._id // ✅ NEW: Linked Reply
      },
      {
        conversationId: conv4._id,
        customerId: customers[3]._id,
        userId: premiumUser1._id,
        content: { text: "Yes, Cash on Delivery available! Price is ₹12,999. 👟" },
        direction: "outgoing",
        platform: "whatsapp",
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000),
        status: "read",
      },
    ]) : [];

    // ----------------------------------------------------
    // CONVERSATION 5: Karan Mehta (Instagram)
    // ----------------------------------------------------
    const [conv5, conv5New] = await findOrCreate(Conversation, ["userId", "customerId", "platform"], {
        userId: premiumUser1._id,
        customerId: customers[4]._id,
        platform: "instagram",
        unreadCount: 0,
        status: "archived", // ✅ NEW: Archived Chat
        lastMessage: {
            content: "Perfect! ₹8,999 with 1 year warranty. Free home delivery! 😎",
            type: "text",
            timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000 + 17 * 60 * 1000)
        }
    });

    // Messages are only added for a newly created conversation, to avoid duplicates
    const messages5 = conv5New ? await Message.insertMany([
      {
        conversationId: conv5._id,
        customerId: customers[4]._id,
        userId: premiumUser1._id,
        content: { text: "Hi! Saw your sunglasses collection on Instagram" },
        direction: "incoming",
        platform: "instagram",
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv5._id,
        customerId: customers[4]._id,
        userId: premiumUser1._id,
        content: { text: "Oops, sent wrong image." },
        direction: "outgoing",
        platform: "instagram",
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 1000),
        status: "read",
        // ✅ NEW: Soft Deleted Message
        isDeleted: true,
        deletedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 1000),
        deletedBy: "user"
      },
      {
        conversationId: conv5._id,
        customerId: customers[4]._id,
        userId: premiumUser1._id,
        content: { text: "Thank you! We have Ray-Ban, Oakley, and more. What style are you looking for?" },
        direction: "outgoing",
        platform: "instagram",
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv5._id,
        customerId: customers[4]._id,
        userId: premiumUser1._id,
        content: { text: "Ray-Ban Aviator. Classic style." },
        direction: "incoming",
        platform: "instagram",
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
        status: "read",
      },
      {
        conversationId: conv5._id,
        customerId: customers[4]._id,
        userId: premiumUser1._id,
        content: { text: "Perfect! ₹8,999 with 1 year warranty. Free home delivery! 😎" },
        direction: "outgoing",
        platform: "instagram",
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 17 * 60 * 1000),
        status: "read",
      },
    ]) : [];

    console.log(`✅ Conversations & messages ready (existing ones were kept as-is)`);

    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📝 Test Accounts:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n1️⃣  Premium User 1:");
    console.log("   Email: raj@example.com");
    console.log("   Password: Test@12345");
    console.log("   Plan: Premium (1 year)");
    console.log("   Features: All features enabled");

    console.log("\n2️⃣  Premium User 2:");
    console.log("   Email: priya@example.com");
    console.log("   Password: Test@12345");
    console.log("   Plan: Premium (1 year)");
    console.log("   Features: All features enabled");

    console.log("\n3️⃣  Business User:");
    console.log("   Email: neha@example.com");
    console.log("   Password: Test@12345");
    console.log("   Plan: Business (90 days)");

    console.log("\n4️⃣  Starter User:");
    console.log("   Email: amit@example.com");
    console.log("   Password: Test@12345");
    console.log("   Plan: Starter (30 days)");

    console.log("\n5️⃣  Admin:");
    console.log("   Email: admin@chatshopai.com");
    console.log("   Password: Admin@123456");
    console.log("   Role: Admin");

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📊 Data Summary:");
    console.log(`   • Users: 4 (2 premium + 1 business + 1 starter)`);
    console.log(`   • Customers: ${customers.length}`);
    console.log(`   • Products: ${products.length}`);
    console.log(`   • Orders: ${orders.length}`);
    console.log(`   • Conversations: 5 (New Industry Feature)`);
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

seedData();