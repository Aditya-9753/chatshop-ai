const productService = require("../services/product.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Get all products
exports.getProducts = async (req, res) => {
  try {
    const result = await productService.getProducts(req.user._id, req.query);
    return ResponseHandler.paginated(res, result.products, {
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      total: result.total,
    });
  } catch (error) {
    console.error("Get products error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get single product
exports.getProduct = async (req, res) => {
  try {
    const product = await productService.getProduct(
      req.user._id,
      req.params.id
    );
    return ResponseHandler.success(res, product);
  } catch (error) {
    console.error("Get product error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Create new product
exports.createProduct = async (req, res) => {
  try {
    const product = await productService.createProduct(req.user._id, req.body);
    return ResponseHandler.created(
      res,
      product,
      "Product created successfully"
    );
  } catch (error) {
    console.error("Create product error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Update product
exports.updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(
      req.user._id,
      req.params.id,
      req.body
    );
    return ResponseHandler.success(
      res,
      product,
      "Product updated successfully"
    );
  } catch (error) {
    console.error("Update product error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete product
exports.deleteProduct = async (req, res) => {
  try {
    await productService.deleteProduct(req.user._id, req.params.id);
    return ResponseHandler.success(res, null, "Product deleted successfully");
  } catch (error) {
    console.error("Delete product error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};
