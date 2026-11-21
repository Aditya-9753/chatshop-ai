"use strict";
const mongoose = require("mongoose");

const healthCheckSchema = new mongoose.Schema(
  {
    serviceName: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ["healthy", "degraded", "unhealthy"],
      default: "healthy",
    },
    latencyMs: { type: Number, default: null },
    checkedAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: false, collection: "system_health_checks" }
);

healthCheckSchema.index({ serviceName: 1, checkedAt: -1 });

module.exports = mongoose.model("HealthCheck", healthCheckSchema);
