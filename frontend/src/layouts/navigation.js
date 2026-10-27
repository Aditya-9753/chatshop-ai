import {
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Users,
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

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

// Mobile bottom tab bar (the rest is under "More")
export const TAB_BAR_ITEMS = ["Overview", "Messages", "Orders", "Customers"].map((name) =>
  NAV_ITEMS.find((item) => item.name === name)
);
