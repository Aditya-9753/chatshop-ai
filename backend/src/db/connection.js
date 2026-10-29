const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Create default admin user if not exists
    await createDefaultAdmin();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

const createDefaultAdmin = async () => {
  try {
    const User = require("../models/User.model");
    const bcrypt = require("bcryptjs");

    // The Super Admin account (Admins with their own login don't count)
    let admin = await User.findOne({ role: "admin", adminLevel: { $ne: "admin" } }).select("+adminPanel.password");

    if (!admin) {
      const hashedPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || "Admin@12345",
        10
      );

      admin = await User.create({
        name: "Super Admin",
        email: process.env.ADMIN_EMAIL || "admin@chatshopai.com",
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        phone: "+919999999999",
      });

      console.log("✅ Default admin user created");
    }

    // Second password on the same account for the limited Admin panel.
    // Set once; change it later in the Super Admin panel → Security.
    if (!admin.adminPanel?.password) {
      admin.adminPanel = {
        password: await bcrypt.hash(process.env.ADMIN_PANEL_PASSWORD || "Admin@123456", 10),
      };
      await admin.save();
      console.log("✅ Admin panel password set");
    }
  } catch (error) {
    console.log("ℹ️  Admin creation skipped:", error.message);
  }
};

module.exports = connectDB;
