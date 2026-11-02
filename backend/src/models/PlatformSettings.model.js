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
    // ChatShop AI as the supplier on the invoices it sends shops. GST is
    // charged only once a GSTIN is set; have a tax advisor check these.
    billing: {
      legalName: { type: String, default: "", trim: true },
      gstin: { type: String, default: "", trim: true, uppercase: true },
      stateCode: { type: String, default: "", trim: true },
      address: { type: String, default: "", trim: true },
      email: { type: String, default: "", trim: true, lowercase: true },
      phone: { type: String, default: "", trim: true },
      invoicePrefix: { type: String, default: "CSA", trim: true, uppercase: true },
      sac: { type: String, default: "", trim: true }, // service code printed on lines
      gstRatePct: { type: Number, default: 18 },
      pricesIncludeGst: { type: Boolean, default: false }, // plan prices are before GST
      graceDays: { type: Number, default: 3 }, // access after the end date, before the plan expires
      reminderDays: { type: Number, default: 3 }, // email this many days before the end date
      paymentTermsDays: { type: Number, default: 7 }, // due date on manual invoices
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformSettings", platformSettingsSchema);
