// Give the demo products real photos (from seed-assets/products, see
// CREDITS.md there). Copies each photo into uploads/products and adds it to
// every product with that name that has no image yet. Safe to re-run.
//
//   npm run seed:images
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const Product = require("./src/models/Product.model");

const ASSETS = path.join(__dirname, "seed-assets/products");
const UPLOADS = path.join(__dirname, "uploads/products");

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  fs.mkdirSync(UPLOADS, { recursive: true });

  const credits = JSON.parse(fs.readFileSync(path.join(ASSETS, "credits.json"), "utf8"));
  let updated = 0;

  for (const photo of credits) {
    const target = `seed-${photo.file}`;
    fs.copyFileSync(path.join(ASSETS, photo.file), path.join(UPLOADS, target));

    const result = await Product.updateMany(
      { name: photo.product, $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] },
      { $set: { images: [`/uploads/products/${target}`] } }
    );
    updated += result.modifiedCount;
    console.log(`${photo.product}: ${result.modifiedCount} product(s) updated`);
  }

  console.log(`\n✅ Done. ${updated} product(s) now have photos.`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("❌ Could not add product images:", error.message);
  process.exit(1);
});
