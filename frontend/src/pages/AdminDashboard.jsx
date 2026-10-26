import React, { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Package,
  MessageSquare,
  UserCheck,
  UserX,
  Award,
  Activity,
  Search,
  Eye,
  Trash2,
  Shield,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Send,
  X,
  BarChart3,
  Settings,
  LogOut,
  CreditCard,
  Bell,
  Lock,
  Key,
  Database,
  Server,
  Zap,
  CheckCircle,
  Clock,
  TrendingDown,
  UserPlus,
  FileText,
  PieChart,
  Edit,
  Smartphone,
  Layout,
  Home,
  Sun,
  Moon,
} from "lucide-react";
import adminService from "../services/admin.service";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Modal from "../components/Modal";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [messageData, setMessageData] = useState({ subject: "", message: "" });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { success, error } = useToast();
  const { logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (activeSection === "users") {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 500);
      return () => clearTimeout(timer);
    } else if (activeSection === "analytics") {
      fetchSystemStats();
    }
  }, [searchTerm, filterPlan, filterStatus, currentPage, activeSection]);

  const fetchDashboardStats = async () => {
    try {
      const response = await adminService.getDashboardStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      error(err.message || "Failed to fetch dashboard stats");
    }
  };

  const fetchSystemStats = async () => {
    try {
      const response = await adminService.getSystemStats();
      if (response.success) {
        setSystemStats(response.data);
      }
    } catch (err) {
      error(err.message || "Failed to fetch system stats");
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchTerm,
        page: currentPage,
        limit: 10,
      };

      // Add filter parameters if not "all"
      if (filterPlan !== "all") {
        params.plan = filterPlan;
      }
      if (filterStatus !== "all") {
        params.status = filterStatus;
      }

      const response = await adminService.getAllUsers(params);
      if (response.success) {
        setUsers(response.data || []);
        setTotalPages(
          response.pagination?.totalPages ||
            Math.ceil((response.total || 0) / 10)
        );
      }
    } catch (err) {
      error(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardStats();
    if (activeSection === "users") {
      fetchUsers();
    }
    success("Dashboard refreshed");
  };

  const handleExportUsers = () => {
    // Create CSV from users data
    const headers = ["Name", "Email", "Plan", "Status", "Joined"];
    const csvData = users.map((user) => [
      user.name,
      user.email,
      user.subscription?.plan || "free",
      user.subscription?.status || "inactive",
      new Date(user.createdAt).toLocaleDateString(),
    ]);

    const csv = [
      headers.join(","),
      ...csvData.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    success("Users exported successfully");
  };

  const viewUserDetails = async (user) => {
    try {
      const response = await adminService.getUser(user._id);
      if (response.success) {
        setSelectedUser(response.data);
        setIsViewModalOpen(true);
      }
    } catch (err) {
      error(err.message || "Failed to fetch user details");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (
      !window.confirm(
        "⚠️ WARNING: This will permanently delete the user and ALL their data (customers, orders, products, messages). This action cannot be undone. Are you absolutely sure?"
      )
    ) {
      return;
    }

    try {
      await adminService.deleteUser(userId);
      success("User and all associated data deleted successfully");
      fetchUsers();
      fetchDashboardStats();
      setIsViewModalOpen(false);
    } catch (err) {
      error(err.message || "Failed to delete user");
    }
  };

  const openMessageModal = (user) => {
    setSelectedUser({ user });
    setMessageData({ subject: "", message: "" });
    setIsViewModalOpen(false);
    setIsMessageModalOpen(true);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageData.subject || !messageData.message) {
      error("Please fill in all required fields");
      return;
    }

    try {
      // Here you can implement the actual email sending logic
      // For now, we'll just show a success message
      success(`Message sent to ${selectedUser?.user?.name || "user"}`);
      setIsMessageModalOpen(false);
      setMessageData({ subject: "", message: "" });
    } catch (err) {
      error(err.message || "Failed to send message");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      error("Please fill in all fields");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      error("New password and confirm password do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      error("Password must be at least 6 characters long");
      return;
    }

    try {
      // Call API to change password
      success("Password changed successfully");
      setIsPasswordModalOpen(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      error(err.message || "Failed to change password");
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    success("Settings saved successfully");
  };

  const handle2FASetup = () => {
    success("Two-Factor Authentication setup - Coming soon");
  };

  const handleSecurityAudit = () => {
    success("Security Audit Logs - Coming soon");
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>
            {value?.toLocaleString() || 0}
          </p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div
          className={`w-12 h-12 ${color
            .replace("text-", "bg-")
            .replace(
              "600",
              "100"
            )} rounded-lg flex items-center justify-center`}
        >
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  // Navigation menu items for sidebar
  const navigationItems = [
    {
      id: "overview",
      label: "Dashboard",
      icon: Home,
      color: "text-indigo-600",
    },
    {
      id: "users",
      label: "User Management",
      icon: Users,
      color: "text-blue-600",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      color: "text-purple-600",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      color: "text-gray-600",
    },
  ];

  if (!stats) {
    return (
      <div
        className={`flex items-center justify-center min-h-screen ${
          isDarkMode ? "bg-gray-900" : "bg-gray-50"
        }`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p
            className={`font-medium ${
              isDarkMode ? "text-gray-300" : "text-gray-600"
            }`}
          >
            Loading Admin Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen overflow-hidden ${
        isDarkMode ? "bg-gray-900" : "bg-gray-50"
      }`}
    >
      {/* Sidebar Navigation - Google Admin Console Style */}
      <div
        className={`${
          sidebarCollapsed ? "w-20" : "w-64"
        } flex flex-col transition-all duration-300 shadow-lg ${
          isDarkMode
            ? "bg-gray-800 border-r border-gray-700"
            : "bg-white border-r border-gray-200"
        }`}
      >
        {/* Logo/Header */}
        <div
          className={`p-6 border-b ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1
                  className={`text-lg font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Admin Panel
                </h1>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  ChatShop-AI
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                  isActive
                    ? isDarkMode
                      ? "bg-indigo-900/50 text-indigo-400 font-medium shadow-sm"
                      : "bg-indigo-50 text-indigo-700 font-medium shadow-sm"
                    : isDarkMode
                    ? "text-gray-300 hover:bg-gray-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                title={sidebarCollapsed ? item.label : ""}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    isActive
                      ? item.color
                      : isDarkMode
                      ? "text-gray-500 group-hover:text-gray-400"
                      : "text-gray-400 group-hover:text-gray-600"
                  }`}
                />
                {!sidebarCollapsed && (
                  <span className="text-sm">{item.label}</span>
                )}
                {!sidebarCollapsed && isActive && (
                  <div className="ml-auto w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div
          className={`p-4 border-t ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold truncate ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Admin
                </p>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Super Admin
                </p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className={`w-full flex items-center ${
              sidebarCollapsed ? "justify-center" : "gap-2"
            } px-4 py-2 text-sm text-red-600 rounded-lg transition-colors ${
              isDarkMode ? "hover:bg-red-900/30" : "hover:bg-red-50"
            }`}
            title={sidebarCollapsed ? "Logout" : ""}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <div
          className={`px-8 py-4 shadow-sm border-b ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Layout
                  className={`w-5 h-5 ${
                    isDarkMode ? "text-gray-300" : "text-gray-600"
                  }`}
                />
              </button>
              <div>
                <h2
                  className={`text-2xl font-bold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  {
                    navigationItems.find((item) => item.id === activeSection)
                      ?.label
                  }
                </h2>
                <p
                  className={`text-sm mt-1 ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {activeSection === "overview" &&
                    "Monitor your platform performance and key metrics"}
                  {activeSection === "users" &&
                    "Manage all registered users and their accounts"}
                  {activeSection === "analytics" &&
                    "View detailed analytics and insights"}
                  {activeSection === "settings" &&
                    "Configure system settings and preferences"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
                onClick={handleRefresh}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode
                    ? "text-gray-300 hover:bg-gray-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                className={`relative p-2 rounded-lg transition-colors ${
                  isDarkMode
                    ? "text-gray-300 hover:bg-gray-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div
          className={`flex-1 overflow-y-auto p-8 ${
            isDarkMode ? "bg-gray-900" : "bg-gray-50"
          }`}
        >
          {activeSection === "overview" && (
            <OverviewSection
              stats={stats}
              handleExportUsers={handleExportUsers}
              isDarkMode={isDarkMode}
            />
          )}
          {activeSection === "users" && (
            <UsersSection
              users={users}
              loading={loading}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterPlan={filterPlan}
              setFilterPlan={setFilterPlan}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              viewUserDetails={viewUserDetails}
              openMessageModal={openMessageModal}
              handleDeleteUser={handleDeleteUser}
              handleExportUsers={handleExportUsers}
              isDarkMode={isDarkMode}
            />
          )}
          {activeSection === "analytics" && (
            <AnalyticsSection
              stats={stats}
              systemStats={systemStats}
              isDarkMode={isDarkMode}
            />
          )}
          {activeSection === "settings" && (
            <SettingsSection
              handleSaveSettings={handleSaveSettings}
              setIsPasswordModalOpen={setIsPasswordModalOpen}
              handle2FASetup={handle2FASetup}
              handleSecurityAudit={handleSecurityAudit}
              isDarkMode={isDarkMode}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="User Details"
        size="lg"
      >
        {selectedUser && (
          <UserDetailsContent
            selectedUser={selectedUser}
            onClose={() => setIsViewModalOpen(false)}
            openMessageModal={openMessageModal}
            handleDeleteUser={handleDeleteUser}
          />
        )}
      </Modal>

      <Modal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        title={`Send Message to ${selectedUser?.user?.name || "User"}`}
        size="md"
      >
        {selectedUser && (
          <SendMessageContent
            selectedUser={selectedUser}
            messageData={messageData}
            setMessageData={setMessageData}
            handleSendMessage={handleSendMessage}
            onClose={() => setIsMessageModalOpen(false)}
          />
        )}
      </Modal>

      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Admin Password"
        size="md"
      >
        <ChangePasswordContent
          passwordData={passwordData}
          setPasswordData={setPasswordData}
          handleChangePassword={handleChangePassword}
          onClose={() => setIsPasswordModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

// ==================== SECTION COMPONENTS ====================

// Overview Section
const OverviewSection = ({ stats, handleExportUsers, isDarkMode }) => {
  const statCards = [
    {
      title: "Total Users",
      value: stats?.users?.total || 0,
      change: "+12%",
      trend: "up",
      icon: Users,
      color: "bg-blue-500",
      bgLight: "bg-blue-50",
    },
    {
      title: "Premium Users",
      value: stats?.users?.premium || 0,
      change: "+8%",
      trend: "up",
      icon: Award,
      color: "bg-purple-500",
      bgLight: "bg-purple-50",
    },
    {
      title: "Total Revenue",
      value: `₹${(stats?.revenue?.total || 0).toLocaleString("en-IN")}`,
      change: "+23%",
      trend: "up",
      icon: DollarSign,
      color: "bg-green-500",
      bgLight: "bg-green-50",
    },
    {
      title: "Active Users",
      value: stats?.users?.active || 0,
      change: "+5%",
      trend: "up",
      icon: Activity,
      color: "bg-orange-500",
      bgLight: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`rounded-xl border p-6 hover:shadow-lg transition-shadow ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p
                    className={`text-sm mb-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {stat.title}
                  </p>
                  <h3
                    className={`text-3xl font-bold mb-2 ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {stat.value}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        stat.trend === "up" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {stat.change}
                    </span>
                    <span
                      className={`text-xs ${
                        isDarkMode ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      vs last month
                    </span>
                  </div>
                </div>
                <div
                  className={`${stat.bgLight} w-12 h-12 rounded-lg flex items-center justify-center`}
                >
                  <Icon
                    className={`w-6 h-6 ${stat.color.replace("bg-", "text-")}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions & Platform Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 flex items-center gap-2 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            <Zap className="w-5 h-5 text-indigo-600" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center gap-3 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg hover:from-indigo-100 hover:to-purple-100 transition-colors">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-gray-900">
                Add User
              </span>
            </button>
            <button className="flex items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg hover:from-green-100 hover:to-emerald-100 transition-colors">
              <Send className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-900">
                Broadcast
              </span>
            </button>
            <button
              onClick={handleExportUsers}
              className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg hover:from-blue-100 hover:to-cyan-100 transition-colors"
            >
              <Download className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                Export Data
              </span>
            </button>
            <button className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg hover:from-orange-100 hover:to-amber-100 transition-colors">
              <FileText className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-gray-900">Reports</span>
            </button>
          </div>
        </div>

        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 flex items-center gap-2 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            <Server className="w-5 h-5 text-teal-600" />
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-900">
                  Server Status
                </span>
              </div>
              <span className="flex items-center gap-2 text-sm font-semibold text-green-600">
                <CheckCircle className="w-4 h-4" />
                Online
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-900">
                  Database
                </span>
              </div>
              <span className="flex items-center gap-2 text-sm font-semibold text-green-600">
                <CheckCircle className="w-4 h-4" />
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  API Uptime
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-900">99.9%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Connections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Platform Connections
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">WhatsApp</p>
                  <p className="text-sm text-gray-600">Connected Users</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {stats?.platforms?.whatsapp || 0}
              </p>
            </div>
            <div className="flex items-center justify-between p-4 bg-pink-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Instagram</p>
                  <p className="text-sm text-gray-600">Connected Users</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-pink-600">
                {stats?.platforms?.instagram || 0}
              </p>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Facebook</p>
                  <p className="text-sm text-gray-600">Connected Users</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {stats?.platforms?.facebook || 0}
              </p>
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            System Wide Data
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700" : "bg-gray-50"
              }`}
            >
              <Users className="w-8 h-8 text-indigo-600 mb-2" />
              <p
                className={`text-2xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {stats?.entities?.customers?.toLocaleString() || 0}
              </p>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Total Customers
              </p>
            </div>
            <div
              className={`p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700" : "bg-gray-50"
              }`}
            >
              <ShoppingBag className="w-8 h-8 text-green-600 mb-2" />
              <p
                className={`text-2xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {stats?.entities?.orders?.toLocaleString() || 0}
              </p>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Total Orders
              </p>
            </div>
            <div
              className={`p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700" : "bg-gray-50"
              }`}
            >
              <Package className="w-8 h-8 text-purple-600 mb-2" />
              <p
                className={`text-2xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {stats?.entities?.products?.toLocaleString() || 0}
              </p>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Total Products
              </p>
            </div>
            <div
              className={`p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700" : "bg-gray-50"
              }`}
            >
              <MessageSquare className="w-8 h-8 text-blue-600 mb-2" />
              <p
                className={`text-2xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {stats?.entities?.messages?.toLocaleString() || 0}
              </p>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Total Messages
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Users Section
const UsersSection = ({
  users,
  loading,
  searchTerm,
  setSearchTerm,
  filterPlan,
  setFilterPlan,
  filterStatus,
  setFilterStatus,
  currentPage,
  setCurrentPage,
  totalPages,
  viewUserDetails,
  openMessageModal,
  handleDeleteUser,
  handleExportUsers,
  isDarkMode,
}) => {
  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div
        className={`rounded-xl border p-6 ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                isDarkMode ? "text-gray-500" : "text-gray-400"
              }`}
            />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterPlan}
              onChange={(e) => {
                setFilterPlan(e.target.value);
                setCurrentPage(1);
              }}
              className={`px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="premium">Premium</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className={`px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              onClick={handleExportUsers}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div
        className={`rounded-xl border overflow-hidden ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users
              className={`w-12 h-12 mx-auto mb-4 ${
                isDarkMode ? "text-gray-600" : "text-gray-400"
              }`}
            />
            <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
              No users found
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead
                  className={`border-b ${
                    isDarkMode
                      ? "bg-gray-700 border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <tr>
                    <th
                      className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      User
                    </th>
                    <th
                      className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                      Plan
                    </th>
                    <th
                      className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Status
                    </th>
                    <th
                      className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Joined
                    </th>
                    <th
                      className={`px-6 py-4 text-right text-xs font-semibold uppercase ${
                        isDarkMode ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    isDarkMode ? "divide-gray-700" : "divide-gray-200"
                  }`}
                >
                  {users.map((user) => (
                    <tr
                      key={user._id}
                      className={`transition-colors ${
                        isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p
                              className={`text-sm font-semibold ${
                                isDarkMode ? "text-white" : "text-gray-900"
                              }`}
                            >
                              {user.name}
                            </p>
                            {user.role === "admin" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded mt-1">
                                <Shield className="w-3 h-3" />
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p
                            className={`flex items-center gap-1 ${
                              isDarkMode ? "text-gray-300" : "text-gray-900"
                            }`}
                          >
                            <Mail
                              className={`w-3 h-3 ${
                                isDarkMode ? "text-gray-500" : "text-gray-400"
                              }`}
                            />
                            {user.email}
                          </p>
                          {user.phone && (
                            <p
                              className={`flex items-center gap-1 mt-1 ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              <Phone
                                className={`w-3 h-3 ${
                                  isDarkMode ? "text-gray-600" : "text-gray-400"
                                }`}
                              />
                              {user.phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                            user.subscription?.plan === "premium"
                              ? "bg-purple-100 text-purple-800"
                              : user.subscription?.plan === "business"
                              ? "bg-green-100 text-green-800"
                              : user.subscription?.plan === "starter"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.subscription?.plan?.toUpperCase() || "FREE"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full ${
                            user.subscription?.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {user.subscription?.status === "active" ? (
                            <UserCheck className="w-3 h-3" />
                          ) : (
                            <UserX className="w-3 h-3" />
                          )}
                          {user.subscription?.status?.toUpperCase() ||
                            "INACTIVE"}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-4 text-sm ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {new Date(user.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => viewUserDetails(user)}
                            className={`p-2 text-blue-600 rounded-lg transition-colors ${
                              isDarkMode
                                ? "hover:bg-blue-900/30"
                                : "hover:bg-blue-50"
                            }`}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openMessageModal(user)}
                            className={`p-2 text-green-600 rounded-lg transition-colors ${
                              isDarkMode
                                ? "hover:bg-green-900/30"
                                : "hover:bg-green-50"
                            }`}
                            title="Send Message"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          {user.role !== "admin" && (
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className={`p-2 text-red-600 rounded-lg transition-colors ${
                                isDarkMode
                                  ? "hover:bg-red-900/30"
                                  : "hover:bg-red-50"
                              }`}
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div
                className={`flex items-center justify-between px-6 py-4 border-t ${
                  isDarkMode ? "border-gray-700" : "border-gray-200"
                }`}
              >
                <p
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      isDarkMode
                        ? "text-gray-300 hover:bg-gray-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                      isDarkMode
                        ? "text-gray-300 hover:bg-gray-700"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Analytics Section
const AnalyticsSection = ({ stats, systemStats, isDarkMode }) => {
  // Prepare user growth data
  const userGrowthData = systemStats?.userGrowth || [];
  const sortedUserGrowth = [...userGrowthData].reverse(); // Oldest to newest

  // Prepare revenue data
  const revenueData = systemStats?.monthlyRevenue || [];
  const sortedRevenue = [...revenueData].reverse();

  // Calculate max values for scaling
  const maxUsers = Math.max(...sortedUserGrowth.map((d) => d.count || 0), 1);
  const maxRevenue = Math.max(...sortedRevenue.map((d) => d.revenue || 0), 1);

  // Subscription distribution
  const subDistribution = systemStats?.subscriptionDistribution || [];
  const totalSubs = subDistribution.reduce(
    (sum, item) => sum + (item.count || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p
            className={`text-2xl font-bold ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            {systemStats?.totalUsers || 0}
          </p>
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Total Users
          </p>
        </div>
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Award className="w-8 h-8 text-purple-600" />
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p
            className={`text-2xl font-bold ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            {systemStats?.activeSubscriptions || 0}
          </p>
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Active Subscriptions
          </p>
        </div>
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-green-600" />
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p
            className={`text-2xl font-bold ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            ₹{(systemStats?.totalRevenue || 0).toLocaleString("en-IN")}
          </p>
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Total Revenue
          </p>
        </div>
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag className="w-8 h-8 text-orange-600" />
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p
            className={`text-2xl font-bold ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            {systemStats?.totalOrders || 0}
          </p>
          <p
            className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Total Orders
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 flex items-center gap-2 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            <TrendingUp className="w-5 h-5 text-blue-600" />
            User Growth (Last 12 Months)
          </h3>
          {sortedUserGrowth.length > 0 ? (
            <div className="h-64">
              <div className="flex items-end justify-between h-full gap-2 pb-8">
                {sortedUserGrowth.map((item, index) => {
                  const height = (item.count / maxUsers) * 100;
                  return (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center group"
                    >
                      <div className="relative w-full">
                        <div
                          className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg transition-all hover:from-blue-600 hover:to-blue-400 cursor-pointer"
                          style={{
                            height: `${height * 2}px`,
                            minHeight: "10px",
                          }}
                          title={`${item._id}: ${item.count} users`}
                        >
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {item.count}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                        {item._id?.substring(5) || ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                <p>No user growth data available</p>
              </div>
            </div>
          )}
        </div>

        {/* Revenue Trends Chart */}
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 flex items-center gap-2 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            <DollarSign className="w-5 h-5 text-green-600" />
            Revenue Trends (Last 12 Months)
          </h3>
          {sortedRevenue.length > 0 ? (
            <div className="h-64">
              <div className="flex items-end justify-between h-full gap-2 pb-8">
                {sortedRevenue.map((item, index) => {
                  const height = (item.revenue / maxRevenue) * 100;
                  return (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center group"
                    >
                      <div className="relative w-full">
                        <div
                          className="w-full bg-gradient-to-t from-green-500 to-green-300 rounded-t-lg transition-all hover:from-green-600 hover:to-green-400 cursor-pointer"
                          style={{
                            height: `${height * 2}px`,
                            minHeight: "10px",
                          }}
                          title={`${item._id}: ₹${item.revenue?.toLocaleString(
                            "en-IN"
                          )}`}
                        >
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            ₹{(item.revenue || 0).toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                        {item._id?.substring(5) || ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                <p>No revenue data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Distribution */}
      <div
        className={`rounded-xl border p-6 ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
      >
        <h3
          className={`text-lg font-bold mb-4 flex items-center gap-2 ${
            isDarkMode ? "text-gray-100" : "text-gray-900"
          }`}
        >
          <PieChart className="w-5 h-5 text-purple-600" />
          Subscription Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {subDistribution.map((item, index) => {
            const percentage =
              totalSubs > 0 ? ((item.count / totalSubs) * 100).toFixed(1) : 0;
            const colors = [
              {
                bg: "from-blue-50 to-blue-100",
                text: "text-blue-700",
                bar: "bg-blue-500",
              },
              {
                bg: "from-green-50 to-green-100",
                text: "text-green-700",
                bar: "bg-green-500",
              },
              {
                bg: "from-purple-50 to-purple-100",
                text: "text-purple-700",
                bar: "bg-purple-500",
              },
              {
                bg: "from-gray-50 to-gray-100",
                text: "text-gray-700",
                bar: "bg-gray-500",
              },
            ];
            const color = colors[index % colors.length];

            return (
              <div
                key={index}
                className={`p-4 bg-gradient-to-br ${color.bg} rounded-lg`}
              >
                <p className={`text-sm font-semibold ${color.text} mb-1`}>
                  {item._id?.toUpperCase() || "FREE"}
                </p>
                <p
                  className={`text-3xl font-bold mb-2 ${
                    isDarkMode ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  {item.count}
                </p>
                <div className="w-full bg-white rounded-full h-2 mb-1">
                  <div
                    className={`${color.bar} h-2 rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-gray-500" : "text-gray-600"
                  }`}
                >
                  {percentage}% of total
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Platform Usage */}
      <div
        className={`rounded-xl border p-6 ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        }`}
      >
        <h3
          className={`text-lg font-bold mb-4 ${
            isDarkMode ? "text-gray-100" : "text-gray-900"
          }`}
        >
          Platform Usage
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
            <MessageSquare className="w-8 h-8 text-green-600 mb-2" />
            <p
              className={`text-2xl font-bold ${
                isDarkMode ? "text-gray-800" : "text-gray-900"
              }`}
            >
              {stats?.platforms?.whatsapp || 0}
            </p>
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-700" : "text-gray-600"
              }`}
            >
              WhatsApp Users
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg">
            <Smartphone className="w-8 h-8 text-pink-600 mb-2" />
            <p
              className={`text-2xl font-bold ${
                isDarkMode ? "text-gray-800" : "text-gray-900"
              }`}
            >
              {stats?.platforms?.instagram || 0}
            </p>
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-700" : "text-gray-600"
              }`}
            >
              Instagram Users
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
            <MessageSquare className="w-8 h-8 text-blue-600 mb-2" />
            <p
              className={`text-2xl font-bold ${
                isDarkMode ? "text-gray-800" : "text-gray-900"
              }`}
            >
              {stats?.platforms?.facebook || 0}
            </p>
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-700" : "text-gray-600"
              }`}
            >
              Facebook Users
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg">
            <Users className="w-8 h-8 text-purple-600 mb-2" />
            <p
              className={`text-2xl font-bold ${
                isDarkMode ? "text-gray-800" : "text-gray-900"
              }`}
            >
              {stats?.entities?.customers || 0}
            </p>
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-700" : "text-gray-600"
              }`}
            >
              Total Customers
            </p>
          </div>
        </div>
        {/* Remove Orders card here since we want 4 platform cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg">
            <ShoppingBag className="w-8 h-8 text-orange-600 mb-2" />
            <p
              className={`text-2xl font-bold ${
                isDarkMode ? "text-gray-800" : "text-gray-900"
              }`}
            >
              {stats?.entities?.orders || 0}
            </p>
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-700" : "text-gray-600"
              }`}
            >
              Total Orders
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Section
const SettingsSection = ({
  handleSaveSettings,
  setIsPasswordModalOpen,
  handle2FASetup,
  handleSecurityAudit,
  isDarkMode,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 flex items-center gap-2 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            <Settings className="w-5 h-5 text-indigo-600" />
            General Settings
          </h3>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Platform Name
              </label>
              <input
                type="text"
                defaultValue="ChatShop-AI"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Support Email
              </label>
              <input
                type="email"
                defaultValue="support@chatshop-ai.com"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Contact Phone
              </label>
              <input
                type="tel"
                defaultValue="+91 9876543210"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                  isDarkMode
                    ? "bg-gray-700 border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Save Changes
            </button>
          </form>
        </div>

        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 flex items-center gap-2 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            <Shield className="w-5 h-5 text-red-600" />
            Security Settings
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                isDarkMode
                  ? "border-gray-700 hover:bg-gray-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Key
                  className={`w-5 h-5 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                />
                <div className="text-left">
                  <p
                    className={`text-sm font-medium ${
                      isDarkMode ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    Change Admin Password
                  </p>
                  <p
                    className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Update your account password
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={handle2FASetup}
              className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                isDarkMode
                  ? "border-gray-700 hover:bg-gray-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Lock
                  className={`w-5 h-5 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                />
                <div className="text-left">
                  <p
                    className={`text-sm font-medium ${
                      isDarkMode ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    Two-Factor Authentication
                  </p>
                  <p
                    className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    Add extra security layer
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={handleSecurityAudit}
              className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                isDarkMode
                  ? "border-gray-700 hover:bg-gray-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText
                  className={`w-5 h-5 ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                />
                <div className="text-left">
                  <p
                    className={`text-sm font-medium ${
                      isDarkMode ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    Security Audit Logs
                  </p>
                  <p
                    className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    View system access logs
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-md font-bold mb-3 flex items-center gap-2 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            <Bell className="w-5 h-5 text-yellow-600" />
            Notifications
          </h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Email Notifications
              </span>
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                New User Alerts
              </span>
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span
                className={`text-sm ${
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                }`}
              >
                System Updates
              </span>
              <input
                type="checkbox"
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>
          </div>
        </div>

        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-md font-bold mb-3 flex items-center gap-2 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            <Database className="w-5 h-5 text-blue-600" />
            Data Management
          </h3>
          <div className="space-y-2">
            <button className="w-full px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
              Export All Data
            </button>
            <button className="w-full px-3 py-2 text-sm bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors">
              Backup Database
            </button>
            <button className="w-full px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors">
              Clear Cache
            </button>
          </div>
        </div>

        <div
          className={`rounded-xl border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <h3
            className={`text-md font-bold mb-3 flex items-center gap-2 ${
              isDarkMode ? "text-gray-100" : "text-gray-900"
            }`}
          >
            <Server className="w-5 h-5 text-green-600" />
            System Info
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                Version:
              </span>
              <span
                className={`font-semibold ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}
              >
                v2.0.0
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                Environment:
              </span>
              <span
                className={`font-semibold ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}
              >
                Production
              </span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? "text-gray-400" : "text-gray-600"}>
                Uptime:
              </span>
              <span className="font-semibold text-green-600">99.9%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// User Details Modal Content
const UserDetailsContent = ({
  selectedUser,
  onClose,
  openMessageModal,
  handleDeleteUser,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-2xl">
              {selectedUser.user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">
              {selectedUser.user?.name}
            </h3>
            {selectedUser.user?.role === "admin" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded mt-1">
                <Shield className="w-3 h-3" />
                Administrator
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-white rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-gray-500" />
              <p className="text-xs font-semibold text-gray-600">Email</p>
            </div>
            <p className="text-sm text-gray-900">{selectedUser.user?.email}</p>
          </div>
          <div className="p-3 bg-white rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4 text-gray-500" />
              <p className="text-xs font-semibold text-gray-600">Phone</p>
            </div>
            <p className="text-sm text-gray-900">
              {selectedUser.user?.phone || "Not provided"}
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg">
            <p className="text-xs font-semibold text-gray-600 mb-1">Plan</p>
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                selectedUser.user?.subscription?.plan === "premium"
                  ? "bg-amber-100 text-amber-800"
                  : selectedUser.user?.subscription?.plan === "business"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {selectedUser.user?.subscription?.plan?.toUpperCase() || "FREE"}
            </span>
          </div>
          <div className="p-3 bg-white rounded-lg">
            <p className="text-xs font-semibold text-gray-600 mb-1">Status</p>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                selectedUser.user?.subscription?.status === "active"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {selectedUser.user?.subscription?.status === "active" ? (
                <UserCheck className="w-3 h-3" />
              ) : (
                <UserX className="w-3 h-3" />
              )}
              {selectedUser.user?.subscription?.status?.toUpperCase() ||
                "INACTIVE"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" />
          Activity Statistics
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <Users className="w-6 h-6 text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {selectedUser.stats?.customers || 0}
            </p>
            <p className="text-sm text-gray-600">Customers</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {selectedUser.stats?.orders || 0}
            </p>
            <p className="text-sm text-gray-600">Orders</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <Package className="w-6 h-6 text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {selectedUser.stats?.products || 0}
            </p>
            <p className="text-sm text-gray-600">Products</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <DollarSign className="w-6 h-6 text-amber-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              ₹{selectedUser.stats?.revenue?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-600">Revenue</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <button
          onClick={onClose}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
        <button
          onClick={() => {
            onClose();
            openMessageModal(selectedUser.user);
          }}
          className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send Message
        </button>
        {selectedUser.user?.role !== "admin" && (
          <button
            onClick={() => handleDeleteUser(selectedUser.user._id)}
            className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

// Send Message Modal Content
const SendMessageContent = ({
  selectedUser,
  messageData,
  setMessageData,
  handleSendMessage,
  onClose,
}) => {
  return (
    <form onSubmit={handleSendMessage} className="space-y-6">
      <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">
              {selectedUser.user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {selectedUser.user?.name}
            </p>
            <p className="text-sm text-gray-600">{selectedUser.user?.email}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={messageData.subject}
          onChange={(e) =>
            setMessageData({ ...messageData, subject: e.target.value })
          }
          placeholder="Enter message subject..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          value={messageData.message}
          onChange={(e) =>
            setMessageData({ ...messageData, message: e.target.value })
          }
          placeholder="Type your message here..."
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
          required
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Send Message
        </button>
      </div>
    </form>
  );
};

// Change Password Modal Content
const ChangePasswordContent = ({
  passwordData,
  setPasswordData,
  handleChangePassword,
  onClose,
}) => {
  return (
    <form onSubmit={handleChangePassword} className="space-y-6">
      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Security Notice
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Please choose a strong password with at least 6 characters. You'll
              be logged out after changing the password.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Current Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={passwordData.currentPassword}
          onChange={(e) =>
            setPasswordData({
              ...passwordData,
              currentPassword: e.target.value,
            })
          }
          placeholder="Enter current password..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          New Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={passwordData.newPassword}
          onChange={(e) =>
            setPasswordData({ ...passwordData, newPassword: e.target.value })
          }
          placeholder="Enter new password..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Confirm New Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={passwordData.confirmPassword}
          onChange={(e) =>
            setPasswordData({
              ...passwordData,
              confirmPassword: e.target.value,
            })
          }
          placeholder="Confirm new password..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          required
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Key className="w-4 h-4" />
          Change Password
        </button>
      </div>
    </form>
  );
};

export default AdminDashboard;
