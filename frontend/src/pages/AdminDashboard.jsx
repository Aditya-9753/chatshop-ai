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
} from "lucide-react";
import adminService from "../services/admin.service";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageData, setMessageData] = useState({ subject: "", message: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { success, error } = useToast();
  const { logout } = useAuth();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (activeSection === "users") {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 500);
      return () => clearTimeout(timer);
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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await adminService.getAllUsers({
        search: searchTerm,
        page: currentPage,
        limit: 10,
      });
      if (response.success) {
        setUsers(response.data || []);
        setTotalPages(Math.ceil((response.total || 0) / 10));
      }
    } catch (err) {
      error(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardStats();
    fetchUsers();
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

  // Filter users based on plan and status
  const filteredUsers = users.filter((user) => {
    const planMatch =
      filterPlan === "all" ||
      (user.subscription?.plan || "free") === filterPlan;
    const statusMatch =
      filterStatus === "all" ||
      (user.subscription?.status || "inactive") === filterStatus;
    return planMatch && statusMatch;
  });

  // Mask sensitive data for privacy
  const maskEmail = (email) => {
    if (!email) return "N/A";
    const [name, domain] = email.split("@");
    const maskedName =
      name.length > 2
        ? name.substring(0, 2) + "*".repeat(name.length - 2)
        : name;
    return `${maskedName}@${domain}`;
  };

  const maskPhone = (phone) => {
    if (!phone) return "N/A";
    return `${phone.substring(0, 2)}${"*".repeat(
      phone.length - 4
    )}${phone.slice(-2)}`;
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Loading Admin Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Navigation - Google Admin Console Style */}
      <div
        className={`${
          sidebarCollapsed ? "w-20" : "w-64"
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shadow-lg`}
      >
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
                <p className="text-xs text-gray-500">ChatShop-AI</p>
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
                    ? "bg-indigo-50 text-indigo-700 font-medium shadow-sm"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                title={sidebarCollapsed ? item.label : ""}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    isActive
                      ? item.color
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
        <div className="p-4 border-t border-gray-200">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  Admin
                </p>
                <p className="text-xs text-gray-500">Super Admin</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className={`w-full flex items-center ${
              sidebarCollapsed ? "justify-center" : "gap-2"
            } px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors`}
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
        <div className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Layout className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {
                    navigationItems.find((item) => item.id === activeSection)
                      ?.label
                  }
                </h2>
                <p className="text-sm text-gray-500 mt-1">
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
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeSection === "overview" && (
            <OverviewSection
              stats={stats}
              handleExportUsers={handleExportUsers}
            />
          )}
          {activeSection === "users" && (
            <UsersSection
              users={users}
              filteredUsers={filteredUsers}
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
            />
          )}
          {activeSection === "analytics" && <AnalyticsSection stats={stats} />}
          {activeSection === "settings" && <SettingsSection />}
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
    </div>
  );
};

// ==================== SECTION COMPONENTS ====================

// Overview Section
const OverviewSection = ({ stats, handleExportUsers }) => {
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
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                  <h3 className="text-3xl font-bold text-gray-900 mb-2">
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
                    <span className="text-xs text-gray-500">vs last month</span>
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
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

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
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
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            System Wide Data
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <Users className="w-8 h-8 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats?.entities?.customers?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-gray-600">Total Customers</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <ShoppingBag className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats?.entities?.orders?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-gray-600">Total Orders</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <Package className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats?.entities?.products?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-gray-600">Total Products</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <MessageSquare className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats?.entities?.messages?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-gray-600">Total Messages</p>
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
  filteredUsers,
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
}) => {
  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterPlan}
              onChange={(e) => {
                setFilterPlan(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                      Plan
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
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
                          <p className="text-gray-900 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-gray-400" />
                            {user.email}
                          </p>
                          {user.phone && (
                            <p className="text-gray-600 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3 text-gray-400" />
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
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => viewUserDetails(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openMessageModal(user)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Send Message"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          {user.role !== "admin" && (
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
const AnalyticsSection = ({ stats }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">User Growth</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <TrendingUp className="w-12 h-12 mr-3" />
            <span>Chart visualization - Integration ready</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Revenue Trends
          </h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <BarChart3 className="w-12 h-12 mr-3" />
            <span>Chart visualization - Integration ready</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Platform Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
            <MessageSquare className="w-8 h-8 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {stats?.platforms?.whatsapp || 0}
            </p>
            <p className="text-sm text-gray-600">WhatsApp Users</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg">
            <Smartphone className="w-8 h-8 text-pink-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {stats?.platforms?.instagram || 0}
            </p>
            <p className="text-sm text-gray-600">Instagram Users</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
            <ShoppingBag className="w-8 h-8 text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {stats?.entities?.orders || 0}
            </p>
            <p className="text-sm text-gray-600">Total Orders</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg">
            <Users className="w-8 h-8 text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {stats?.entities?.customers || 0}
            </p>
            <p className="text-sm text-gray-600">Total Customers</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Section
const SettingsSection = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            General Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Name
              </label>
              <input
                type="text"
                defaultValue="ChatShop-AI"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Email
              </label>
              <input
                type="email"
                defaultValue="support@chatshop-ai.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Save Changes
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Security Settings
          </h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium">
                  Change Admin Password
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium">
                  Two-Factor Authentication
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium">Security Audit Logs</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
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

export default AdminDashboard;
