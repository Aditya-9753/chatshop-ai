// The single definition of revenue used by the dashboard, analytics and
// admin: orders that are paid and not cancelled, counted on creation date.
const REVENUE_MATCH = {
  paymentStatus: "paid",
  status: { $ne: "cancelled" },
};

// Orders that count towards order totals (everything except cancelled)
const ORDER_MATCH = { status: { $ne: "cancelled" } };

module.exports = { REVENUE_MATCH, ORDER_MATCH };
