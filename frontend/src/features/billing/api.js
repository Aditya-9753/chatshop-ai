import api from "../../services/api.service";

// EMI & billing API (/api/emi). Every amount crossing this boundary is
// integer paise: forms convert with toPaise(), screens show inr().

export const toPaise = (rupees) => Math.round(Number(String(rupees ?? "").replace(/,/g, "")) * 100) || 0;
export const fromPaise = (paise) => (Number(paise) || 0) / 100;

const inrFormat = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// 9168000 -> "₹91,680.00" (or "₹91,680" with whole: true)
export const inr = (paise, { whole = false } = {}) => (whole ? inrWhole : inrFormat).format(fromPaise(paise));

// A fresh key per user action; retries of that action reuse it
export const newKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const withKey = (key) => (key ? { headers: { "Idempotency-Key": key } } : undefined);

export const emiApi = {
  get: (path, params) => api.get(`/emi${path}`, { params }),
  post: (path, body, key) => api.post(`/emi${path}`, body, withKey(key)),
  patch: (path, body) => api.patch(`/emi${path}`, body),
  put: (path, body) => api.put(`/emi${path}`, body),
  del: (path) => api.delete(`/emi${path}`),
};
