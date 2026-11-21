"use strict";
const incidentService = require("../services/incident.service");
const notificationService = require("../services/notification.service");

/** GET /api/admin/guardian/incidents */
async function listIncidents(req, res) {
  try {
    const { status, severity, category, shopId, search, from, to, page, limit } = req.query;
    const result = await incidentService.getIncidents({ status, severity, category, shopId, search, from, to, page, limit });
    const totalPages = Math.max(1, Math.ceil(result.total / (Number(limit) || 20)));
    res.json({ success: true, ...result, totalPages, pages: totalPages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/** GET /api/admin/guardian/incidents/:id */
async function getIncident(req, res) {
  try {
    const data = await incidentService.getIncidentById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Incident not found" });
    res.json({ success: true, data: data.incident, events: data.events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/** PATCH /api/admin/guardian/incidents/:id/status */
async function updateStatus(req, res) {
  try {
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });
    const incident = await incidentService.updateIncidentStatus(req.params.id, {
      status,
      note,
      actorUserId: req.user?._id,
      actorRole: req.user?.role,
    });
    res.json({ success: true, data: incident, incident });
  } catch (err) {
    if (err.message === "Incident not found") return res.status(404).json({ success: false, message: err.message });
    if (err.message.startsWith("Cannot change incident status") || err.message.includes("resolution note is required")) {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
}

/** GET /api/admin/guardian/notifications */
async function listNotifications(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await notificationService.getNotifications({ page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/** PATCH /api/admin/guardian/notifications/:id/read */
async function markNotificationRead(req, res) {
  try {
    const notification = await notificationService.markAsRead(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getIncidentEvents(req, res) {
  try {
    const data = await incidentService.getIncidentById(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: "Incident not found" });
    res.json({ success: true, data: data.events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getOverview(req, res) {
  try {
    const data = await incidentService.getOverview();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listIncidents, getIncident, getIncidentEvents, getOverview, updateStatus, listNotifications, markNotificationRead };
