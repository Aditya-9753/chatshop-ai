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
  const [activeTab, setActiveTab] = useState("overview");
  const { success, error } = useToast();
  const { logout } = useAuth();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, filterPlan, filterStatus, currentPage]);

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

  const openMessageModal = (user) => {
    setSelectedUser({ user });
    setMessageData({ subject: "", message: "" });
    setIsMessageModalOpen(true);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageData.subject || !messageData.message) {
      error("Please fill in all fields");
      return;
    }

    try {
      // Simulate API call - in real implementation, this would send email/notification
      await new Promise((resolve) => setTimeout(resolve, 1500));

      success(`Message sent successfully to ${selectedUser.user?.name}`);
      setIsMessageModalOpen(false);
      setMessageData({ subject: "", message: "" });
    } catch (err) {
      error(err.message || "Failed to send message");
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

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            System Overview & User Management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExportUsers}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Users
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.users?.total}
          icon={Users}
          color="text-blue-600"
          subtitle={`${stats.users?.active} active users`}
        />
        <StatCard
          title="Premium Users"
          value={stats.users?.premium}
          icon={Award}
          color="text-purple-600"
          subtitle={`${stats.users?.free} on free plan`}
        />
        <StatCard
          title="Total Revenue"
          value={`₹${stats.revenue?.total?.toLocaleString()}`}
          icon={DollarSign}
          color="text-green-600"
          subtitle="From subscriptions"
        />
        <StatCard
          title="Recent Signups"
          value={stats.users?.recentSignups}
          icon={TrendingUp}
          color="text-indigo-600"
          subtitle="Last 7 days"
        />
      </div>

      {/* Subscription Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Starter Plan</h3>
            <Package className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{stats.subscriptions?.starter}</p>
          <p className="text-sm opacity-90 mt-1">₹499/month users</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Business Plan</h3>
            <ShoppingBag className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{stats.subscriptions?.business}</p>
          <p className="text-sm opacity-90 mt-1">₹999/month users</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Premium Plan</h3>
            <Award className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-3xl font-bold">{stats.subscriptions?.premium}</p>
          <p className="text-sm opacity-90 mt-1">₹1999/month users</p>
        </div>
      </div>

      {/* Platform & Entities Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Connections */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Platform Connections
          </h2>
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
                {stats.platforms?.whatsapp}
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-pink-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                  <Activity className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Instagram</p>
                  <p className="text-sm text-gray-600">Connected Users</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-pink-600">
                {stats.platforms?.instagram}
              </p>
            </div>
          </div>
        </div>

        {/* System Entities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            System Wide Data
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <Users className="w-8 h-8 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats.entities?.customers?.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Customers</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <ShoppingBag className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats.entities?.orders?.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Orders</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <Package className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats.entities?.products?.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Products</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <MessageSquare className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {stats.entities?.messages?.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Messages</p>
            </div>
          </div>
        </div>
      </div>

      {/* User Management Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Filter by Plan */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filterPlan}
                onChange={(e) => {
                  setFilterPlan(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none bg-white cursor-pointer"
              >
                <option value="all">All Plans</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="business">Business</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            {/* Filter by Status */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none bg-white cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-3">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No users found</p>
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      User Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-semibold text-sm">
                              {user.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {user.name}
                            </p>
                            {user.role === "admin" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                                <Shield className="w-3 h-3" />
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm space-y-1">
                          <div className="flex items-center gap-2 text-gray-900">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span>{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            user.subscription?.plan === "premium"
                              ? "bg-amber-100 text-amber-800"
                              : user.subscription?.plan === "business"
                              ? "bg-purple-100 text-purple-800"
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
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            user.subscription?.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
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
                        {new Date(user.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => viewUserDetails(user)}
                            className="p-2 hover:bg-indigo-50 rounded-lg transition-colors group"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={() => openMessageModal(user)}
                            className="p-2 hover:bg-green-50 rounded-lg transition-colors group"
                            title="Send Message"
                          >
                            <Send className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" />
                          </button>
                          {user.role !== "admin" && (
                            <button
                              onClick={() => handleDeleteUser(user._id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 group-hover:scale-110 transition-transform" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="User Details"
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* User Information */}
            {/* User Information */}
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
                    <p className="text-xs font-semibold text-gray-600">
                      Email Address
                    </p>
                  </div>
                  <p className="text-sm text-gray-900">
                    {selectedUser.user?.email || "Not provided"}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <p className="text-xs font-semibold text-gray-600">
                      Phone Number
                    </p>
                  </div>
                  <p className="text-sm text-gray-900">
                    {selectedUser.user?.phone || "Not provided"}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    Subscription Plan
                  </p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedUser.user?.subscription?.plan === "premium"
                        ? "bg-amber-100 text-amber-800"
                        : selectedUser.user?.subscription?.plan === "business"
                        ? "bg-purple-100 text-purple-800"
                        : selectedUser.user?.subscription?.plan === "starter"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {selectedUser.user?.subscription?.plan?.toUpperCase() ||
                      "FREE"}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">
                    Status
                  </p>
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

            {/* User Activity Statistics */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Activity Statistics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <Users className="w-6 h-6 text-blue-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedUser.stats?.customers || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Customers</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <ShoppingBag className="w-6 h-6 text-green-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedUser.stats?.orders || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Orders</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <Package className="w-6 h-6 text-purple-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedUser.stats?.products || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Products</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <DollarSign className="w-6 h-6 text-amber-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{selectedUser.stats?.revenue?.toLocaleString() || 0}
                  </p>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Account Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Member Since</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedUser.user?.createdAt).toLocaleDateString(
                      "en-IN",
                      {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Email Verified</p>
                  <p className="font-semibold text-gray-900">
                    {selectedUser.user?.isVerified ? (
                      <span className="text-green-600">✓ Yes</span>
                    ) : (
                      <span className="text-red-600">✗ No</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Close
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    openMessageModal(selectedUser.user);
                  }}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
                {selectedUser.user?.role !== "admin" && (
                  <button
                    onClick={() => handleDeleteUser(selectedUser.user._id)}
                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete User
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Send Message Modal */}
      <Modal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        title="Send Message to User"
        size="md"
      >
        {selectedUser && (
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
                  <p className="text-sm text-gray-600">
                    {selectedUser.user?.email}
                  </p>
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
              <p className="text-xs text-gray-500 mt-2">
                📧 This message will be sent to the user via email notification
                from ChatShop-AI Company
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsMessageModalOpen(false)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Message
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;
