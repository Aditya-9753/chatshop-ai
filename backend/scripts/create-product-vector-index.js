require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("../src/models/Product.model");
const {
  INDEX_NAME,
  VECTOR_INDEX_DEFINITION,
} = require("../src/services/productVectorSearch.service");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const collection = mongoose.connection.db.collection(Product.collection.name);
  const name = await collection.createSearchIndex({
    name: INDEX_NAME,
    type: "vectorSearch",
    definition: VECTOR_INDEX_DEFINITION,
  });
  console.info(`Created MongoDB Vector Search index: ${name}`);
}

main()
  .catch((error) => {
    console.error("Could not create the product Vector Search index:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
