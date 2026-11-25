require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const app = require("./src/app");
const realtime = require("./src/realtime/socket");
const guardian = require("./src/modules/systemGuardian");
const sharedCache = require("./src/utils/sharedCache");

const PORT = process.env.PORT || 3001;

// One HTTP server for the REST API and socket.io
const server = http.createServer(app);
const io = realtime.init(server);
guardian.init(io);
let shuttingDown = false;

app.locals.databaseReady
  .then(() => {
    require("./src/emi/jobs").startEmiJobs();
    require("./src/billing/jobs").startBillingJobs();
    return realtime.ready().then(
      () =>
        new Promise((resolve, reject) => {
          server.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
            resolve();
          });
          server.once("error", (err) => {
            if (err.code === "EADDRINUSE") {
              console.error(`❌ Port ${PORT} already in use. Kill the old process first:\n   npx kill-port ${PORT}`);
              process.exitCode = 1;
            }
            reject(err);
          });
        }),
    );
  })
  .catch((error) => {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
  });

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`API received ${signal}; stopping new connections`);
  try {
    await Promise.all([
      require("./src/services/whatsappWebhookQueue.service").stop(),
      require("./src/services/whatsappBillQueue.service").stop(),
      process.env.PRODUCT_VECTOR_SEARCH_ENABLED === "true"
        ? require("./src/services/productEmbeddingQueue.service").stop()
        : Promise.resolve(),
    ]);
    await realtime.close();
    await sharedCache.close();
    await mongoose.disconnect();
  } catch (error) {
    console.error("API shutdown failed:", error.message);
    process.exitCode = 1;
  }
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
