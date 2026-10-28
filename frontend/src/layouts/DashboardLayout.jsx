import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Eye, MoreHorizontal, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button, cn, TooltipProvider } from "../components/ui";
import CommandPalette from "../components/CommandPalette";
import useInboxSummary from "../hooks/useInboxSummary";
import AnnouncementBanner from "../features/dashboard/Announcements";
import { endShopView, SHOP_VIEW_EXIT_URL } from "../services/shopView";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { TAB_BAR_ITEMS, STAFF_TAB_BAR_ITEMS } from "./navigation";
import { useBilling } from "../features/billing/BillingContext";

const COLLAPSED_KEY = "sidebar-collapsed";

// Mobile bottom tab bar: four main pages plus "More" for the rest
function TabBar({ onOpenMore, unreadCount, items }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              isActive ? "text-accent" : "text-fg-muted"
            )
          }
        >
          <item.icon className="h-5 w-5" aria-hidden="true" />
          <span className="max-w-full truncate px-1">{item.short || (item.name === "Messages" ? "Inbox" : item.name)}</span>
          {item.badge && unreadCount > 0 && (
            <span key={unreadCount} className="animate-badge-ring absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
          )}
        </NavLink>
      ))}
      <button
        onClick={onOpenMore}
        className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-fg-muted"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        More
      </button>
    </nav>
  );
}

// Shop pages need an active plan; say so once, clearly, above the page
function PlanBanner() {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-caption text-warning-fg lg:px-8">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">Your plan isn't active, so the inbox, orders and analytics are paused. Choose a plan to continue.</span>
      <Button as={Link} to="/dashboard/settings?tab=billing" size="sm" variant="secondary">
        View plans
      </Button>
    </div>
  );
}

// Admins have no shop data of their own; send them to the platform view
function AdminBanner() {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-accent/20 bg-accent-soft px-4 py-2.5 text-caption text-accent-soft-fg lg:px-8">
      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        You're signed in as an admin. This shop workspace is your own and has no orders or customers. Data for every shop is in the admin panel.
      </span>
      <Button as={Link} to="/admin/dashboard" size="sm">
        Open admin panel
      </Button>
    </div>
  );
}

// The Super Admin opened this shop from the Shops page ("Open as shop")
function ShopViewBanner({ user }) {
  const back = () => {
    endShopView();
    window.location.assign(SHOP_VIEW_EXIT_URL);
  };
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-caption text-warning-fg lg:px-8">
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        You're viewing <strong>{user.businessInfo?.businessName || user.name}</strong>'s dashboard as Super Admin. Changes you make here are real.
      </span>
      <Button size="sm" onClick={back}>
        Back to Super Admin
      </Button>
    </div>
  );
}

const DashboardLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const billing = useBilling();
  const staff = user?.role === "staff";
  const planInactive = user?.role !== "admin" && !staff && user?.subscription?.status !== "active";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
  const { unreadChats, unreadCount } = useInboxSummary({ enabled: !staff });
  const tabItems = staff ? STAFF_TAB_BAR_ITEMS.filter((item) => billing.can(item.perm)).slice(0, 4) : TAB_BAR_ITEMS;

  // The inbox fills the viewport and scrolls its own panes
  const fullBleed = location.pathname.startsWith("/dashboard/messages");

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1");
      return !value;
    });
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-canvas">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-surface lg:block",
            "transition-[width] duration-200 ease-out",
            collapsed ? "w-16" : "w-60"
          )}
        >
          <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} unreadCount={unreadCount} />
        </aside>

        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in lg:hidden" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-line bg-surface shadow-popover outline-none lg:hidden">
              <Dialog.Title className="sr-only">Navigation</Dialog.Title>
              <Dialog.Description className="sr-only">Main navigation</Dialog.Description>
              <Sidebar unreadCount={unreadCount} onNavigate={() => setMobileOpen(false)} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className={cn("transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-16" : "lg:pl-60")}>
          <Topbar
            onOpenMenu={() => setMobileOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            unreadChats={unreadChats}
            unreadCount={unreadCount}
            staff={staff}
          />
          {user?.actingAdmin && <ShopViewBanner user={user} />}
          {planInactive && <PlanBanner />}
          {user?.role === "admin" && <AdminBanner />}
          {user?.role !== "admin" && <AnnouncementBanner />}
          <main
            id="main"
            className={cn(
              fullBleed
                ? "h-[calc(100dvh-3.5rem-3.5rem)] md:h-[calc(100dvh-3.5rem)] overflow-hidden"
                : "mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 md:pb-10 lg:px-8"
            )}
          >
            <Outlet />
          </main>
        </div>

        <TabBar onOpenMore={() => setMobileOpen(true)} unreadCount={unreadCount} items={tabItems} />
        {!staff && <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />}
      </div>
    </TooltipProvider>
  );
};

export default DashboardLayout;
