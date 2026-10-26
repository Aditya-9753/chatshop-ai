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

// @desc    Add tag to customer
exports.addTag = async (req, res) => {
  try {
    const { tag } = req.body;
    const customer = await customerService.addTag(
      req.user._id,
      req.params.id,
      tag
    );
    return ResponseHandler.success(res, customer, "Tag added successfully");
  } catch (error) {
    console.error("Add tag error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Remove tag from customer
exports.removeTag = async (req, res) => {
  try {
    const { tag } = req.body;
    const customer = await customerService.removeTag(
      req.user._id,
      req.params.id,
      tag
    );
    return ResponseHandler.success(res, customer, "Tag removed successfully");
  } catch (error) {
    console.error("Remove tag error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Add internal note
exports.addInternalNote = async (req, res) => {
  try {
    const { note } = req.body;
    const internalNote = await customerService.addInternalNote(
      req.user._id,
      req.params.id,
      note,
      req.user.name
    );
    return ResponseHandler.created(
      res,
      internalNote,
      "Note added successfully"
    );
  } catch (error) {
    console.error("Add internal note error:", error);
    return ResponseHandler.badRequest(res, error.message);
  }
};

// @desc    Get internal notes
exports.getInternalNotes = async (req, res) => {
  try {
    const notes = await customerService.getInternalNotes(
      req.user._id,
      req.params.id
    );
    return ResponseHandler.success(res, notes);
  } catch (error) {
    console.error("Get internal notes error:", error);
    return ResponseHandler.error(res, error.message);
  }
};

// @desc    Delete internal note
exports.deleteInternalNote = async (req, res) => {
  try {
    await customerService.deleteInternalNote(req.user._id, req.params.noteId);
    return ResponseHandler.success(res, null, "Note deleted successfully");
  } catch (error) {
    console.error("Delete internal note error:", error);
    return ResponseHandler.notFound(res, error.message);
  }
};
