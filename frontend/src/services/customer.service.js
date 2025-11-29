import api from "./api.service";
import { API_ENDPOINTS } from "../config/api.config";

class CustomerService {
  async getCustomers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`${API_ENDPOINTS.CUSTOMERS.LIST}?${queryString}`);
  }

  async getCustomer(id) {
    return await api.get(API_ENDPOINTS.CUSTOMERS.GET(id));
  }

  async createCustomer(data) {
    return await api.post(API_ENDPOINTS.CUSTOMERS.CREATE, data);
  }

  async updateCustomer(id, data) {
    return await api.put(API_ENDPOINTS.CUSTOMERS.UPDATE(id), data);
  }

  async deleteCustomer(id) {
    return await api.delete(API_ENDPOINTS.CUSTOMERS.DELETE(id));
  }

  async blockCustomer(id, isBlocked) {
    return await api.put(API_ENDPOINTS.CUSTOMERS.BLOCK(id), { isBlocked });
  }
}

export default new CustomerService();
