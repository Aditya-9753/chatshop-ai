require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./src/db/connection");
const webhookQueue = require("./src/services/whatsappWebhookQueue.service");
const billQueue = require("./src/services/whatsappBillQueue.service");
const productEmbeddingQueue = require("./src/services/productEmbeddingQueue.service");

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`AI/message worker received ${signal}; stopping after active jobs finish`);
  await Promise.all([webhookQueue.stop(), billQueue.stop(), productEmbeddingQueue.stop()]);
  await mongoose.disconnect();
}

async function start() {
  await connectDB();
  await webhookQueue.start();
  await billQueue.start();
  if (process.env.PRODUCT_VECTOR_SEARCH_ENABLED === "true") {
    await productEmbeddingQueue.start();
  }
  process.once("SIGTERM", () => shutdown("SIGTERM").then(() => process.exit(0)));
  process.once("SIGINT", () => shutdown("SIGINT").then(() => process.exit(0)));
  console.info("ChatShop background workers are running");
}

start().catch((error) => {
  console.error("ChatShop worker startup failed:", error);
  process.exitCode = 1;
});
