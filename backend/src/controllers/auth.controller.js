const authService = require("../services/auth.service");
const ResponseHandler = require("../utils/response.handler");
const { validationResult } = require("express-validator");

// @desc    Register new user
exports.register = async (req, res) => {
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ResponseHandler.validationError(res, errors.array());
    }

    const result = await authService.register(req.body);
    return ResponseHandler.created(
      res,
      result,
      "Registration successful! Please verify your email."
    );
  } catch (error) {
    console.error("Register controller error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Login user
exports.login = async (req, res) => {
  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ResponseHandler.validationError(res, errors.array());
    }

    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return ResponseHandler.success(res, result, "Login successful");
  } catch (error) {
    console.error("Login controller error:", error);
    return ResponseHandler.unauthorized(res, error.message);
  }
};

// @desc    Verify email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    await authService.verifyEmail(token);
    return ResponseHandler.success(res, null, "Email verified successfully");
  } catch (error) {
    console.error("Verify email controller error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);
    return ResponseHandler.success(
      res,
      null,
      "Password reset link sent to your email"
    );
  } catch (error) {
    console.error("Forgot password controller error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    return ResponseHandler.success(res, null, "Password reset successful");
  } catch (error) {
    console.error("Reset password controller error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};
