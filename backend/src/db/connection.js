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

    const adminExists = await User.findOne({ role: "admin" });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || "Admin@12345",
        10
      );

      await User.create({
        name: "Super Admin",
        email: process.env.ADMIN_EMAIL || "admin@chatshopai.com",
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        phone: "+919999999999",
      });

      console.log("✅ Default admin user created");
    }
  } catch (error) {
    console.log("ℹ️  Admin creation skipped:", error.message);
  }
};

module.exports = connectDB;
