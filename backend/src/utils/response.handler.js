class ResponseHandler {
  // Success response
  static success(res, data, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  // Error response
  static error(res, message = "Error", statusCode = 500, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(errors && { errors }),
    });
  }

  // Created response
  static created(res, data, message = "Created successfully") {
    return this.success(res, data, message, 201);
  }

  // Not found response
  static notFound(res, message = "Resource not found") {
    return this.error(res, message, 404);
  }

  // Unauthorized response
  static unauthorized(res, message = "Unauthorized access") {
    return this.error(res, message, 401);
  }

  // Forbidden response
  static forbidden(res, message = "Access forbidden") {
    return this.error(res, message, 403);
  }

  // Bad request response
  static badRequest(res, message = "Bad request", errors = null) {
    return this.error(res, message, 400, errors);
  }

  // Validation error response
  // Lead with the first problem so forms can show it inline
  static validationError(res, errors) {
    return this.badRequest(res, errors[0]?.msg || "Validation failed", errors);
  }

  // Paginated response
  static paginated(res, data, pagination, message = "Success") {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        total: pagination.total,
        limit: pagination.limit || 20,
      },
    });
  }
}

module.exports = ResponseHandler;
