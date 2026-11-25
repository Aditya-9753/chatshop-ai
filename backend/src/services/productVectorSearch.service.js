const mongoose = require("mongoose");
const Product = require("../models/Product.model");
const embeddings = require("./productEmbedding.service");

const INDEX_NAME = "chatshop_products_vector_v1";
const VECTOR_INDEX_DEFINITION = {
  fields: [
    {
      type: "vector",
      path: "vectorEmbedding",
      numDimensions: embeddings.DIMENSIONS,
      similarity: "cosine",
    },
    { type: "filter", path: "userId" },
    { type: "filter", path: "isActive" },
  ],
};

async function searchProducts(userId, query, limit = 5) {
  if (
    process.env.PRODUCT_VECTOR_SEARCH_ENABLED !== "true" ||
    process.env.RAG_GEMINI_QUERY_ENABLED !== "true"
  ) return null;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Product vector search requires a valid tenant ID");
  }
  const queryVector = await embeddings.embedQuery(query);
  const products = await Product.aggregate([
    {
      $vectorSearch: {
        index: INDEX_NAME,
        path: "vectorEmbedding",
        queryVector,
        filter: {
          userId: new mongoose.Types.ObjectId(userId),
          isActive: true,
        },
        numCandidates: Math.min(10000, Math.max(limit * 20, 100)),
        limit,
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        price: 1,
        serialized: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);
  return products;
}

module.exports = {
  INDEX_NAME,
  VECTOR_INDEX_DEFINITION,
  searchProducts,
};
