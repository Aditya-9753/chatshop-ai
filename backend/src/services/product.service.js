const Product = require("../models/Product.model");

class ProductService {
  // Get all products with filters
  async getProducts(userId, filters = {}) {
    const { category, search, isActive, page = 1, limit = 20 } = filters;

    const query = { userId };

    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === "true";

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Product.countDocuments(query);

    return {
      products,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
    };
  }

  // Get single product
  async getProduct(userId, productId) {
    const product = await Product.findOne({
      _id: productId,
      userId,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  // Create new product
  async createProduct(userId, productData) {
    const {
      name,
      description,
      price,
      comparePrice,
      images,
      category,
      sku,
      stock,
      isActive,
      tags,
      hsn,
      gstRatePct,
      serialized,
    } = productData;

    const product = await Product.create({
      userId,
      name,
      description,
      price,
      comparePrice,
      images,
      category,
      sku,
      // Serialized products count their IMEIs in stock (added per store in EMI & billing)
      stock: serialized ? 0 : stock,
      isActive,
      tags,
      hsn,
      gstRatePct: gstRatePct === undefined || gstRatePct === "" ? undefined : Number(gstRatePct),
      serialized: serialized === true || serialized === "true",
    });

    return product;
  }

  // Update product
  async updateProduct(userId, productId, updateData) {
    const product = await Product.findOne({
      _id: productId,
      userId,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    const {
      name,
      description,
      price,
      comparePrice,
      images,
      category,
      sku,
      stock,
      isActive,
      tags,
      hsn,
      gstRatePct,
    } = updateData;

    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = price;
    if (comparePrice !== undefined) product.comparePrice = comparePrice;
    if (images) product.images = images;
    if (category) product.category = category;
    if (sku) product.sku = sku;
    // A serialized product's stock is its IMEIs in stock, not typed in
    if (stock !== undefined && !product.serialized) product.stock = stock;
    if (isActive !== undefined) product.isActive = isActive;
    if (tags) product.tags = tags;
    if (hsn !== undefined) product.hsn = hsn;
    if (gstRatePct !== undefined && gstRatePct !== "") product.gstRatePct = Number(gstRatePct);

    await product.save();
    return product;
  }

  // Delete product
  async deleteProduct(userId, productId) {
    const product = await Product.findOneAndDelete({
      _id: productId,
      userId,
    });

    if (!product) {
      throw new Error("Product not found");
    }

    return true;
  }
}

module.exports = new ProductService();
