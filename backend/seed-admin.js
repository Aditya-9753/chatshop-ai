require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./src/models/User.model");

const seedAdmin = async () => {
  try {
    console.log("📡 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Admin credentials
    const adminEmail = "admin@chatshopai.com";
    const adminPassword = "Admin@123456";

    // Check if admin already exists
    let admin = await User.findOne({ email: adminEmail });

    if (admin) {
      console.log("⚠️  Admin user already exists!");
      console.log("Updating to ensure admin role...\n");

      admin.role = "admin";
      admin.name = "Super Admin";
      admin.isVerified = true;
      admin.password = await bcrypt.hash(adminPassword, 10);
      await admin.save();

      console.log("✅ Admin user updated successfully!\n");
    } else {
      console.log("Creating new admin user...\n");

      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      admin = await User.create({
        name: "Super Admin",
        email: adminEmail,
        password: hashedPassword,
        phone: "+919999999999",
        role: "admin",
        isVerified: true,
        subscription: {
          plan: null,
          status: "inactive",
        },
      });

      console.log("✅ Admin user created successfully!\n");
    }

    console.log("═══════════════════════════════════════");
    console.log("🎉 ADMIN CREDENTIALS");
    console.log("═══════════════════════════════════════");
    console.log("Email:    ", adminEmail);
    console.log("Password: ", adminPassword);
    console.log("Role:     ", admin.role);
    console.log("═══════════════════════════════════════");
    console.log("\n🌐 Login at: http://localhost:5174/admin/login\n");

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    mongoose.connection.close();
    process.exit(1);
  }
};

seedAdmin();
