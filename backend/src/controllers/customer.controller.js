const customerService = require("../services/customer.service");
const ResponseHandler = require("../utils/response.handler");

// @desc    Get all customers
exports.getCustomers = async (req, res) => {
  try {
    const result = await customerService.getCustomers(req.user._id, req.query);
    return ResponseHandler.paginated(res, result.customers, {
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      total: result.total,
    });
  } catch (error) {
    console.error("Get customers error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Get single customer
exports.getCustomer = async (req, res) => {
  try {
    const customer = await customerService.getCustomer(
      req.user._id,
      req.params.id
    );
    return ResponseHandler.success(res, customer);
  } catch (error) {
    console.error("Get customer error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Create new customer
exports.createCustomer = async (req, res) => {
  try {
    const customer = await customerService.createCustomer(
      req.user._id,
      req.body
    );
    return ResponseHandler.created(
      res,
      customer,
      "Customer created successfully"
    );
  } catch (error) {
    console.error("Create customer error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const customer = await customerService.updateCustomer(
      req.user._id,
      req.params.id,
      req.body
    );
    return ResponseHandler.success(
      res,
      customer,
      "Customer updated successfully"
    );
  } catch (error) {
    console.error("Update customer error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Delete customer
exports.deleteCustomer = async (req, res) => {
  try {
    await customerService.deleteCustomer(req.user._id, req.params.id);
    return ResponseHandler.success(res, null, "Customer deleted successfully");
  } catch (error) {
    console.error("Delete customer error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};

// @desc    Block/unblock customer
exports.blockCustomer = async (req, res) => {
  try {
    const { isBlocked } = req.body;
    const customer = await customerService.blockCustomer(
      req.user._id,
      req.params.id,
      isBlocked
    );
    return ResponseHandler.success(
      res,
      customer,
      `Customer ${isBlocked ? "blocked" : "unblocked"} successfully`
    );
  } catch (error) {
    console.error("Block customer error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};
