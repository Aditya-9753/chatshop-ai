const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.RAG_EMBEDDING_MODEL || "gemini-embedding-001";
const DIMENSIONS = Number(process.env.RAG_EMBEDDING_DIMENSIONS || 768);
let client;

if (!Number.isInteger(DIMENSIONS) || DIMENSIONS < 1 || DIMENSIONS > 3072) {
  throw new Error("RAG_EMBEDDING_DIMENSIONS must be an integer between 1 and 3072");
}

function productText(product) {
  return [
    product.name,
    product.category,
    product.description,
    product.sku,
    ...(product.tags || []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
}

function contentHash(product) {
  return crypto.createHash("sha256").update(productText(product)).digest("hex");
}

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for product vector embeddings");
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

async function embed(text, taskType) {
  const content = String(text || "").trim().slice(0, 8000);
  if (!content) throw new Error("Cannot create an embedding from empty text");

  const response = await getClient().models.embedContent({
    model: MODEL,
    contents: content,
    config: { taskType, outputDimensionality: DIMENSIONS },
  });
  const values = response.embeddings?.[0]?.values;
  if (
    !Array.isArray(values) ||
    values.length !== DIMENSIONS ||
    values.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`Embedding provider returned an invalid ${DIMENSIONS}-dimension vector`);
  }
  return values;
}

async function embedProduct(product) {
  const text = productText(product);
  return {
    vector: await embed(text, "RETRIEVAL_DOCUMENT"),
    model: MODEL,
    contentHash: contentHash(product),
  };
}

async function embedQuery(text) {
  return embed(text, "RETRIEVAL_QUERY");
}

module.exports = {
  DIMENSIONS,
  MODEL,
  contentHash,
  embedProduct,
  embedQuery,
  productText,
  _setClient: (value) => {
    client = value;
  },
};
