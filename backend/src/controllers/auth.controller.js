const authService = require("../services/auth.service");
const ResponseHandler = require("../utils/response.handler");
const audit = require("../utils/audit");
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
    // Tell the admins (if they asked for new-shop alerts) and log it
    require("../services/adminTools.service").notifyNewShop(result.user);
    await audit(req, "shop.signup", { actor: { _id: result.user.id, email: result.user.email }, target: result.user.email });
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
    if (result.twoFactorRequired) {
      return ResponseHandler.success(res, result, "Enter the code from your authenticator app");
    }
    await audit(req, "auth.login", { actor: { _id: result.user.id, email: result.user.email } });
    return ResponseHandler.success(res, result, "Login successful");
  } catch (error) {
    console.error("Login controller error:", error);
    return ResponseHandler.unauthorized(res, error.message);
  }
};

// @desc    Second login step for accounts with two-factor login
// @route   POST /api/auth/login/2fa  { challengeToken, code }
exports.loginWithCode = async (req, res) => {
  try {
    const { challengeToken, code } = req.body;
    const result = await authService.loginWithCode(challengeToken, code);
    await audit(req, "auth.login", { actor: { _id: result.user.id, email: result.user.email }, details: "with two-factor code" });
    return ResponseHandler.success(res, result, "Login successful");
  } catch (error) {
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
// Always the same answer, whether or not the email has an account
exports.forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ResponseHandler.validationError(res, errors.array());
    }

    await authService.forgotPassword(req.body.email);
    return ResponseHandler.success(
      res,
      null,
      "If an account exists for that email, we've sent a link to reset the password."
    );
  } catch (error) {
    console.error("Forgot password controller error:", error);
    return ResponseHandler.error(res, "Could not process the request. Please try again.");
  }
};

// @desc    Check a reset link before showing the form
exports.validateResetToken = async (req, res) => {
  try {
    const user = await authService.findUserByResetToken(req.params.token);
    if (!user) {
      return ResponseHandler.badRequest(
        res,
        "This reset link has expired or was already used"
      );
    }
    return ResponseHandler.success(res, { email: user.email }, "Reset link is valid");
  } catch (error) {
    console.error("Validate reset token error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Reset password
exports.resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ResponseHandler.validationError(res, errors.array());
    }

    const { token } = req.body;
    const password = req.body.password || req.body.newPassword;
    await authService.resetPassword(token, password);
    return ResponseHandler.success(
      res,
      null,
      "Password reset. You can now log in with your new password."
    );
  } catch (error) {
    console.error("Reset password controller error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};
