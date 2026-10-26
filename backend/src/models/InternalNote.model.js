const mongoose = require("mongoose");

const internalNoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    note: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: String,
  },
  {
    timestamps: true,
  }
);

internalNoteSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model("InternalNote", internalNoteSchema);
