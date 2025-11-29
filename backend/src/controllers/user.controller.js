const userService = require("../services/user.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user._id);
    return ResponseHandler.success(res, user);
  } catch (error) {
    console.error("Get profile error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const user = await userService.updateProfile(req.user._id, req.body);
    return ResponseHandler.success(res, user, "Profile updated successfully");
  } catch (error) {
    console.error("Update profile error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update password
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return ResponseHandler.badRequest(
        res,
        "Please provide current and new password"
      );
    }

    await userService.updatePassword(
      req.user._id,
      currentPassword,
      newPassword
    );
    return ResponseHandler.success(res, null, "Password updated successfully");
  } catch (error) {
    console.error("Update password error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete account
exports.deleteAccount = async (req, res) => {
  try {
    await userService.deleteAccount(req.user._id);
    return ResponseHandler.success(res, null, "Account deleted successfully");
  } catch (error) {
    console.error("Delete account error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update WhatsApp configuration
exports.updateWhatsAppConfig = async (req, res) => {
  try {
    const config = await userService.updateWhatsAppConfig(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      config,
      "WhatsApp configuration updated successfully"
    );
  } catch (error) {
    console.error("Update WhatsApp config error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update Instagram configuration
exports.updateInstagramConfig = async (req, res) => {
  try {
    const config = await userService.updateInstagramConfig(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      config,
      "Instagram configuration updated successfully"
    );
  } catch (error) {
    console.error("Update Instagram config error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update AI configuration
exports.updateAIConfig = async (req, res) => {
  try {
    const config = await userService.updateAIConfig(req.user._id, req.body);
    return ResponseHandler.success(
      res,
      config,
      "AI configuration updated successfully"
    );
  } catch (error) {
    console.error("Update AI config error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Update business information
exports.updateBusinessInfo = async (req, res) => {
  try {
    const businessInfo = await userService.updateBusinessInfo(
      req.user._id,
      req.body
    );
    return ResponseHandler.success(
      res,
      businessInfo,
      "Business information updated successfully"
    );
  } catch (error) {
    console.error("Update business info error:", error);
    return ResponseHandler.error(res, error.message);
  }
};
