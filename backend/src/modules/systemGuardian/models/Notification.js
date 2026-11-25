"use strict";
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },
    recipientRole: { type: String, default: "admin" },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    eventType: { type: String, required: true }, // e.g. "incident:new", "incident:updated"
    title: { type: String, required: true },
    severity: {
      type: String,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      default: "LOW",
    },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "system_notifications" }
);

notificationSchema.index({ recipientRole: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, readAt: 1 });

const GuardianNotification = mongoose.models["GuardianNotification"] || mongoose.model("GuardianNotification", notificationSchema);
module.exports = { GuardianNotification };
