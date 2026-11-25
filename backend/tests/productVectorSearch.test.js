const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Product = require("../src/models/Product.model");
const embeddings = require("../src/services/productEmbedding.service");
const vectorSearch = require("../src/services/productVectorSearch.service");

test("product vector search embeds the query and always prefilters by tenant and active status", async () => {
  const oldEnabled = process.env.PRODUCT_VECTOR_SEARCH_ENABLED;
  const oldQueryEnabled = process.env.RAG_GEMINI_QUERY_ENABLED;
  const oldKey = process.env.GEMINI_API_KEY;
  const originalAggregate = Product.aggregate;
  let embeddingRequest;
  let pipeline;
  process.env.PRODUCT_VECTOR_SEARCH_ENABLED = "true";
  process.env.RAG_GEMINI_QUERY_ENABLED = "true";
  process.env.GEMINI_API_KEY = "test-key";
  embeddings._setClient({
    models: {
      embedContent: async (request) => {
        embeddingRequest = request;
        return { embeddings: [{ values: Array(embeddings.DIMENSIONS).fill(0.1) }] };
      },
    },
  });
  Product.aggregate = async (value) => {
    pipeline = value;
    return [{ _id: new mongoose.Types.ObjectId(), name: "Shoes", price: 99, serialized: false }];
  };

  try {
    const tenantId = new mongoose.Types.ObjectId();
    const results = await vectorSearch.searchProducts(tenantId, "waterproof running shoes", 5);
    assert.equal(results[0].name, "Shoes");
    assert.equal(embeddingRequest.model, "gemini-embedding-001");
    assert.equal(embeddingRequest.config.taskType, "RETRIEVAL_QUERY");
    assert.equal(embeddingRequest.config.outputDimensionality, embeddings.DIMENSIONS);
    assert.equal(pipeline[0].$vectorSearch.index, "chatshop_products_vector_v1");
    assert.equal(pipeline[0].$vectorSearch.path, "vectorEmbedding");
    assert.equal(String(pipeline[0].$vectorSearch.filter.userId), String(tenantId));
    assert.equal(pipeline[0].$vectorSearch.filter.isActive, true);
    assert.equal(pipeline[0].$vectorSearch.numCandidates, 100);
    assert.equal(pipeline[1].$project.vectorEmbedding, undefined);
  } finally {
    Product.aggregate = originalAggregate;
    embeddings._setClient(null);
    if (oldEnabled === undefined) delete process.env.PRODUCT_VECTOR_SEARCH_ENABLED;
    else process.env.PRODUCT_VECTOR_SEARCH_ENABLED = oldEnabled;
    if (oldQueryEnabled === undefined) delete process.env.RAG_GEMINI_QUERY_ENABLED;
    else process.env.RAG_GEMINI_QUERY_ENABLED = oldQueryEnabled;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});

test("product vector search stays disabled until its local index is provisioned", async () => {
  const oldEnabled = process.env.PRODUCT_VECTOR_SEARCH_ENABLED;
  delete process.env.PRODUCT_VECTOR_SEARCH_ENABLED;
  try {
    assert.equal(await vectorSearch.searchProducts(new mongoose.Types.ObjectId(), "shoes"), null);
  } finally {
    if (oldEnabled === undefined) delete process.env.PRODUCT_VECTOR_SEARCH_ENABLED;
    else process.env.PRODUCT_VECTOR_SEARCH_ENABLED = oldEnabled;
  }
});
