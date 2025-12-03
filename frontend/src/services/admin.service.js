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

  async getSystemStats() {
    return await api.get(`${API_ENDPOINTS.ADMIN.STATS}`);
  }
}

export default new AdminService();
