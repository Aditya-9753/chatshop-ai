import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingBag,
  MessageSquare,
  Instagram,
  MessageCircle,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  RefreshCw,
} from "lucide-react";
import analyticsService from "../services/analytics.service";
import { useToast } from "../components/Toast";

const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [customerData, setCustomerData] = useState(null);
  const [messageData, setMessageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("week");
  const { error, success } = useToast();

  useEffect(() => {
    fetchAllAnalytics();
  }, [dateRange]);

  const fetchAllAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch all analytics data in parallel
      const [dashboardRes, revenueRes, customerRes, messageRes] =
        await Promise.all([
          analyticsService.getDashboardStats(),
          analyticsService.getRevenueAnalytics(dateRange),
          analyticsService.getCustomerAnalytics(),
          analyticsService.getMessageAnalytics(dateRange),
        ]);

      if (dashboardRes.success) setStats(dashboardRes.data);
      if (revenueRes.success) setRevenueData(revenueRes.data);
      if (customerRes.success) setCustomerData(customerRes.data);
      if (messageRes.success) setMessageData(messageRes.data);
    } catch (err) {
      error(err.message || "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    success("Refreshing data...");
    fetchAllAnalytics();
  };

  const handleExport = () => {
    success("Exporting data...");
    // TODO: Implement export functionality
  };

  // Prepare chart data
  const platformData = [
    {
      name: "WhatsApp",
      customers: stats?.whatsappCustomers || 0,
      color: "#10b981",
    },
    {
      name: "Instagram",
      customers: stats?.instagramCustomers || 0,
      color: "#ec4899",
    },
  ];

  // Calculate growth percentages
  const calculateGrowth = (current, previous) => {
    if (!previous) return 0;
    return (((current - previous) / previous) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Track your business performance and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm font-medium"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
          </select>
          <button
            onClick={handleRefresh}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards - Updated Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />
              +12.5%
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">
            ₹{(stats?.totalRevenue || 0).toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            vs last {dateRange === "today" ? "day" : dateRange}
          </p>
        </div>

        {/* Total Orders Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />
              +8.2%
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.totalOrders || 0}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {stats?.todayOrders || 0} orders today
          </p>
        </div>

        {/* Total Customers Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />
              +15.3%
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.totalCustomers || 0}
          </p>
          <p className="text-xs text-gray-500 mt-2">Across all platforms</p>
        </div>

        {/* Total Messages Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" />
              +5.7%
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Messages</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.totalMessages || 0}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {stats?.todayMessages || 0} messages today
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Revenue Trend</h3>
              <p className="text-sm text-gray-500">Daily revenue over time</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="_id"
                stroke="#9ca3af"
                style={{ fontSize: "12px" }}
              />
              <YAxis stroke="#9ca3af" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Platform Distribution Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Platform Distribution
              </h3>
              <p className="text-sm text-gray-500">Customers by platform</p>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="customers"
                >
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            {platformData.map((platform, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: platform.color }}
                />
                <span className="text-sm text-gray-700">
                  {platform.name}:{" "}
                  <span className="font-semibold">{platform.customers}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Customers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Top Customers</h3>
            <p className="text-sm text-gray-500">Highest spending customers</p>
          </div>
          <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
            View All
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                  Customer
                </th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                  Platform
                </th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                  Orders
                </th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                  Total Spent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customerData?.topCustomers
                ?.slice(0, 5)
                .map((customer, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {customer.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {customer.name || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {customer.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          customer.platform === "whatsapp"
                            ? "bg-green-100 text-green-700"
                            : "bg-pink-100 text-pink-700"
                        }`}
                      >
                        {customer.platform === "whatsapp" ? (
                          <MessageCircle className="w-3 h-3" />
                        ) : (
                          <Instagram className="w-3 h-3" />
                        )}
                        {customer.platform}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-sm font-medium text-gray-900">
                        {customer.totalOrders || 0}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-sm font-bold text-gray-900">
                        ₹{(customer.totalSpent || 0).toLocaleString("en-IN")}
                      </span>
                    </td>
                  </tr>
                )) || (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-gray-500">
                    No customer data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Platform Status
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">WhatsApp</span>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  stats?.whatsappConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {stats?.whatsappConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Instagram className="w-5 h-5 text-pink-600" />
                <span className="text-sm text-gray-700">Instagram</span>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  stats?.instagramConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {stats?.instagramConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>

        {/* Subscription Info */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <h4 className="text-sm font-semibold mb-4 opacity-90">
            Current Plan
          </h4>
          <p className="text-2xl font-bold mb-2 capitalize">
            {stats?.subscription?.plan || "Free"}
          </p>
          <p className="text-sm opacity-80">
            {stats?.subscription?.status === "active"
              ? "Active until " +
                new Date(stats.subscription.endDate).toLocaleDateString()
              : "No active subscription"}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Quick Actions
          </h4>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              View All Orders
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              Manage Customers
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              Send Broadcast
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
