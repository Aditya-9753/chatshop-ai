import axios from "axios";
import { API_CONFIG } from "../config/api.config";

// Create axios instance
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// Requests where a 401 means "wrong credentials", not "session expired".
// These must show their error inline instead of reloading the page.
const CREDENTIAL_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/users/password"];

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // If the data is FormData, remove Content-Type header to let browser set it
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      const url = error.config?.url || "";
      const isCredentialRequest = CREDENTIAL_ENDPOINTS.some((path) => url.startsWith(path));

      // Session expired or revoked: clear it and send the user to login
      if (status === 401 && !isCredentialRequest && localStorage.getItem("token")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        const onAuthPage = ["/login", "/admin/login"].includes(window.location.pathname);
        if (!onAuthPage) {
          const target = window.location.pathname.startsWith("/admin") ? "/admin/login" : "/login";
          window.location.href = `${target}?expired=1`;
        }
      }

      return Promise.reject({
        status,
        message: data?.message || "Something went wrong",
        errors: data?.errors,
      });
    } else if (error.request) {
      // Request made but no response
      return Promise.reject({
        message: "Can't reach the server. Check your connection and try again.",
      });
    } else {
      // Something else happened
      return Promise.reject({
        message: error.message || "An unexpected error occurred",
      });
    }
  }
);

export default api;
