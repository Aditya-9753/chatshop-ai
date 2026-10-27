// Number, money and date formatting shared by every page

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-IN");
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const formatCurrency = (value, { precise = false } = {}) =>
  (precise ? inrPrecise : inr).format(Number(value) || 0);

export const formatNumber = (value) => number.format(Number(value) || 0);

export const formatCompact = (value) => compact.format(Number(value) || 0);

export const formatDate = (value, options = { day: "numeric", month: "short", year: "numeric" }) =>
  value ? new Date(value).toLocaleDateString("en-IN", options) : "—";

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "";

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// "Today", "Yesterday", weekday within a week, else a date
export const formatDayLabel = (value) => {
  const days = Math.round((startOfDay(new Date()) - startOfDay(value)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Date(value).toLocaleDateString("en-IN", { weekday: "long" });
  return formatDate(value);
};

// Compact time for lists: "now", "5m", "3h", "Yesterday", "12 Mar"
export const formatRelative = (value) => {
  if (!value) return "";
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400 && startOfDay(value).getTime() === startOfDay(new Date()).getTime()) {
    return formatTime(value);
  }
  const label = formatDayLabel(value);
  return label === "Today" ? formatTime(value) : label === "Yesterday" ? "Yesterday" : formatDate(value, { day: "numeric", month: "short" });
};

// Percent change between two numbers; null when there is no baseline
export const percentChange = (current, previous) => {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
};
