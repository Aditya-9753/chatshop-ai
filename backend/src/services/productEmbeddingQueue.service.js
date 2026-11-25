const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const Product = require("../models/Product.model");
const embeddings = require("./productEmbedding.service");

const QUEUE_NAME = "chatshop-product-embeddings";
const CONCURRENCY = Number(process.env.PRODUCT_EMBEDDING_CONCURRENCY || 2);
let queue;
let worker;
let queueConnection;
let workerConnection;

if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 32) {
  throw new Error("PRODUCT_EMBEDDING_CONCURRENCY must be an integer between 1 and 32");
}

function redisConnection() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required for product embedding jobs");
  }
  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

function getQueue() {
  if (!queue) {
    queueConnection = redisConnection();
    queue = new Queue(QUEUE_NAME, { connection: queueConnection });
  }
  return queue;
}

async function enqueueProduct(productId) {
  if (process.env.PRODUCT_VECTOR_SEARCH_ENABLED !== "true") return false;
  const jobs = getQueue();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const product = await Product.findById(productId)
      .select("name category description sku tags isActive updatedAt")
      .lean();
    if (!product) return false;
    if (!product.isActive) {
      await Product.updateOne(
        { _id: product._id, updatedAt: product.updatedAt },
        {
          $set: { embeddingStatus: "disabled" },
          $unset: { vectorEmbedding: 1, embeddingModel: 1, embeddingContentHash: 1 },
        },
      );
      return false;
    }

    const contentHash = embeddings.contentHash(product);
    const update = await Product.updateOne(
      { _id: product._id, updatedAt: product.updatedAt },
      {
        $set: { embeddingContentHash: contentHash, embeddingStatus: "pending" },
        $unset: { vectorEmbedding: 1, embeddingModel: 1 },
      },
    );
    if (!update.matchedCount) continue;

    await jobs.add(
      "embed-product",
      { productId: String(product._id), contentHash },
      {
        jobId: `product-${product._id}-${contentHash.slice(0, 20)}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
    return true;
  }
  throw new Error(`Product ${productId} changed repeatedly while its embedding was queued`);
}

async function processProductEmbedding(job) {
  const { productId, contentHash } = job.data;
  const product = await Product.findById(productId)
    .select("name category description sku tags isActive +embeddingContentHash")
    .lean();
  if (!product || !product.isActive) return { skipped: true };

  const currentHash = embeddings.contentHash(product);
  if (currentHash !== contentHash || product.embeddingContentHash !== contentHash) {
    return { stale: true };
  }

  const result = await embeddings.embedProduct(product);
  const saved = await Product.updateOne(
    { _id: product._id, isActive: true, embeddingContentHash: contentHash },
    {
      $set: {
        vectorEmbedding: result.vector,
        embeddingModel: result.model,
        embeddingStatus: "ready",
      },
    },
  );
  return { indexed: saved.modifiedCount === 1 };
}

async function start() {
  if (worker || process.env.NODE_ENV === "test") return;
  workerConnection = redisConnection();
  worker = new Worker(QUEUE_NAME, processProductEmbedding, {
    connection: workerConnection,
    concurrency: CONCURRENCY,
  });
  worker.on("failed", async (job, error) => {
    console.error("Product embedding job failed:", error.message);
    if (!job || job.attemptsMade < (job.opts.attempts || 1)) return;
    try {
      await Product.updateOne(
        { _id: job.data.productId, embeddingContentHash: job.data.contentHash },
        { $set: { embeddingStatus: "failed" } },
      );
    } catch (updateError) {
      console.error("Could not mark product embedding as failed:", updateError.message);
    }
  });
}

async function status() {
  if (process.env.PRODUCT_VECTOR_SEARCH_ENABLED !== "true") {
    return {
      enabled: false,
      queryEmbeddingEnabled: process.env.RAG_GEMINI_QUERY_ENABLED === "true",
      waiting: 0,
      active: 0,
      failed: 0,
    };
  }
  const jobs = getQueue();
  const counts = await jobs.getJobCounts("waiting", "active", "failed", "delayed");
  return {
    enabled: true,
    queryEmbeddingEnabled: process.env.RAG_GEMINI_QUERY_ENABLED === "true",
    waiting: counts.waiting + counts.delayed,
    active: counts.active,
    failed: counts.failed,
  };
}

async function stop() {
  const currentWorker = worker;
  const currentQueue = queue;
  worker = null;
  queue = null;
  if (currentWorker) await currentWorker.close();
  if (currentQueue) await currentQueue.close();
  await Promise.all(
    [workerConnection, queueConnection]
      .filter(Boolean)
      .map((connection) => connection.quit()),
  );
  workerConnection = null;
  queueConnection = null;
}

module.exports = {
  enqueueProduct,
  start,
  stop,
  status,
  _processProductEmbedding: processProductEmbedding,
  _queueName: QUEUE_NAME,
};
