import api from "./api.service";
import { API_ENDPOINTS } from "../config/api.config";

class AuthService {
  async login(email, password) {
    const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
    });

    if (response.success && response.data.token) {
      this.saveSession(response.data.token, response.data.user);
    }

    return response;
  }

  // Second step when the account has two-factor login on
  async loginWithCode(challengeToken, code) {
    const response = await api.post("/auth/login/2fa", { challengeToken, code });
    if (response.success && response.data.token) {
      this.saveSession(response.data.token, response.data.user);
    }
    return response;
  }

  setupTwoFactor() {
    return api.post("/users/2fa/setup");
  }

  enableTwoFactor(code) {
    return api.post("/users/2fa/enable", { code });
  }

  disableTwoFactor(code) {
    return api.post("/users/2fa/disable", { code });
  }

  saveSession(token, user) {
    if (token) localStorage.setItem("token", token);
    if (user) localStorage.setItem("user", JSON.stringify(user));
  }

  async register(userData) {
    const response = await api.post(API_ENDPOINTS.AUTH.REGISTER, userData);
    return response;
  }

  async verifyEmail(token) {
    const response = await api.get(`${API_ENDPOINTS.AUTH.VERIFY_EMAIL}/${token}`);
    return response;
  }

  async forgotPassword(email) {
    const response = await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      email,
    });
    return response;
  }

  // Check a reset link before showing the form
  async validateResetToken(token) {
    return api.get(`${API_ENDPOINTS.AUTH.RESET_PASSWORD}/${token}`);
  }

  async resetPassword(token, password) {
    const response = await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      token,
      password,
    });
    return response;
  }

  async changePassword(currentPassword, newPassword) {
    const response = await api.put(API_ENDPOINTS.USER.UPDATE_PASSWORD, {
      currentPassword,
      newPassword,
    });
    // Other sessions are logged out; keep this one with the fresh token
    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
    }
    return response;
  }

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  getCurrentUser() {
    try {
      const userStr = localStorage.getItem("user");
      return userStr && localStorage.getItem("token") ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  isAuthenticated() {
    return !!localStorage.getItem("token");
  }

  getToken() {
    return localStorage.getItem("token");
  }
}

export default new AuthService();
