import React, { useState, useRef, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import SubscriptionBadge from "../components/SubscriptionBadge";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  User,
  ChevronDown,
  Moon,
  Sun,
} from "lucide-react";

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Customers", href: "/dashboard/customers", icon: Users },
    { name: "Messages", href: "/dashboard/messages", icon: MessageSquare },
    { name: "Products", href: "/dashboard/products", icon: Package },
    {
      name: "Orders & Invoices",
      href: "/dashboard/orders",
      icon: ShoppingCart,
    },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? "dark bg-gray-900" : "bg-gray-50"
      }`}
    >
      {/* Sidebar for desktop */}
      <aside
        className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        } border-r`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div
            className={`flex items-center h-16 px-6 border-b ${
              isDarkMode ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold">
                WA
              </div>
              <div
                className={`font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text ${
                  isDarkMode ? "text-transparent" : "text-transparent"
                }`}
              >
                ChatShop AI
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {/* Subscription Badge */}
            <div className="mb-4 px-2">
              <SubscriptionBadge user={user} showDetails={true} />
            </div>

            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? isDarkMode
                        ? "bg-indigo-900 text-indigo-300"
                        : "bg-indigo-50 text-indigo-600"
                      : isDarkMode
                      ? "text-gray-300 hover:bg-gray-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div
            className={`p-4 border-t ${
              isDarkMode ? "border-gray-700" : "border-gray-200"
            }`}
          >
            <button
              onClick={() => navigate("/dashboard/profile")}
              className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-colors mb-2 ${
                isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold overflow-hidden">
                {user?.profilePhoto ? (
                  <img
                    src={`http://localhost:5000${user.profilePhoto}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.name?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div
                  className={`text-sm font-semibold truncate ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {user?.name}
                </div>
                <div
                  className={`text-xs truncate ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  View Profile
                </div>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 rounded-lg transition-colors ${
                isDarkMode ? "hover:bg-red-900/30" : "hover:bg-red-50"
              }`}
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? "block" : "hidden"}`}>
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          ></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={() => setSidebarOpen(false)}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center px-6 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold">
                    WA
                  </div>
                  <div className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    ChatShop AI
                  </div>
                </div>
              </div>
              <nav className="px-4 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between h-16 px-4 border-b lg:px-8 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`lg:hidden p-2 ${
                isDarkMode
                  ? "text-gray-300"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Search Bar */}
            <div className="hidden sm:block w-full max-w-md">
              <div className="relative">
                <Search
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                    isDarkMode ? "text-gray-500" : "text-gray-400"
                  }`}
                />
                <input
                  type="text"
                  placeholder="Search..."
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Right side - Subscription, Notifications, Dark Mode, Profile */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <SubscriptionBadge user={user} />
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? "text-yellow-300 hover:bg-gray-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
              title={
                isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <button
              className={`relative p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? "text-gray-300 hover:bg-gray-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                  isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-semibold overflow-hidden ring-2 ring-white">
                  {user?.profilePhoto ? (
                    <img
                      src={`http://localhost:5000${user.profilePhoto}`}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="hidden lg:block text-left max-w-[140px]">
                  <div
                    className={`text-sm font-semibold truncate ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {user?.name}
                  </div>
                  <div
                    className={`text-xs truncate ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {user?.email}
                  </div>
                </div>
                <ChevronDown
                  className={`hidden lg:block w-4 h-4 transition-transform ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  } ${profileDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div
                  className={`absolute right-0 mt-2 w-64 rounded-xl shadow-xl border py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${
                    isDarkMode
                      ? "bg-gray-800 border-gray-700"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div
                    className={`px-4 py-3 border-b ${
                      isDarkMode ? "border-gray-700" : "border-gray-100"
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold truncate ${
                        isDarkMode ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {user?.name}
                    </div>
                    <div
                      className={`text-xs truncate mt-0.5 ${
                        isDarkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {user?.email}
                    </div>
                    {user?.businessName && (
                      <div
                        className={`inline-flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded-full ${
                          isDarkMode
                            ? "text-indigo-400 bg-indigo-900/30"
                            : "text-indigo-600 bg-indigo-50"
                        }`}
                      >
                        <span>📊</span>
                        <span className="font-medium">{user.businessName}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      navigate("/dashboard/profile");
                      setProfileDropdownOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                      isDarkMode
                        ? "text-gray-300 hover:bg-gray-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span className="font-medium">View Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate("/dashboard/settings");
                      setProfileDropdownOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                      isDarkMode
                        ? "text-gray-300 hover:bg-gray-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="font-medium">Settings</span>
                  </button>
                  <div
                    className={`border-t mt-1 pt-1 ${
                      isDarkMode ? "border-gray-700" : "border-gray-100"
                    }`}
                  >
                    <button
                      onClick={handleLogout}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 transition-colors font-medium ${
                        isDarkMode ? "hover:bg-red-900/30" : "hover:bg-red-50"
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main
          className={`p-4 sm:p-6 lg:p-8 min-h-screen ${
            isDarkMode ? "bg-gray-900" : "bg-gray-50"
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
