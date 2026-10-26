require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");

// Import User model
const User = require("./src/models/User.model");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

const createAdmin = async () => {
  try {
    console.log("\n🔐 Admin User Creation Tool\n");

    // Get admin details from user
    const name = await question("Enter admin name: ");
    const email = await question("Enter admin email: ");
    const password = await question("Enter admin password: ");
    const phone = await question("Enter admin phone: ");

    if (!name || !email || !password || !phone) {
      console.error("❌ All fields are required!");
      rl.close();
      return;
    }

    // Connect to MongoDB
    console.log("\n📡 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("\n⚠️  User with this email already exists!");
      const update = await question(
        "Do you want to update this user to admin? (yes/no): "
      );

      if (update.toLowerCase() === "yes" || update.toLowerCase() === "y") {
        existingUser.role = "admin";
        existingUser.name = name;
        existingUser.phone = phone;
        if (password) {
          existingUser.password = await bcrypt.hash(password, 10);
        }
        await existingUser.save();
        console.log("\n✅ User updated to admin successfully!");
        console.log("\nAdmin Details:");
        console.log("Name:", existingUser.name);
        console.log("Email:", existingUser.email);
        console.log("Role:", existingUser.role);
      } else {
        console.log("❌ Operation cancelled");
      }
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(password, 10);

      const adminData = {
        name,
        email,
        password: hashedPassword,
        phone,
        role: "admin",
        isVerified: true,
        subscription: {
          plan: null,
          status: "inactive",
        },
      };

      const admin = await User.create(adminData);
      console.log("\n✅ Admin user created successfully!");
      console.log("\nAdmin Details:");
      console.log("Name:", admin.name);
      console.log("Email:", admin.email);
      console.log("Role:", admin.role);
    }

    console.log(
      "\n🎉 You can now login at: http://localhost:5174/admin/login\n"
    );

    mongoose.connection.close();
    rl.close();
  } catch (error) {
    console.error("\n❌ Error creating admin:", error.message);
    mongoose.connection.close();
    rl.close();
  }
};

createAdmin();
