import React, { useState, useContext } from "react";
import {
  User,
  MessageCircle,
  Instagram,
  Facebook,
  Building,
  Save,
  Key,
  Bell,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Button from "../components/Button";
import Input from "../components/Input";
import { useToast } from "../components/Toast";
import api from "../services/api.service";

const Settings = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");
  const { success, error } = useToast();

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  // WhatsApp connection
  const [whatsappForm, setWhatsappForm] = useState({
    phoneNumber: "",
    accessToken: "",
    phoneNumberId: "",
    businessAccountId: "",
  });

  // Instagram connection
  const [instagramForm, setInstagramForm] = useState({
    username: "",
    accessToken: "",
    businessAccountId: "",
  });

  // Facebook connection
  const [facebookForm, setFacebookForm] = useState({
    pageName: "",
    pageId: "",
    accessToken: "",
  });

  // Business info
  const [businessForm, setBusinessForm] = useState({
    businessName: "",
    businessEmail: "",
    businessPhone: "",
    address: "",
    website: "",
    description: "",
  });

  // Password change
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put("/users/profile", profileForm);
      if (response.success) {
        success("Profile updated successfully");
      }
    } catch (err) {
      error(err.message || "Failed to update profile");
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      error("Passwords do not match");
      return;
    }
    try {
      const response = await api.put("/users/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      if (response.success) {
        success("Password changed successfully");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (err) {
      error(err.message || "Failed to change password");
    }
  };

  const handleWhatsAppConnect = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/whatsapp/connect", whatsappForm);
      if (response.success) {
        success("WhatsApp connected successfully");
      }
    } catch (err) {
      error(err.message || "Failed to connect WhatsApp");
    }
  };

  const handleInstagramConnect = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/instagram/connect", instagramForm);
      if (response.success) {
        success("Instagram connected successfully");
      }
    } catch (err) {
      error(err.message || "Failed to connect Instagram");
    }
  };

  const handleFacebookConnect = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/facebook/connect", facebookForm);
      if (response.success) {
        success("Facebook connected successfully");
      }
    } catch (err) {
      error(err.message || "Failed to connect Facebook");
    }
  };

  const handleBusinessUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put("/users/business", businessForm);
      if (response.success) {
        success("Business information updated successfully");
      }
    } catch (err) {
      error(err.message || "Failed to update business info");
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "instagram", label: "Instagram", icon: Instagram },
    { id: "facebook", label: "Facebook", icon: Facebook },
    { id: "business", label: "Business Info", icon: Building },
    { id: "security", label: "Security", icon: Key },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className={`text-3xl font-bold ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Settings
        </h1>
        <p className={`mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Manage your account and integrations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tabs Sidebar */}
        <div
          className={`rounded-xl shadow-sm border p-4 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-100"
          }`}
        >
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? isDarkMode
                      ? "bg-indigo-900/50 text-indigo-400 font-semibold"
                      : "bg-indigo-50 text-indigo-600 font-semibold"
                    : isDarkMode
                    ? "text-gray-300 hover:bg-gray-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div
          className={`lg:col-span-3 rounded-xl shadow-sm border p-6 ${
            isDarkMode
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-100"
          }`}
        >
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div>
              <h2
                className={`text-2xl font-bold mb-6 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Profile Information
              </h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <Input
                  label="Full Name"
                  name="name"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, name: e.target.value })
                  }
                  placeholder="Your full name"
                  required
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, email: e.target.value })
                  }
                  placeholder="your@email.com"
                  required
                />
                <Input
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                  placeholder="+91 98765 43210"
                />
                <div className="pt-4">
                  <Button type="submit" icon={Save}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* WhatsApp Tab */}
          {activeTab === "whatsapp" && (
            <div>
              <h2
                className={`text-2xl font-bold mb-2 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                WhatsApp Business Integration
              </h2>
              <p
                className={`mb-6 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Connect your WhatsApp Business API to automate customer
                conversations
              </p>
              <form onSubmit={handleWhatsAppConnect} className="space-y-4">
                <Input
                  label="Business Phone Number"
                  name="phoneNumber"
                  value={whatsappForm.phoneNumber}
                  onChange={(e) =>
                    setWhatsappForm({
                      ...whatsappForm,
                      phoneNumber: e.target.value,
                    })
                  }
                  placeholder="+91 98765 43210"
                  required
                />
                <Input
                  label="Access Token"
                  name="accessToken"
                  type="password"
                  value={whatsappForm.accessToken}
                  onChange={(e) =>
                    setWhatsappForm({
                      ...whatsappForm,
                      accessToken: e.target.value,
                    })
                  }
                  placeholder="Enter your WhatsApp Business API token"
                  required
                />
                <Input
                  label="Phone Number ID"
                  name="phoneNumberId"
                  value={whatsappForm.phoneNumberId}
                  onChange={(e) =>
                    setWhatsappForm({
                      ...whatsappForm,
                      phoneNumberId: e.target.value,
                    })
                  }
                  placeholder="Your phone number ID from Meta"
                  required
                />
                <Input
                  label="Business Account ID"
                  name="businessAccountId"
                  value={whatsappForm.businessAccountId}
                  onChange={(e) =>
                    setWhatsappForm({
                      ...whatsappForm,
                      businessAccountId: e.target.value,
                    })
                  }
                  placeholder="Your WhatsApp Business Account ID"
                  required
                />
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> You need to register for WhatsApp
                    Business API through Meta Business Platform. Visit{" "}
                    <a
                      href="https://business.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Meta Business
                    </a>{" "}
                    to get started.
                  </p>
                </div>
                <div className="pt-4">
                  <Button type="submit" icon={MessageCircle}>
                    Connect WhatsApp
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Instagram Tab */}
          {activeTab === "instagram" && (
            <div>
              <h2
                className={`text-2xl font-bold mb-2 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Instagram Business Integration
              </h2>
              <p
                className={`mb-6 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Connect your Instagram Business account to manage DMs and
                comments
              </p>
              <form onSubmit={handleInstagramConnect} className="space-y-4">
                <Input
                  label="Instagram Username"
                  name="username"
                  value={instagramForm.username}
                  onChange={(e) =>
                    setInstagramForm({
                      ...instagramForm,
                      username: e.target.value,
                    })
                  }
                  placeholder="@yourbusiness"
                  required
                />
                <Input
                  label="Access Token"
                  name="accessToken"
                  type="password"
                  value={instagramForm.accessToken}
                  onChange={(e) =>
                    setInstagramForm({
                      ...instagramForm,
                      accessToken: e.target.value,
                    })
                  }
                  placeholder="Enter your Instagram Graph API token"
                  required
                />
                <Input
                  label="Business Account ID"
                  name="businessAccountId"
                  value={instagramForm.businessAccountId}
                  onChange={(e) =>
                    setInstagramForm({
                      ...instagramForm,
                      businessAccountId: e.target.value,
                    })
                  }
                  placeholder="Your Instagram Business Account ID"
                  required
                />
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                  <p className="text-sm text-pink-800">
                    <strong>Note:</strong> You need a professional Instagram
                    account connected to a Facebook Page. Visit{" "}
                    <a
                      href="https://developers.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Facebook Developers
                    </a>{" "}
                    to set up Instagram Graph API.
                  </p>
                </div>
                <div className="pt-4">
                  <Button type="submit" icon={Instagram}>
                    Connect Instagram
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Facebook Tab */}
          {activeTab === "facebook" && (
            <div>
              <h2
                className={`text-2xl font-bold mb-2 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Facebook Messenger Integration
              </h2>
              <p
                className={`mb-6 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Connect your Facebook Page to manage Messenger conversations
              </p>
              <form onSubmit={handleFacebookConnect} className="space-y-4">
                <Input
                  label="Facebook Page Name"
                  name="pageName"
                  value={facebookForm.pageName}
                  onChange={(e) =>
                    setFacebookForm({
                      ...facebookForm,
                      pageName: e.target.value,
                    })
                  }
                  placeholder="Your Business Page"
                  required
                />
                <Input
                  label="Page ID"
                  name="pageId"
                  value={facebookForm.pageId}
                  onChange={(e) =>
                    setFacebookForm({
                      ...facebookForm,
                      pageId: e.target.value,
                    })
                  }
                  placeholder="Your Facebook Page ID"
                  required
                />
                <Input
                  label="Page Access Token"
                  name="accessToken"
                  type="password"
                  value={facebookForm.accessToken}
                  onChange={(e) =>
                    setFacebookForm({
                      ...facebookForm,
                      accessToken: e.target.value,
                    })
                  }
                  placeholder="Enter your Facebook Page Access Token"
                  required
                />
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> You need a Facebook Page with
                    Messenger enabled. Visit{" "}
                    <a
                      href="https://developers.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Facebook Developers
                    </a>{" "}
                    to set up the Messenger Platform and get your Page Access
                    Token.
                  </p>
                </div>
                <div className="pt-4">
                  <Button type="submit" icon={Facebook}>
                    Connect Facebook
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Business Info Tab */}
          {activeTab === "business" && (
            <div>
              <h2
                className={`text-2xl font-bold mb-6 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Business Information
              </h2>
              <form onSubmit={handleBusinessUpdate} className="space-y-4">
                <Input
                  label="Business Name"
                  name="businessName"
                  value={businessForm.businessName}
                  onChange={(e) =>
                    setBusinessForm({
                      ...businessForm,
                      businessName: e.target.value,
                    })
                  }
                  placeholder="Your Business Name"
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Business Email"
                    name="businessEmail"
                    type="email"
                    value={businessForm.businessEmail}
                    onChange={(e) =>
                      setBusinessForm({
                        ...businessForm,
                        businessEmail: e.target.value,
                      })
                    }
                    placeholder="business@example.com"
                  />
                  <Input
                    label="Business Phone"
                    name="businessPhone"
                    type="tel"
                    value={businessForm.businessPhone}
                    onChange={(e) =>
                      setBusinessForm({
                        ...businessForm,
                        businessPhone: e.target.value,
                      })
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
                <Input
                  label="Website"
                  name="website"
                  type="url"
                  value={businessForm.website}
                  onChange={(e) =>
                    setBusinessForm({
                      ...businessForm,
                      website: e.target.value,
                    })
                  }
                  placeholder="https://yourbusiness.com"
                />
                <div>
                  <label
                    className={`block text-sm font-semibold mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Address
                  </label>
                  <textarea
                    name="address"
                    value={businessForm.address}
                    onChange={(e) =>
                      setBusinessForm({
                        ...businessForm,
                        address: e.target.value,
                      })
                    }
                    placeholder="Business address"
                    rows="3"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-semibold mb-2 ${
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Business Description
                  </label>
                  <textarea
                    name="description"
                    value={businessForm.description}
                    onChange={(e) =>
                      setBusinessForm({
                        ...businessForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe your business"
                    rows="4"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${
                      isDarkMode
                        ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>
                <div className="pt-4">
                  <Button type="submit" icon={Save}>
                    Save Business Info
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div>
              <h2
                className={`text-2xl font-bold mb-6 ${
                  isDarkMode ? "text-white" : "text-gray-900"
                }`}
              >
                Security Settings
              </h2>
              <form
                onSubmit={handlePasswordChange}
                className="space-y-4 max-w-md"
              >
                <Input
                  label="Current Password"
                  name="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  placeholder="Enter current password"
                  required
                />
                <Input
                  label="New Password"
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  placeholder="Enter new password"
                  required
                />
                <Input
                  label="Confirm New Password"
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Confirm new password"
                  required
                />
                <div className="pt-4">
                  <Button type="submit" icon={Key}>
                    Change Password
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
