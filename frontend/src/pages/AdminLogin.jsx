import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAdmin, isAuthenticated, loading: authLoading } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [isAuthenticated, isAdmin, authLoading, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("🔐 Attempting admin login...");
      const response = await login(formData.email, formData.password);
      console.log("📦 Login response:", response);

      // Verify admin role
      const loggedInUser = response.data?.user;
      console.log("👤 Logged in user:", loggedInUser);

      if (!loggedInUser || loggedInUser.role !== "admin") {
        console.error("❌ Not an admin user");
        error("Access denied. Admin privileges required.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setLoading(false);
        return;
      }

      console.log("✅ Admin verified, redirecting to dashboard...");
      success("Welcome back, Admin!");

      // Use replace navigation for proper history management
      setTimeout(() => {
        console.log("🚀 Redirecting now...");
        navigate("/admin/dashboard", { replace: true });
      }, 500);
    } catch (err) {
      console.error("❌ Login error:", err);
      error(err.message || "Invalid credentials");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-indigo-200">
            Secure access for administrators only
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="admin@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </div>
              ) : (
                "Access Admin Dashboard"
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Security Notice
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  This is a restricted area. All access attempts are logged and
                  monitored.
                </p>
              </div>
            </div>
          </div>

          {/* Back to User Login */}
          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              ← Back to User Login
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-indigo-200 text-sm mt-6">
          © 2025 ChatShop-AI. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
