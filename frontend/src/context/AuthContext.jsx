import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import authService from "../services/auth.service";
import { disconnectRealtime } from "../services/realtime";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);

    // Another tab logged out (or the session was cleared after a 401)
    const onStorage = (event) => {
      if (event.key === "token" && !event.newValue) {
        setUser(null);
        disconnectRealtime();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Throws { message } on failure so the form can show it inline
  const login = useCallback(async (email, password) => {
    const response = await authService.login(email, password);
    setUser(response.data.user);
    return response;
  }, []);

  const register = useCallback((userData) => authService.register(userData), []);

  const logout = useCallback(() => {
    authService.logout();
    disconnectRealtime();
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser((current) => {
      const next = { ...current, ...userData };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
