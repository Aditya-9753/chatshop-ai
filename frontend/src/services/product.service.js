import api from "./api.service";
import { API_ENDPOINTS } from "../config/api.config";

class ProductService {
  async getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`${API_ENDPOINTS.PRODUCTS.LIST}?${queryString}`);
  }

  async getProduct(id) {
    return await api.get(API_ENDPOINTS.PRODUCTS.GET(id));
  }

  async createProduct(data) {
    return await api.post(API_ENDPOINTS.PRODUCTS.CREATE, data);
  }

  async updateProduct(id, data) {
    return await api.put(API_ENDPOINTS.PRODUCTS.UPDATE(id), data);
  }

  async deleteProduct(id) {
    return await api.delete(API_ENDPOINTS.PRODUCTS.DELETE(id));
  }
}

export default new ProductService();
