const mongoose = require("mongoose");

// A message from the super admin to every shop (or to chosen shops).
// Shown as a banner in the shop dashboard and, if email is set up, emailed.
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    // Empty = every shop; otherwise only these users
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emailedCount: { type: Number, default: 0 },
    emailFailedCount: { type: Number, default: 0 },
    // queued → sending → done (emails go out after the request returns)
    emailStatus: { type: String, enum: ["none", "sending", "done"], default: "none" },
    emailSkipped: { type: Boolean, default: false },
  },
  { timestamps: true }
);

announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);
