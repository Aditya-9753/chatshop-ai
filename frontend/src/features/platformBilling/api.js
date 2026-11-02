import api from "../../services/api.service";
import { newKey } from "../billing/api";

// ChatShop's own plans, invoices and payments. Every amount is integer paise;
// show them with inr() from features/billing/api.

const withKey = (key) => ({ headers: { "Idempotency-Key": key || newKey() } });

// The shop owner's side (/api/subscriptions)
export const planApi = {
  plans: () => api.get("/subscriptions/plans"),
  current: () => api.get("/subscriptions/current"),
  checkout: (planCode, key) => api.post("/subscriptions/checkout", { planCode }, withKey(key)),
  verify: (body) => api.post("/subscriptions/verify", body),
  payment: (ref) => api.get(`/subscriptions/payments/${ref}`),
  testResult: (ref, outcome) => api.post(`/subscriptions/payments/${ref}/test-result`, { outcome }),
  cancel: () => api.post("/subscriptions/cancel"),
  resume: () => api.post("/subscriptions/resume"),
  invoices: () => api.get("/subscriptions/invoices"),
  invoice: (id) => api.get(`/subscriptions/invoices/${id}`),
  payInvoice: (id, key) => api.post(`/subscriptions/invoices/${id}/pay`, {}, withKey(key)),
  payments: () => api.get("/subscriptions/payments"),
};

const query = (params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
  return q ? `?${q}` : "";
};

// The Super Admin's side (/api/admin/...)
export const platformAdminApi = {
  overview: (params) => api.get(`/admin/revenue/overview${query(params)}`),
  transactions: (params) => api.get(`/admin/revenue/transactions${query(params)}`),
  reconciliation: () => api.get("/admin/revenue/reconciliation"),
  runExpiry: () => api.post("/admin/revenue/expiry/run"),
  plans: () => api.get("/admin/plans"),
  planHistory: (code) => api.get(`/admin/plans/${code}/history`),
  createPlan: (body) => api.post("/admin/plans", body),
  updatePlan: (code, body) => api.patch(`/admin/plans/${code}`, body),
  invoices: (params) => api.get(`/admin/platform-invoices${query(params)}`),
  invoice: (id) => api.get(`/admin/platform-invoices/${id}`),
  previewInvoice: (body) => api.post("/admin/platform-invoices/preview", body),
  issueInvoice: (body, key) => api.post("/admin/platform-invoices", body, withKey(key)),
  voidInvoice: (id, reason) => api.post(`/admin/platform-invoices/${id}/void`, { reason }),
  recordPayment: (id, body, key) => api.post(`/admin/platform-invoices/${id}/payments`, body, withKey(key)),
  refund: (paymentId, body, key) => api.post(`/admin/platform-payments/${paymentId}/refunds`, body, withKey(key)),
  syncPayment: (paymentId) => api.post(`/admin/platform-payments/${paymentId}/sync`),
  settings: () => api.get("/admin/billing-settings"),
  saveSettings: (body) => api.put("/admin/billing-settings", body),
  merchant: (id) => api.get(`/admin/merchants/${id}/billing`),
  shops: () => api.get("/admin/users?limit=500"),
  async exportCsv(kind, params) {
    const blob = await api.get(`/admin/revenue/export/${kind}${query(params)}`, { responseType: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `platform-${kind}-${params?.from || ""}-${params?.to || ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
};

export const INTERVAL_LABELS = { MONTHLY: "/month", YEARLY: "/year", ONE_TIME: " once" };
export const INTERVAL_NAMES = { MONTHLY: "Monthly", YEARLY: "Yearly", ONE_TIME: "One-time" };

export const PAYMENT_TONES = {
  CREATED: ["neutral", "Started"],
  CAPTURED: ["success", "Paid"],
  FAILED: ["danger", "Failed"],
  REVIEW: ["warning", "Needs review"],
  PAID: ["success", "Paid"],
  PARTIALLY_PAID: ["warning", "Part paid"],
  UNPAID: ["warning", "Unpaid"],
  NOT_APPLICABLE: ["neutral", "Credit note"],
  VOID: ["danger", "Void"],
  PENDING: ["warning", "Pending"],
  PROCESSED: ["success", "Processed"],
};

export const GATEWAY_LABELS = { RAZORPAY: "Razorpay", MOCK: "Test gateway", MANUAL: "Recorded by hand" };
