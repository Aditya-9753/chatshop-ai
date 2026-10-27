import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { MoreHorizontal } from "lucide-react";
import { cn, TooltipProvider } from "../components/ui";
import CommandPalette from "../components/CommandPalette";
import useInboxSummary from "../hooks/useInboxSummary";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { TAB_BAR_ITEMS } from "./navigation";

const COLLAPSED_KEY = "sidebar-collapsed";

// Mobile bottom tab bar: four main pages plus "More" for the rest
function TabBar({ onOpenMore, unreadCount }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {TAB_BAR_ITEMS.map((item) => (
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
          {item.name === "Messages" ? "Inbox" : item.name}
          {item.badge && unreadCount > 0 && (
            <span className="absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
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

const DashboardLayout = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
  const { unreadChats, unreadCount } = useInboxSummary();

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
          />
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

        <TabBar onOpenMore={() => setMobileOpen(true)} unreadCount={unreadCount} />
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </TooltipProvider>
  );
};

export default DashboardLayout;
