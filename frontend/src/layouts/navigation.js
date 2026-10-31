import {
  BarChart3,
  Boxes,
  CheckSquare,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Users,
  Wallet,
  CalendarClock,
} from "lucide-react";
import { anyGrants } from "../features/billing/permissions";

// Sidebar groups, in the order a shop owner uses them
export const NAV_GROUPS = [
  {
    items: [{ name: "Overview", href: "/dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Inbox",
    items: [{ name: "Messages", href: "/dashboard/messages", icon: MessageSquare, badge: "unread" }],
  },
  {
    label: "Sales",
    items: [
      { name: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
      { name: "Customers", href: "/dashboard/customers", icon: Users },
    ],
  },
  {
    label: "Catalog",
    items: [{ name: "Products", href: "/dashboard/products", icon: Package }],
  },
  {
    label: "Insights",
    items: [{ name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 }],
  },
  {
    label: "Settings",
    items: [{ name: "Settings", href: "/dashboard/settings", icon: Settings }],
  },
];

// EMI & billing: counter sales, GST invoices, Shop EMI and accounts.
// `perm` hides an item from roles that cannot use it.
export const BILLING_BASE = "/dashboard/billing";
export const BILLING_ITEMS = [
  { key: "home", name: "My work", short: "Home", href: `${BILLING_BASE}/home`, icon: LayoutDashboard, staffOnly: true },
  { key: "overview", name: "Billing overview", href: BILLING_BASE, icon: Receipt, end: true, perm: "report.store" },
  { key: "sale", name: "New sale", short: "Sale", href: `${BILLING_BASE}/sale`, icon: ShoppingCart, perm: "invoice.create" },
  { key: "invoices", name: "Invoices", href: `${BILLING_BASE}/invoices`, icon: FileText, perm: "invoice.read" },
  { key: "emi", name: "EMI collections", short: "EMI", href: `${BILLING_BASE}/emi`, icon: CalendarClock, perm: "emi.read" },
  { key: "stock", name: "Stock & IMEI", short: "Stock", href: `${BILLING_BASE}/stock`, icon: Boxes, perm: "product.read" },
  { key: "approvals", name: "Approvals", href: `${BILLING_BASE}/approvals`, icon: CheckSquare, perm: "approval.read" },
  { key: "payments", name: "Payments", href: `${BILLING_BASE}/payments`, icon: Wallet, perm: "payment.read" },
  { key: "accounts", name: "Accounts & GST", short: "Accounts", href: `${BILLING_BASE}/accounts`, icon: ScrollText, perm: "ledger.read" },
  { key: "staff", name: "Staff", href: `${BILLING_BASE}/staff`, icon: Users, perm: "user.read" },
  { key: "settings", name: "Billing settings", href: `${BILLING_BASE}/settings`, icon: SlidersHorizontal, perm: "settings.read" },
  { key: "account", name: "My account", short: "Account", href: `${BILLING_BASE}/settings?tab=account`, icon: Settings, staffOnly: true },
];

// The pages each staff role works in; nothing else shows or opens for them.
// Shop owners see every page their permissions allow.
export const STAFF_PAGES = {
  STORE_ADMIN: ["home", "overview", "sale", "invoices", "emi", "stock", "approvals", "payments", "accounts", "staff", "settings"],
  CASHIER: ["home", "sale", "invoices", "emi", "stock", "account"],
  ACCOUNTANT: ["home", "invoices", "payments", "accounts", "account"],
  AGENT: ["home", "emi", "account"],
};

// A role the shop owner made up gets the pages its chosen work allows (never
// Staff or settings), plus My work and My account
const customPages = (role) => [
  "home",
  "account",
  ...BILLING_ITEMS.filter((item) => item.perm && !["staff", "settings"].includes(item.key) && anyGrants(role.perms || [], item.perm)).map((item) => item.key),
];

// Billing pages one person can use, from their roles and permissions
export function billingItemsFor({ staff, roles, can }) {
  if (!staff) return BILLING_ITEMS.filter((item) => !item.staffOnly && can(item.perm));
  const keys = new Set(roles.flatMap((r) => (r.role === "CUSTOM" ? customPages(r) : STAFF_PAGES[r.role] || [])));
  // A Store Admin already has My account inside Billing settings
  if (keys.has("settings")) keys.delete("account");
  return BILLING_ITEMS.filter((item) => keys.has(item.key) && (!item.perm || can(item.perm)));
}

// Whether a billing URL belongs to one of these pages (detail pages included)
export function billingPathAllowed(pathname, items) {
  if (pathname === `${BILLING_BASE}/start`) return true;
  return items.some((item) => {
    const path = item.href.split("?")[0];
    return item.end ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  });
}

export const BILLING_GROUP = { label: "EMI & Billing", items: BILLING_ITEMS };

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

// Mobile bottom tab bar (the rest is under "More")
export const TAB_BAR_ITEMS = ["Overview", "Messages", "Orders", "Customers"].map((name) =>
  NAV_ITEMS.find((item) => item.name === name)
);
