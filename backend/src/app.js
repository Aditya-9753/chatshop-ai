const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();
const allowedOrigins = require("./utils/origins");

const app = express();

// Database Connection
const connectDB = require("./db/connection");
connectDB();

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
); // Security headers with CORS exception for images
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
// Keep the raw body: Meta webhook signatures are computed over the exact bytes
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev")); // Logging

// Serve static files (uploaded images)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // limit each IP to 600 requests per windowMs
  // Meta delivers webhooks from a few IPs; never throttle them
  skip: (req) => req.path.endsWith("/webhook"),
});
app.use("/api/", limiter);

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/subscriptions", require("./routes/subscription.routes"));
app.use("/api/whatsapp", require("./routes/whatsapp.routes"));
app.use("/api/instagram", require("./routes/instagram.routes"));
app.use("/api/facebook", require("./routes/facebook.routes"));
app.use("/api/customers", require("./routes/customer.routes"));
app.use("/api/conversations", require("./routes/conversation.routes"));
app.use("/api/messages", require("./routes/message.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/orders", require("./routes/order.routes"));
app.use("/api/analytics", require("./routes/analytics.routes"));
app.use("/api/admin", require("./routes/admin.routes"));

// Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WhatsApp, Instagram & Facebook Automation API",
    version: "1.0.0",
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

module.exports = app;
