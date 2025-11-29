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
  async updateProfile(userId, updateData) {
    const { name, phone } = updateData;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();
    return user;
  }

  // Update password
  async updatePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
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

    const { isConnected, phoneNumber, businessAccountId, accessToken } =
      configData;

    if (isConnected !== undefined)
      user.whatsappConfig.isConnected = isConnected;
    if (phoneNumber) user.whatsappConfig.phoneNumber = phoneNumber;
    if (businessAccountId)
      user.whatsappConfig.businessAccountId = businessAccountId;
    if (accessToken) user.whatsappConfig.accessToken = accessToken;

    await user.save();
    return user.whatsappConfig;
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
    return user.instagramConfig;
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

    const { businessName, businessType, website, address, gstNumber } =
      businessData;

    if (businessName) user.businessInfo.businessName = businessName;
    if (businessType) user.businessInfo.businessType = businessType;
    if (website) user.businessInfo.website = website;
    if (address) user.businessInfo.address = address;
    if (gstNumber) user.businessInfo.gstNumber = gstNumber;

    await user.save();
    return user.businessInfo;
  }
}

module.exports = new UserService();
