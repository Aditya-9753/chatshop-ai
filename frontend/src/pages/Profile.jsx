import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import api from "../services/api.service";
import { API_ENDPOINTS } from "../config/api.config";
import {
  Camera,
  User,
  Mail,
  Phone,
  Building,
  Crown,
  Calendar,
  Check,
  ArrowLeft,
  Shield,
  Zap,
  Star,
} from "lucide-react";

const Profile = () => {
  const { user, updateUser } = useAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    businessName: user?.businessInfo?.businessName || "",
  });

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(
    user?.profilePhoto ? `http://localhost:5000${user.profilePhoto}` : null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

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
      setIsEditing(true);
    }
  };

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let response;

      // If profile photo is selected, use FormData
      if (profilePhoto) {
        const formData = new FormData();
        formData.append("name", profileForm.name);
        formData.append("email", profileForm.email);
        formData.append("phone", profileForm.phone || "");
        formData.append("businessName", profileForm.businessName || "");
        formData.append("profilePhoto", profilePhoto);

        response = await api.put(API_ENDPOINTS.USER.UPDATE_PROFILE, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        // No photo, send as regular JSON
        response = await api.put(API_ENDPOINTS.USER.UPDATE_PROFILE, {
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone || "",
          businessName: profileForm.businessName || "",
        });
      }

      if (response.success) {
        // Update user in context
        updateUser(response.data);

        alert("Profile updated successfully!");
        setIsEditing(false);
        setProfilePhoto(null);

        // Update form with new data
        setProfileForm({
          name: response.data.name || "",
          email: response.data.email || "",
          phone: response.data.phone || "",
          businessName: response.data.businessInfo?.businessName || "",
        });

        // Update photo preview if new photo was uploaded
        if (response.data.profilePhoto) {
          setProfilePhotoPreview(
            `http://localhost:5000${response.data.profilePhoto}`
          );
        }
      }
    } catch (error) {
      console.error("Profile update error:", error);
      alert(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // Calculate subscription details
  const getDaysRemaining = () => {
    if (!user?.subscription?.endDate) return 0;
    const end = new Date(user.subscription.endDate);
    const now = new Date();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysRemaining = getDaysRemaining();

  const planFeatures = {
    free: [
      "Basic WhatsApp Integration",
      "Up to 100 messages/month",
      "Basic Analytics",
      "Email Support",
    ],
    starter: [
      "WhatsApp & Instagram Integration",
      "Up to 1,000 messages/month",
      "Advanced Analytics",
      "Email & Chat Support",
      "Custom Templates",
    ],
    business: [
      "WhatsApp & Instagram Integration",
      "Up to 10,000 messages/month",
      "Advanced Analytics & Reports",
      "Priority Support",
      "Custom Templates",
      "AI-Powered Responses",
      "Multi-User Access",
    ],
    premium: [
      "WhatsApp & Instagram Integration",
      "Unlimited Messages",
      "Advanced Analytics & Reports",
      "24/7 Priority Support",
      "Custom Templates",
      "AI-Powered Responses",
      "Multi-User Access",
      "API Access",
      "White Label Options",
      "Dedicated Account Manager",
    ],
  };

  const currentPlan = user?.subscription?.plan || "free";
  const features = planFeatures[currentPlan] || planFeatures.free;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className={`p-2 rounded-lg transition-colors ${
            isDarkMode
              ? "hover:bg-gray-700 text-gray-300"
              : "hover:bg-gray-100 text-gray-600"
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1
            className={`text-3xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            My Profile
          </h1>
          <p
            className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
          >
            Manage your account and subscription
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div
            className={`rounded-xl shadow-sm border p-6 ${
              isDarkMode
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
            }`}
          >
            <h2
              className={`text-xl font-bold mb-6 ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Profile Information
            </h2>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Profile Photo */}
              <div className="flex items-center gap-6">
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
                <div>
                  <h3
                    className={`text-lg font-semibold ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {user?.name}
                  </h3>
                  <p
                    className={`text-sm ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`}
                  >
                    {user?.email}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      isDarkMode ? "text-gray-500" : "text-gray-400"
                    }`}
                  >
                    Member since{" "}
                    {new Date(user?.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <User className="w-4 h-4 inline mr-2" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => {
                      setProfileForm({ ...profileForm, name: e.target.value });
                      setIsEditing(true);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => {
                      setProfileForm({
                        ...profileForm,
                        email: e.target.value,
                      });
                      setIsEditing(true);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <Phone className="w-4 h-4 inline mr-2" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => {
                      setProfileForm({
                        ...profileForm,
                        phone: e.target.value,
                      });
                      setIsEditing(true);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                    placeholder="+91 9876543210"
                  />
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    <Building className="w-4 h-4 inline mr-2" />
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.businessName}
                    onChange={(e) => {
                      setProfileForm({
                        ...profileForm,
                        businessName: e.target.value,
                      });
                      setIsEditing(true);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                    placeholder="Your Business Name"
                  />
                </div>
              </div>

              {/* Save Button */}
              {isEditing && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileForm({
                        name: user?.name || "",
                        email: user?.email || "",
                        phone: user?.phone || "",
                        businessName: user?.businessName || "",
                      });
                      setProfilePhotoPreview(user?.profilePhoto || null);
                      setIsEditing(false);
                    }}
                    className={`px-6 py-2 border rounded-lg transition-colors ${
                      isDarkMode
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              {currentPlan === "premium" ? (
                <Crown className="w-8 h-8 text-yellow-300" />
              ) : currentPlan === "business" ? (
                <Star className="w-8 h-8 text-blue-300" />
              ) : (
                <Zap className="w-8 h-8 text-gray-300" />
              )}
              <div>
                <h3 className="text-2xl font-bold capitalize">{currentPlan}</h3>
                <p className="text-sm text-indigo-100">Current Plan</p>
              </div>
            </div>

            {user?.subscription?.status === "active" && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-indigo-100">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Days Remaining
                  </span>
                  <span className="text-xl font-bold">{daysRemaining}</span>
                </div>

                <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (daysRemaining / 365) * 100)}%`,
                    }}
                  ></div>
                </div>

                <p className="text-xs text-indigo-100 mb-4">
                  Expires on{" "}
                  {new Date(user.subscription.endDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </p>
              </>
            )}

            {user?.subscription?.status !== "active" && (
              <div className="bg-red-500/20 border border-red-300 rounded-lg p-3 mb-4">
                <p className="text-sm">⚠️ Your subscription has expired</p>
              </div>
            )}

            <button
              onClick={() => navigate("/pricing")}
              className="w-full px-4 py-2 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
            >
              {currentPlan === "premium" ? "Renew Plan" : "Upgrade Plan"}
            </button>
          </div>

          {/* Plan Features */}
          <div
            className={`rounded-xl shadow-sm border p-6 ${
              isDarkMode
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-100"
            }`}
          >
            <h3
              className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              <Shield className="w-5 h-5 text-indigo-600" />
              Plan Features
            </h3>
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span
                    className={isDarkMode ? "text-gray-300" : "text-gray-700"}
                  >
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Stats */}
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
              Account Stats
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  WhatsApp
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    user?.whatsappConnected
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {user?.whatsappConnected ? "Connected" : "Not Connected"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Instagram
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    user?.instagramConnected
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {user?.instagramConnected ? "Connected" : "Not Connected"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm ${
                    isDarkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Email Verified
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    user?.isVerified
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {user?.isVerified ? "Verified" : "Pending"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
