import api from "./api.service";
import { API_ENDPOINTS } from "../config/api.config";

class OrderService {
  async getOrders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`${API_ENDPOINTS.ORDERS.LIST}?${queryString}`);
  }

  async getOrder(id) {
    return await api.get(API_ENDPOINTS.ORDERS.GET(id));
  }

  async createOrder(data) {
    return await api.post(API_ENDPOINTS.ORDERS.CREATE, data);
  }

  async updateOrderStatus(id, data) {
    return await api.put(API_ENDPOINTS.ORDERS.UPDATE_STATUS(id), data);
  }

  async deleteOrder(id) {
    return await api.delete(API_ENDPOINTS.ORDERS.GET(id));
  }

  async getOrderStats(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`${API_ENDPOINTS.ORDERS.STATS}?${queryString}`);
  }
}

export default new OrderService();
