const mongoose = require("mongoose");
const net = require("net");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host });
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => {
      resolve(false);
    });
  });
}

async function ensureLocalMongo() {
  const uri = process.env.MONGODB_URI || "";
  if (uri.includes("27018")) {
    const open = await isPortOpen(27018);
    if (!open) {
      const mongodPath = "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe";
      const dbPath = path.resolve(__dirname, "../../data/db");
      if (fs.existsSync(mongodPath)) {
        if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });
        console.log("⚡ Starting local MongoDB on port 27018 (no admin rights needed)...");
        const child = spawn(
          mongodPath,
          ["--dbpath", dbPath, "--port", "27018", "--bind_ip", "127.0.0.1", "--noauth"],
          { detached: true, stdio: "ignore" }
        );
        child.unref();

        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 500));
          if (await isPortOpen(27018)) {
            console.log("✅ Local MongoDB is running on port 27018!");
            break;
          }
        }
      }
    }
  }
}

const connectDB = async () => {
  try {
    await ensureLocalMongo();
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
