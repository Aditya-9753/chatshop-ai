class OrderHelper {
  // Generate unique order number
  generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD-${timestamp}-${random}`;
  }

  // Calculate order totals
  calculateOrderTotals(items, taxRate = 0.18, shippingCost = 0) {
    const subtotal = items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    const tax = subtotal * taxRate;
    const total = subtotal + tax + shippingCost;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      shipping: shippingCost,
      total: Math.round(total * 100) / 100,
    };
  }

  // Validate order items
  validateOrderItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Order must contain at least one item");
    }

    for (const item of items) {
      if (!item.productId || !item.name || !item.price || !item.quantity) {
        throw new Error("Invalid item data");
      }

      if (item.quantity <= 0) {
        throw new Error("Item quantity must be greater than 0");
      }

      if (item.price < 0) {
        throw new Error("Item price cannot be negative");
      }
    }

    return true;
  }

  // Format order status
  getOrderStatusLabel(status) {
    const statusLabels = {
      pending: "Pending",
      confirmed: "Confirmed",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled",
    };

    return statusLabels[status] || "Unknown";
  }

  // Check if order can be cancelled
  canCancelOrder(orderStatus) {
    const cancellableStatuses = ["pending", "confirmed"];
    return cancellableStatuses.includes(orderStatus);
  }

  // Check if order can be refunded
  canRefundOrder(orderStatus, paymentStatus) {
    return (
      orderStatus === "cancelled" &&
      (paymentStatus === "paid" || paymentStatus === "captured")
    );
  }
}

module.exports = new OrderHelper();
