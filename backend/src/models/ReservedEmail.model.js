"use strict";
const mongoose = require("mongoose");

const reservedEmailSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    previousUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, default: "account_deleted" },
  },
  { timestamps: true, collection: "reserved_emails" }
);

module.exports = mongoose.model("ReservedEmail", reservedEmailSchema);
