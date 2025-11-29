const orderService = require("../services/order.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Get all orders
exports.getOrders = async (req, res) => {
  try {
    const result = await orderService.getOrders(req.user._id, req.query);
    return ResponseHandler.paginated(res, result.orders, {
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      total: result.total,
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get single order
exports.getOrder = async (req, res) => {
  try {
    const order = await orderService.getOrder(req.user._id, req.params.id);
    return ResponseHandler.success(res, order);
  } catch (error) {
    console.error("Get order error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Create new order
exports.createOrder = async (req, res) => {
  try {
    const order = await orderService.createOrder(req.user._id, req.body);
    return ResponseHandler.created(res, order, "Order created successfully");
  } catch (error) {
    console.error("Create order error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await orderService.updateOrderStatus(
      req.user._id,
      req.params.id,
      req.body
    );
    return ResponseHandler.success(
      res,
      order,
      "Order status updated successfully"
    );
  } catch (error) {
    console.error("Update order status error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete order
exports.deleteOrder = async (req, res) => {
  try {
    await orderService.deleteOrder(req.user._id, req.params.id);
    return ResponseHandler.success(res, null, "Order deleted successfully");
  } catch (error) {
    console.error("Delete order error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Get order statistics
exports.getOrderStats = async (req, res) => {
  try {
    const stats = await orderService.getOrderStats(req.user._id, req.query);
    return ResponseHandler.success(res, stats);
  } catch (error) {
    console.error("Get order stats error:", error);
    return ResponseHandler.error(res, error.message);
  }
};
