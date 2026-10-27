const mongoose = require("mongoose");

// One document holding platform-wide settings the super admin edits
const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "platform", unique: true },
    platformName: { type: String, default: "ChatShop AI", trim: true },
    supportEmail: { type: String, default: "", trim: true, lowercase: true },
    contactPhone: { type: String, default: "", trim: true },
    notifications: {
      // Master switch for every admin email below
      emailNotifications: { type: Boolean, default: true },
      // Email the admins when a new shop signs up
      newUserAlerts: { type: Boolean, default: true },
      // Send admins a copy of every broadcast
      systemUpdates: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
