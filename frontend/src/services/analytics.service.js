import api from "./api.service";
import { API_ENDPOINTS } from "../config/api.config";

class AnalyticsService {
  async getDashboardStats() {
    return await api.get(API_ENDPOINTS.ANALYTICS.DASHBOARD);
  }

  async getRevenueAnalytics(period = "week") {
    return await api.get(`${API_ENDPOINTS.ANALYTICS.REVENUE}?period=${period}`);
  }

  async getCustomerAnalytics() {
    return await api.get(API_ENDPOINTS.ANALYTICS.CUSTOMERS);
  }

  async getMessageAnalytics(period = "week") {
    return await api.get(
      `${API_ENDPOINTS.ANALYTICS.MESSAGES}?period=${period}`
    );
  }
}

export default new AnalyticsService();
