import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import SubscriptionBadge from "../components/SubscriptionBadge";
import Modal from "../components/Modal";
import api from "../services/api.service";
import { API_ENDPOINTS } from "../config/api.config";
import {
  Users,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  Crown,
  Zap,
  Camera,
  Edit,
} from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Form states
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    platform: "whatsapp",
  });

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
  });

  const [productImage, setProductImage] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState(null);

  const [orderForm, setOrderForm] = useState({
    customerId: "",
    products: [],
    totalAmount: "",
  });

  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    businessName: user?.businessName || "",
  });

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(
    user?.profilePhoto ? `http://localhost:5000${user.profilePhoto}` : null
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.ANALYTICS.DASHBOARD);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle Customer Creation
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(
        API_ENDPOINTS.CUSTOMERS.CREATE,
        customerForm
      );
      if (response.success) {
        alert("Customer added successfully!");
        setShowCustomerModal(false);
        setCustomerForm({
          name: "",
          email: "",
          phone: "",
          platform: "whatsapp",
        });
        fetchDashboardData();
      }
    } catch (error) {
      alert(error.message || "Failed to add customer");
    }
  };

  // Handle Product Image Change
  const handleProductImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProductImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Product Creation
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      let response;

      if (productImage) {
        const formData = new FormData();
        formData.append("name", productForm.name);
        formData.append("description", productForm.description);
        formData.append("price", productForm.price);
        formData.append("stock", productForm.stock);
        formData.append("category", productForm.category);
        formData.append("image", productImage);

        response = await api.post(API_ENDPOINTS.PRODUCTS.CREATE, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        response = await api.post(API_ENDPOINTS.PRODUCTS.CREATE, {
          ...productForm,
          price: parseFloat(productForm.price),
          stock: parseInt(productForm.stock),
        });
      }

      if (response.success) {
        alert("Product added successfully!");
        setShowProductModal(false);
        setProductForm({
          name: "",
          description: "",
          price: "",
          stock: "",
          category: "",
        });
        setProductImage(null);
        setProductImagePreview(null);
        fetchDashboardData();
      }
    } catch (error) {
      alert(error.message || "Failed to add product");
    }
  };

  // Handle Profile Photo Change
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", profileForm.name);
      formData.append("email", profileForm.email);
      formData.append("phone", profileForm.phone);
      formData.append("businessName", profileForm.businessName);

      if (profilePhoto) {
        formData.append("profilePhoto", profilePhoto);
      }

      const response = await api.put(
        API_ENDPOINTS.USER.UPDATE_PROFILE,
        profileForm
      );
      if (response.success) {
        alert("Profile updated successfully!");
        setShowProfileModal(false);
        window.location.reload(); // Reload to update user data
      }
    } catch (error) {
      alert(error.message || "Failed to update profile");
    }
  };

  // Open profile modal and populate form
  const openProfileModal = () => {
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      businessName: user?.businessName || "",
    });
    setProfilePhotoPreview(user?.profilePhoto || null);
    setShowProfileModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Customers",
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: "bg-blue-500",
      bgLight: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      title: "Total Messages",
      value: stats?.totalMessages || 0,
      icon: MessageSquare,
      color: "bg-green-500",
      bgLight: "bg-green-50",
      textColor: "text-green-600",
    },
    {
      title: "Orders & Invoices",
      value: stats?.totalOrders || 0,
      icon: ShoppingCart,
      color: "bg-purple-500",
      bgLight: "bg-purple-50",
      textColor: "text-purple-600",
    },
    {
      title: "Total Revenue",
      value: `₹${stats?.totalRevenue?.toLocaleString("en-IN") || 0}`,
      icon: DollarSign,
      color: "bg-indigo-500",
      bgLight: "bg-indigo-50",
      textColor: "text-indigo-600",
    },
    {
      title: "Products",
      value: stats?.totalProducts || 0,
      icon: Package,
      color: "bg-pink-500",
      bgLight: "bg-pink-50",
      textColor: "text-pink-600",
    },
    {
      title: "Conversion Rate",
      value: `${stats?.conversionRate || 0}%`,
      icon: TrendingUp,
      color: "bg-orange-500",
      bgLight: "bg-orange-50",
      textColor: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 opacity-10">
          <div className="w-48 h-48 rounded-full bg-white -mr-24 -mt-24"></div>
        </div>
        <div className="absolute bottom-0 left-0 opacity-10">
          <div className="w-32 h-32 rounded-full bg-white -ml-16 -mb-16"></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">👋</span>
            <h1 className="text-2xl md:text-3xl font-bold">
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return "Good Morning";
                if (hour < 18) return "Good Afternoon";
                return "Good Evening";
              })()}
              , {user?.name?.split(" ")[0]}!
            </h1>
          </div>
          <p className="text-indigo-100 text-sm md:text-base">
            Welcome to your dashboard. Here's what's happening with your
            business today.
          </p>
          {user?.businessName && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors">
              <span className="text-xs md:text-sm font-semibold">
                📊 {user.businessName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Status Card */}
      {user?.subscription && (
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-xl shadow-xl p-6 text-white relative overflow-hidden">
          {/* Animated background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -ml-24 -mb-24"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {user.subscription.plan === "premium" ? (
                    <Crown className="w-7 h-7 text-yellow-300" />
                  ) : user.subscription.plan === "business" ? (
                    <Zap className="w-7 h-7 text-blue-300" />
                  ) : (
                    <Zap className="w-7 h-7 text-gray-300" />
                  )}
                  <h2 className="text-xl md:text-2xl font-bold capitalize">
                    {user.subscription.plan} Plan
                  </h2>
                </div>
                <p className="text-indigo-100 mb-2 text-sm md:text-base">
                  {user.subscription.status === "active"
                    ? "Your subscription is active and all features are unlocked"
                    : "Your subscription has expired"}
                </p>
                {user.subscription.status === "active" &&
                  user.subscription.endDate && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                      <span className="text-xs font-medium">
                        ⏰{" "}
                        {Math.ceil(
                          (new Date(user.subscription.endDate) - new Date()) /
                            (1000 * 60 * 60 * 24)
                        )}{" "}
                        days remaining
                      </span>
                    </div>
                  )}
              </div>
              {user.subscription.plan !== "premium" && (
                <button className="px-5 py-2 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-all hover:scale-105 text-sm">
                  Upgrade Plan
                </button>
              )}
            </div>

            {/* Feature List */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>WhatsApp Integration</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Instagram Integration</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span>Analytics Dashboard</span>
              </div>
              {user.subscription.plan === "premium" && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span>Unlimited Products</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span>Priority Support</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <span>Advanced Automation</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div
        className={`rounded-2xl shadow-sm p-6 md:p-8 border ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-100"
        }`}
      >
        <h2
          className={`text-xl md:text-2xl font-bold mb-6 ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setShowCustomerModal(true)}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all group hover:scale-105 ${
              isDarkMode
                ? "border-gray-700 hover:border-indigo-500 hover:bg-indigo-900/30"
                : "border-gray-200 hover:border-indigo-500 hover:bg-indigo-50"
            }`}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors ${
                isDarkMode
                  ? "bg-blue-900/40 text-blue-400"
                  : "bg-blue-100 text-blue-600"
              }`}
            >
              <Users className="w-7 h-7" />
            </div>
            <span
              className={`text-sm font-semibold transition-colors ${
                isDarkMode
                  ? "text-gray-300 group-hover:text-indigo-400"
                  : "text-gray-700 group-hover:text-indigo-600"
              }`}
            >
              Add Customer
            </span>
          </button>

          <button
            onClick={() => setShowProductModal(true)}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all group hover:scale-105 ${
              isDarkMode
                ? "border-gray-700 hover:border-green-500 hover:bg-green-900/30"
                : "border-gray-200 hover:border-green-500 hover:bg-green-50"
            }`}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors ${
                isDarkMode
                  ? "bg-green-900/40 text-green-400"
                  : "bg-green-100 text-green-600"
              }`}
            >
              <Package className="w-7 h-7" />
            </div>
            <span
              className={`text-sm font-semibold transition-colors ${
                isDarkMode
                  ? "text-gray-300 group-hover:text-green-400"
                  : "text-gray-700 group-hover:text-green-600"
              }`}
            >
              Add Product
            </span>
          </button>

          <button
            onClick={() => setShowOrderModal(true)}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all group hover:scale-105 ${
              isDarkMode
                ? "border-gray-700 hover:border-purple-500 hover:bg-purple-900/30"
                : "border-gray-200 hover:border-purple-500 hover:bg-purple-50"
            }`}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors ${
                isDarkMode
                  ? "bg-purple-900/40 text-purple-400"
                  : "bg-purple-100 text-purple-600"
              }`}
            >
              <ShoppingCart className="w-7 h-7" />
            </div>
            <span
              className={`text-sm font-semibold transition-colors ${
                isDarkMode
                  ? "text-gray-300 group-hover:text-purple-400"
                  : "text-gray-700 group-hover:text-purple-600"
              }`}
            >
              Create Order
            </span>
          </button>

          <button
            onClick={() => navigate("/dashboard/messages")}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all group hover:scale-105 ${
              isDarkMode
                ? "border-gray-700 hover:border-pink-500 hover:bg-pink-900/30"
                : "border-gray-200 hover:border-pink-500 hover:bg-pink-50"
            }`}
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition-colors ${
                isDarkMode
                  ? "bg-pink-900/40 text-pink-400"
                  : "bg-pink-100 text-pink-600"
              }`}
            >
              <MessageSquare className="w-7 h-7" />
            </div>
            <span
              className={`text-sm font-semibold transition-colors ${
                isDarkMode
                  ? "text-gray-300 group-hover:text-pink-400"
                  : "text-gray-700 group-hover:text-pink-600"
              }`}
            >
              Send Message
            </span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`rounded-2xl shadow-sm border p-6 hover:shadow-lg transition-all cursor-pointer group ${
                isDarkMode
                  ? "bg-gray-800 border-gray-700 hover:border-indigo-500"
                  : "bg-white border-gray-100 hover:border-indigo-200"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`${stat.bgLight} p-4 rounded-xl group-hover:scale-110 transition-transform`}
                >
                  <Icon className={`w-8 h-8 ${stat.textColor}`} />
                </div>
              </div>
              <p
                className={`text-sm font-semibold mb-2 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {stat.title}
              </p>
              <p
                className={`text-3xl md:text-4xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className={`rounded-xl shadow-sm border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-100"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            WhatsApp Status
          </h3>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                user?.whatsappConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
              {user?.whatsappConnected ? "Connected" : "Not Connected"}
            </span>
          </div>
          {!user?.whatsappConnected && (
            <button
              onClick={() => navigate("/settings")}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Connect WhatsApp
            </button>
          )}
        </div>

        <div
          className={`rounded-xl shadow-sm border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-100"
          }`}
        >
          <h3
            className={`text-lg font-bold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Instagram Status
          </h3>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                user?.instagramConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
              {user?.instagramConnected ? "Connected" : "Not Connected"}
            </span>
          </div>
          {!user?.instagramConnected && (
            <button
              onClick={() => navigate("/settings")}
              className="mt-4 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
            >
              Connect Instagram
            </button>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div
        className={`rounded-xl shadow-sm border p-6 ${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-100"
        }`}
      >
        <h2
          className={`text-xl font-bold mb-4 ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Recent Activity
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`flex items-center gap-4 p-4 rounded-lg ${
                isDarkMode ? "bg-gray-700/50" : "bg-gray-50"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDarkMode
                    ? "bg-indigo-900/40 text-indigo-400"
                    : "bg-indigo-100 text-indigo-600"
                }`}
              >
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    isDarkMode ? "text-gray-200" : "text-gray-900"
                  }`}
                >
                  New message from customer
                </p>
                <p
                  className={`text-xs ${
                    isDarkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  2 hours ago
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title="Add New Customer"
        size="md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={customerForm.name}
              onChange={(e) =>
                setCustomerForm({ ...customerForm, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={customerForm.email}
              onChange={(e) =>
                setCustomerForm({ ...customerForm, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone *
            </label>
            <input
              type="tel"
              required
              value={customerForm.phone}
              onChange={(e) =>
                setCustomerForm({ ...customerForm, phone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="+91 9876543210"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Platform *
            </label>
            <select
              value={customerForm.platform}
              onChange={(e) =>
                setCustomerForm({ ...customerForm, platform: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCustomerModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Product Modal */}
      <Modal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title="Add New Product"
        size="md"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={productForm.name}
              onChange={(e) =>
                setProductForm({ ...productForm, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={productForm.description}
              onChange={(e) =>
                setProductForm({ ...productForm, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Product description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (₹) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={productForm.price}
                onChange={(e) =>
                  setProductForm({ ...productForm, price: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock *
              </label>
              <input
                type="number"
                required
                min="0"
                value={productForm.stock}
                onChange={(e) =>
                  setProductForm({ ...productForm, stock: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={productForm.category}
              onChange={(e) =>
                setProductForm({ ...productForm, category: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., Electronics, Fashion"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowProductModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Add Product
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Edit Profile"
        size="md"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold overflow-hidden">
                {profilePhotoPreview ? (
                  <img
                    src={profilePhotoPreview}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user?.name?.charAt(0).toUpperCase()
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click camera icon to upload photo
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={profileForm.name}
              onChange={(e) =>
                setProfileForm({ ...profileForm, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={profileForm.email}
              onChange={(e) =>
                setProfileForm({ ...profileForm, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) =>
                setProfileForm({ ...profileForm, phone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="+91 9876543210"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name
            </label>
            <input
              type="text"
              value={profileForm.businessName}
              onChange={(e) =>
                setProfileForm({ ...profileForm, businessName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Your Business Name"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;
