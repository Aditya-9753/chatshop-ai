import api from "./api.service";
import { API_ENDPOINTS } from "../config/api.config";

class AdminService {
  async getDashboardStats() {
    return await api.get(`${API_ENDPOINTS.ADMIN.DASHBOARD}`);
  }

  async getAllUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`${API_ENDPOINTS.ADMIN.USERS}?${queryString}`);
  }

  async getUser(userId) {
    return await api.get(`${API_ENDPOINTS.ADMIN.USER(userId)}`);
  }

  async updateUser(userId, data) {
    return await api.put(`${API_ENDPOINTS.ADMIN.UPDATE_USER(userId)}`, data);
  }

  async deleteUser(userId) {
    return await api.delete(`${API_ENDPOINTS.ADMIN.DELETE_USER(userId)}`);
  }

  // Platform activity per day for the last `days` days, plus top shops
  async getDailyActivity(days = 30) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return await api.get(`/admin/activity?days=${days}&tz=${encodeURIComponent(tz)}`);
  }

  // Every shop's records, newest first. params: { shop, status, limit }
  async listAll(kind, params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return await api.get(`/admin/${kind}${query ? `?${query}` : ""}`);
  }

  async getConversationMessages(conversationId) {
    return await api.get(`/admin/conversations/${conversationId}/messages`);
  }

  // ---------- Admin tools ----------
  getSystemStatus() {
    return api.get("/admin/system");
  }

  getTrends() {
    return api.get("/admin/trends");
  }

  getSettings() {
    return api.get("/admin/settings");
  }

  updateSettings(data) {
    return api.put("/admin/settings", data);
  }

  createShop(data) {
    return api.post("/admin/users", data);
  }

  broadcast(data) {
    return api.post("/admin/broadcast", data);
  }

  getAnnouncements() {
    return api.get("/admin/announcements");
  }

  clearCache() {
    return api.post("/admin/cache/clear");
  }

  getAuditLog(limit = 100) {
    return api.get(`/admin/audit?limit=${limit}`);
  }

  // Download a CSV (shops, orders, customers, products) or the JSON backup
  async download(path, fileName) {
    const blob = await api.get(path, { responseType: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportCsv(kind) {
    return this.download(`/admin/export/${kind}`, `${kind}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  backup() {
    return this.download("/admin/backup", `chatshop-backup-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async getSystemStats() {
    return await api.get(`${API_ENDPOINTS.ADMIN.STATS}`);
  }
}

export default new AdminService();
