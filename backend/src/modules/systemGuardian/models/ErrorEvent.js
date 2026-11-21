"use strict";
const mongoose = require("mongoose");

const errorEventSchema = new mongoose.Schema(
  {
    incidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: true,
    },
    requestId: { type: String, default: null },
    safeMessage: { type: String, default: null },
    stackHash: { type: String, default: null },
    route: { type: String, default: null },
    method: { type: String, default: null },
    statusCode: { type: Number, default: null },
    durationMs: { type: Number, default: null },
    environment: { type: String, default: process.env.NODE_ENV || "development" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "system_error_events" }
);

errorEventSchema.index({ incidentId: 1, createdAt: -1 });
errorEventSchema.index({ requestId: 1 });

module.exports = mongoose.model("ErrorEvent", errorEventSchema);
