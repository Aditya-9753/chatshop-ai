import api from "./api.service";

// Guardian API Service - all System Guardian endpoints
const GUARDIAN = "/admin/guardian";

const guardianApi = {
  // Overview
  getOverview: () => api.get(`${GUARDIAN}/overview`),

  // Incidents
  getIncidents: (filters = {}) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    return api.get(`${GUARDIAN}/incidents${params ? `?${params}` : ""}`);
  },

  getIncident: (id) => api.get(`${GUARDIAN}/incidents/${id}`),

  updateIncidentStatus: (id, { status, note }) =>
    api.patch(`${GUARDIAN}/incidents/${id}/status`, { status, note }),

  getIncidentEvents: (id) => api.get(`${GUARDIAN}/incidents/${id}/events`),

  // Health
  getHealth: () => api.get(`${GUARDIAN}/health`),
  runHealthCheck: () => api.post(`${GUARDIAN}/health/run`),

  // Notifications
  getNotifications: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    return api.get(`${GUARDIAN}/notifications${qs ? `?${qs}` : ""}`);
  },

  markNotificationRead: (id) =>
    api.patch(`${GUARDIAN}/notifications/${id}/read`),

  // Recovery actions
  runRecoveryAction: (id, action, body = {}) =>
    api.post(`${GUARDIAN}/incidents/${id}/actions/${action}`, body),

  // Audit logs
  getAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ).toString();
    return api.get(`${GUARDIAN}/audit-logs${qs ? `?${qs}` : ""}`);
  },
};

export default guardianApi;
