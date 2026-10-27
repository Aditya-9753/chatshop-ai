const express = require("express");
const router = express.Router();
const { body, oneOf } = require("express-validator");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth.controller");

const PASSWORD_RULE = "Password must be at least 6 characters";

// Reset emails are limited per IP to stop inbox flooding
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many reset requests. Please try again in an hour.",
  },
});

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage(PASSWORD_RULE),
    body("phone").notEmpty().withMessage("Phone number is required"),
  ],
  authController.register
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  authController.login
);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  [body("email").isEmail().withMessage("Valid email is required")],
  authController.forgotPassword
);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    oneOf(
      [
        body("password").isLength({ min: 6 }),
        body("newPassword").isLength({ min: 6 }),
      ],
      { message: PASSWORD_RULE }
    ),
  ],
  authController.resetPassword
);

// @route   GET /api/auth/reset-password/:token
// @desc    Check whether a reset link is still valid
// @access  Public
router.get("/reset-password/:token", authController.validateResetToken);

// @route   GET /api/auth/verify-email/:token
// @desc    Verify email address
// @access  Public
router.get("/verify-email/:token", authController.verifyEmail);

module.exports = router;
