import api from "./api.service";
import { API_ENDPOINTS } from "../config/api.config";

// Browser time zone, so daily buckets match the user's calendar
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

class AnalyticsService {
  // KPIs for the last 7 days vs the 7 before, plus needs-attention lists
  async getOverview() {
    return await api.get(`${API_ENDPOINTS.ANALYTICS.OVERVIEW}?tz=${encodeURIComponent(timeZone())}`);
  }

  // Full report for a date range, compared with the period before it
  async getReport({ start, end }) {
    const params = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      tz: timeZone(),
    });
    return await api.get(`${API_ENDPOINTS.ANALYTICS.REPORT}?${params}`);
  }

  async getCustomerAnalytics() {
    return await api.get(API_ENDPOINTS.ANALYTICS.CUSTOMERS);
  }

  async getMessageAnalytics(period = "week") {
    return await api.get(`${API_ENDPOINTS.ANALYTICS.MESSAGES}?period=${period}`);
  }
}

export default new AnalyticsService();
