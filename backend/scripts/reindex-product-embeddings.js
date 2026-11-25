require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("../src/models/Product.model");
const productEmbeddingQueue = require("../src/services/productEmbeddingQueue.service");

async function main() {
  if (process.env.PRODUCT_VECTOR_SEARCH_ENABLED !== "true") {
    throw new Error("Set PRODUCT_VECTOR_SEARCH_ENABLED=true before queuing product embeddings");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const cursor = Product.find({ isActive: true }).select("_id").lean().cursor();
  let queued = 0;
  for await (const product of cursor) {
    if (await productEmbeddingQueue.enqueueProduct(product._id)) queued += 1;
  }
  console.info(`Queued embeddings for ${queued} active product(s)`);
}

main()
  .catch((error) => {
    console.error("Could not queue product embeddings:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await productEmbeddingQueue.stop();
    await mongoose.disconnect();
  });
