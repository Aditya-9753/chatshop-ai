"use strict";
const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["API", "DATABASE", "AUTH", "FRONTEND", "AI", "INTEGRATION", "BUSINESS_LOGIC", "INFRA"],
    },
    errorCode: { type: String, default: null },
    severity: {
      type: String,
      required: true,
      enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      default: "LOW",
    },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "ESCALATED"],
      default: "OPEN",
    },
    fingerprint: { type: String, required: true },
    module: { type: String, default: null },
    endpoint: { type: String, default: null },
    requestId: { type: String, default: null },
    occurrenceCount: { type: Number, default: 1 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
  },
  { timestamps: true, collection: "system_incidents" }
);

incidentSchema.index({ status: 1, severity: 1, lastSeenAt: -1 });
incidentSchema.index({ shopId: 1, status: 1, lastSeenAt: -1 });
incidentSchema.index({ fingerprint: 1, status: 1 });
incidentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Incident", incidentSchema);
