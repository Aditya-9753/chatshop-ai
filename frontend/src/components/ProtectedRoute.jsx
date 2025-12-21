import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    // Save the location they were trying to access
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
