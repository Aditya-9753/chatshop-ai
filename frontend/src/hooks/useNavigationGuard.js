import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Custom hook to prevent authenticated users from navigating to auth pages
 * and handle proper redirects on browser back/forward actions
 */
export const useNavigationGuard = (guardType = "auth") => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const shouldRedirect = () => {
      switch (guardType) {
        case "auth":
          // Redirect authenticated users away from login/register pages
          return (
            isAuthenticated &&
            ["/login", "/register"].includes(location.pathname)
          );

        case "admin-auth":
          // Redirect authenticated admins away from admin login
          return (
            isAuthenticated && isAdmin && location.pathname === "/admin/login"
          );

        case "guest-only":
          // Pages that should only be accessible to guests
          return isAuthenticated;

        default:
          return false;
      }
    };

    if (shouldRedirect()) {
      const redirectPath = isAdmin ? "/admin/dashboard" : "/dashboard";
      navigate(redirectPath, { replace: true });
    }
  }, [
    isAuthenticated,
    isAdmin,
    loading,
    location.pathname,
    navigate,
    guardType,
  ]);

  return { isAuthenticated, isAdmin, loading };
};

/**
 * Hook to handle browser history state and prevent unwanted navigation patterns
 */
export const useHistoryState = () => {
  const location = useLocation();

  useEffect(() => {
    // Store navigation entry for proper back/forward handling
    const state = location.state || {};

    // Add timestamp to help track navigation
    if (!state.timestamp) {
      window.history.replaceState(
        { ...state, timestamp: Date.now() },
        "",
        location.pathname
      );
    }
  }, [location]);
};
