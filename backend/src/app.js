const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();
const allowedOrigins = require("./utils/origins");

require("./models/WhatsAppAIUsage.model");
require("./models/WhatsAppWebhookJob.model");
require("./models/WhatsAppWebhookLock.model");
require("./models/WhatsAppBillJob.model");
require("./models/WhatsAppBillDraft.model");
require("./services/whatsappAssistant.service");

const app = express();

// Behind a load balancer or proxy (Render, Nginx...), trust it so rate
// limits apply per visitor instead of to the proxy's single IP
if (process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

// Database Connection
const connectDB = require("./db/connection");
const databaseReady = connectDB();

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

// System Guardian module
const guardian = require("./modules/systemGuardian");

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // limit each IP to 600 requests per windowMs
  // Meta and Razorpay deliver webhooks from a few IPs; never throttle them
  skip: (req) => req.path.endsWith("/webhook") || req.path.startsWith("/webhooks/"),
});
app.use("/api/", limiter);

// System Guardian – request tracking (UUID + timing, before routes)
app.use(guardian.monitoringMiddleware);

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
// ChatShop's own plans, invoices and payments (platform billing)
const billing = require("./billing/routes");
app.use("/api/subscriptions", billing.merchant);
app.use("/api/webhooks", billing.webhooks);
app.use("/api/admin", billing.admin);
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
// EMI & billing: counter sales, GST invoices, Shop EMI, NBFC, accounts
app.use("/api/emi", require("./emi/routes"));

// ChatShop AI help chat on the website
const assistantRoutes = require("./assistant/routes");
app.use("/api/assistant", assistantRoutes.router);
app.use("/api/admin/assistant", assistantRoutes.admin);

// Platform name and support contact, shown on public pages
app.get("/api/settings/public", require("./controllers/adminTools.controller").publicSettings);

// System Guardian – Super Admin only incident / health / recovery API
app.use("/api/admin/guardian", guardian.router);

// Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "WhatsApp, Instagram & Facebook Automation API",
    version: "1.0.0",
  });
});

// Error Handler (System Guardian – replaces generic handler, creates incidents for 5xx)
app.use(guardian.guardianErrorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.locals.databaseReady = databaseReady;

if (process.env.NODE_ENV !== "test" && process.env.RUN_BACKGROUND_WORKERS !== "false") {
  databaseReady.then(async () => {
    await require("./services/whatsappWebhookQueue.service").start();
    await require("./services/whatsappBillQueue.service").start();
    if (process.env.PRODUCT_VECTOR_SEARCH_ENABLED === "true") {
      await require("./services/productEmbeddingQueue.service").start();
    }
  }).catch((error) => {
    console.error("Background worker startup failed:", error.message);
  });
}

module.exports = app;
