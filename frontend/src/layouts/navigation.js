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
  { name: "Billing overview", href: BILLING_BASE, icon: Receipt, end: true, perm: "report.store" },
  { name: "New sale", short: "Sale", href: `${BILLING_BASE}/sale`, icon: ShoppingCart, perm: "invoice.create" },
  { name: "Invoices", href: `${BILLING_BASE}/invoices`, icon: FileText, perm: "invoice.read" },
  { name: "EMI collections", short: "EMI", href: `${BILLING_BASE}/emi`, icon: CalendarClock, perm: "emi.read" },
  { name: "Stock & IMEI", short: "Stock", href: `${BILLING_BASE}/stock`, icon: Boxes, perm: "product.read" },
  { name: "Approvals", href: `${BILLING_BASE}/approvals`, icon: CheckSquare, perm: "approval.read" },
  { name: "Payments", href: `${BILLING_BASE}/payments`, icon: Wallet, perm: "payment.read" },
  { name: "Accounts & GST", href: `${BILLING_BASE}/accounts`, icon: ScrollText, perm: "ledger.read" },
  { name: "Billing settings", href: `${BILLING_BASE}/settings`, icon: SlidersHorizontal, perm: "settings.read" },
];

export const BILLING_GROUP = { label: "EMI & Billing", items: BILLING_ITEMS };

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

// Mobile bottom tab bar (the rest is under "More")
export const TAB_BAR_ITEMS = ["Overview", "Messages", "Orders", "Customers"].map((name) =>
  NAV_ITEMS.find((item) => item.name === name)
);
export const STAFF_TAB_BAR_ITEMS = ["New sale", "Invoices", "EMI collections", "Stock & IMEI"].map((name) =>
  BILLING_ITEMS.find((item) => item.name === name)
);
