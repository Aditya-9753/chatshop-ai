const User = require("../models/User.model");
const bcrypt = require("bcryptjs");

class UserService {
  // Get user profile
  async getProfile(userId) {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  // Update user profile
  async updateProfile(userId, updateData, profilePhotoPath = null) {
    const { name, email, phone, businessName } = updateData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error("Email already in use");
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (businessName !== undefined) {
      if (!user.businessInfo) {
        user.businessInfo = {};
      }
      user.businessInfo.businessName = businessName;
    }

    // Update profile photo if provided
    if (profilePhotoPath) {
      user.profilePhoto = profilePhotoPath;
    }

    await user.save();

    // Return user without password
    const updatedUser = await User.findById(userId).select("-password");
    return updatedUser;
  }

  // Change password. The password field is select: false, so it has to be
  // requested explicitly. Older sessions are logged out afterwards.
  async updatePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new Error("User not found");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error("Current password is incorrect");
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters");
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      throw new Error("New password must be different from the current one");
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    // 1s back so the token issued below for this session stays valid
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save();

    return true;
  }

  // Delete account
  async deleteAccount(userId) {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return true;
  }

  // Update WhatsApp configuration
  async updateWhatsAppConfig(userId, configData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const {
      isConnected,
      phoneNumber,
      phoneNumberId,
      businessAccountId,
      accessToken,
    } = configData;

    if (isConnected !== undefined)
      user.whatsappConfig.isConnected = isConnected;
    if (phoneNumber) user.whatsappConfig.phoneNumber = phoneNumber;
    if (phoneNumberId) user.whatsappConfig.phoneNumberId = phoneNumberId;
    if (businessAccountId)
      user.whatsappConfig.businessAccountId = businessAccountId;
    if (accessToken) user.whatsappConfig.accessToken = accessToken;

    await user.save();
    return user.toJSON().whatsappConfig;
  }

  // Update Instagram configuration
  async updateInstagramConfig(userId, configData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const { isConnected, username, businessAccountId, accessToken } =
      configData;

    if (isConnected !== undefined)
      user.instagramConfig.isConnected = isConnected;
    if (username) user.instagramConfig.username = username;
    if (businessAccountId)
      user.instagramConfig.businessAccountId = businessAccountId;
    if (accessToken) user.instagramConfig.accessToken = accessToken;

    await user.save();
    return user.toJSON().instagramConfig;
  }

  // Update AI configuration
  async updateAIConfig(userId, configData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const { isEnabled, language, responseSpeed } = configData;

    if (isEnabled !== undefined) user.aiConfig.isEnabled = isEnabled;
    if (language) user.aiConfig.language = language;
    if (responseSpeed) user.aiConfig.responseSpeed = responseSpeed;

    await user.save();
    return user.aiConfig;
  }

  // Update business information
  async updateBusinessInfo(userId, businessData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Strings can be cleared by sending ""; missing fields are left alone
    const FIELDS = ["businessName", "businessType", "website", "address", "gstNumber", "businessEmail", "businessPhone", "description"];
    if (!user.businessInfo) user.businessInfo = {};
    for (const field of FIELDS) {
      if (typeof businessData[field] === "string") user.businessInfo[field] = businessData[field].trim();
    }

    await user.save();
    return user.toJSON().businessInfo;
  }

  // Update Facebook configuration
  async updateFacebookConfig(userId, configData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const { isConnected, pageName, pageId, accessToken } = configData;

    if (isConnected !== undefined)
      user.facebookConfig.isConnected = isConnected;
    if (pageName) user.facebookConfig.pageName = pageName;
    if (pageId) user.facebookConfig.pageId = pageId;
    if (accessToken) user.facebookConfig.accessToken = accessToken;

    await user.save();
    return user.toJSON().facebookConfig;
  }
}

module.exports = new UserService();
