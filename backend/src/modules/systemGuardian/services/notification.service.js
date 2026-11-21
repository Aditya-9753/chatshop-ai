"use strict";
const { GuardianNotification } = require("../models/Notification");

/**
 * Persist a new notification document.
 */
async function createNotification({ incidentId, eventType, title, severity, recipientRole = "admin", recipientUserId = null }) {
  return GuardianNotification.create({
    incidentId,
    recipientRole,
    recipientUserId: recipientUserId || null,
    eventType,
    title,
    severity,
  });
}

/**
 * Paginated notifications for the Super Admin.
 */
async function getNotifications({ page = 1, limit = 20 } = {}) {
  const skip = (Number(page) - 1) * Number(limit);
  const query = { recipientRole: "admin" };
  const [notifications, total] = await Promise.all([
    GuardianNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    GuardianNotification.countDocuments(query),
  ]);
  return { notifications, total, page: Number(page), limit: Number(limit) };
}

/**
 * Mark a notification as read.
 */
async function markAsRead(notificationId) {
  return GuardianNotification.findByIdAndUpdate(
    notificationId,
    { readAt: new Date() },
    { new: true }
  );
}

module.exports = { createNotification, getNotifications, markAsRead };
