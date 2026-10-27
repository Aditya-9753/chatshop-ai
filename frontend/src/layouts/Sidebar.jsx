import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronsLeft, ChevronsUpDown, CreditCard, LogOut, Settings, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LogoMark } from "../components/Logo";
import {
  cn,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  Tooltip,
} from "../components/ui";
import { NAV_GROUPS } from "./navigation";

const PLAN_NAMES = { starter: "Starter", business: "Business", premium: "Premium", "one-time": "Lifetime" };

// Days left in the current billing period (or trial), for the usage meter
function planUsage(subscription) {
  if (!subscription?.endDate || subscription.status !== "active") return null;
  const start = new Date(subscription.startDate || Date.now()).getTime();
  const end = new Date(subscription.endDate).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const used = Math.min(1, Math.max(0, (Date.now() - start) / (end - start || 1)));
  return { daysLeft, used };
}

function WorkspaceSwitcher({ collapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.businessInfo?.businessName || `${user?.name?.split(" ")[0] || "My"}'s shop`;

  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-surface-2 transition-colors",
            collapsed && "justify-center"
          )}
          aria-label="Workspace menu"
        >
          <LogoMark />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-fg">{name}</span>
                <span className="block truncate text-xs text-fg-muted">ChatShop AI</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
            </>
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-56">
        <DropdownLabel>{user?.email}</DropdownLabel>
        <DropdownItem icon={Settings} onSelect={() => navigate("/dashboard/settings")}>
          Workspace settings
        </DropdownItem>
        <DropdownItem icon={CreditCard} onSelect={() => navigate("/dashboard/settings?tab=billing")}>
          Billing
        </DropdownItem>
        {user?.role === "admin" && (
          <DropdownItem icon={ShieldCheck} onSelect={() => navigate("/admin/dashboard")}>
            Admin panel
          </DropdownItem>
        )}
        <DropdownSeparator />
        <DropdownItem
          icon={LogOut}
          onSelect={() => {
            logout();
            navigate("/login");
          }}
        >
          Log out
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}

function PlanCard({ collapsed }) {
  const { user } = useAuth();
  const subscription = user?.subscription;
  const usage = planUsage(subscription);
  if (collapsed) return null;

  // Admins don't need a plan; point them at the admin panel instead
  if (user?.role === "admin") {
    return (
      <Link to="/admin/dashboard" className="block rounded-lg border border-line bg-surface p-3 hover:border-line-strong transition-colors">
        <span className="flex items-center gap-1.5 text-caption font-medium text-fg">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Admin account
        </span>
        <p className="mt-1 text-xs text-fg-muted">Open the admin panel to manage shops and plans.</p>
      </Link>
    );
  }

  const planName = PLAN_NAMES[subscription?.plan] ? `${PLAN_NAMES[subscription.plan]} plan` : "No plan";
  const active = subscription?.status === "active";

  return (
    <Link
      to="/dashboard/settings?tab=billing"
      className="block rounded-lg border border-line bg-surface p-3 hover:border-line-strong transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium text-fg">{planName}</span>
        <span className={cn("text-xs font-medium", active ? "text-success-fg" : "text-warning-fg")}>
          {active ? "Active" : "Inactive"}
        </span>
      </div>
      {usage ? (
        <>
          <div
            className="mt-2 h-1 rounded-full bg-surface-3"
            role="meter"
            aria-label="Billing period used"
            aria-valuenow={Math.round(usage.used * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn("h-1 rounded-full", usage.daysLeft <= 3 ? "bg-warning" : "bg-accent")}
              style={{ width: `${Math.round(usage.used * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-fg-muted">
            {usage.daysLeft} day{usage.daysLeft === 1 ? "" : "s"} left in this period
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-fg-muted">Choose a plan to keep using the inbox</p>
      )}
    </Link>
  );
}

export default function Sidebar({ collapsed, onToggleCollapsed, unreadCount, onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <WorkspaceSwitcher collapsed={collapsed} />

      <nav className="mt-2 flex-1 overflow-y-auto scrollbar-none" aria-label="Main">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.label || index} className="mb-4">
            {group.label && !collapsed && (
              <p className="mb-1 px-2.5 text-xs font-medium text-fg-muted">{group.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const badge = item.badge === "unread" && unreadCount > 0 ? unreadCount : null;
                return (
                  <li key={item.href}>
                    <Tooltip content={collapsed ? item.name : null} side="right">
                      <NavLink
                        to={item.href}
                        end={item.end}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            "group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150",
                            collapsed && "justify-center px-0",
                            isActive
                              ? "bg-surface-2 text-fg font-medium"
                              : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span className="relative">
                              <item.icon className={cn("h-4 w-4", isActive && "text-accent")} aria-hidden="true" />
                              {collapsed && badge && (
                                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />
                              )}
                            </span>
                            {!collapsed && <span className="flex-1 truncate">{item.name}</span>}
                            {!collapsed && badge && (
                              <span className="rounded-md bg-accent px-1.5 text-xs font-semibold tabular-nums text-accent-fg">
                                {badge > 99 ? "99+" : badge}
                              </span>
                            )}
                            {badge && <span className="sr-only">, {badge} unread</span>}
                          </>
                        )}
                      </NavLink>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <PlanCard collapsed={collapsed} />

      {onToggleCollapsed && (
        <button
          onClick={onToggleCollapsed}
          className={cn(
            "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors",
            collapsed && "justify-center px-0"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} aria-hidden="true" />
          {!collapsed && "Collapse"}
        </button>
      )}
    </div>
  );
}
