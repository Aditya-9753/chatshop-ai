import React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CreditCard, LogOut, Menu, Moon, Search, Sun, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "../components/ui";
import { formatRelative } from "../utils/format";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function Notifications({ unreadChats, unreadCount }) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread messages` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-80 p-0">
        <div className="border-b border-line px-3 py-2.5">
          <p className="text-sm font-semibold text-fg">Notifications</p>
        </div>
        {unreadChats.length === 0 ? (
          <p className="px-3 py-8 text-center text-caption text-fg-muted">You're all caught up.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1">
            {unreadChats.slice(0, 8).map((chat) => (
              <DropdownItem
                key={chat._id}
                className="items-start py-2"
                onSelect={() => navigate(`/dashboard/messages?customer=${chat.customerId?._id}`)}
              >
                <Avatar name={chat.customerId?.name} size="sm" platform={chat.platform} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-fg">{chat.customerId?.name || "Customer"}</span>
                    <span className="shrink-0 text-xs text-fg-muted">{formatRelative(chat.lastMessage?.timestamp)}</span>
                  </span>
                  <span className="block truncate text-caption text-fg-muted">
                    {chat.unreadCount} new · {chat.lastMessage?.content}
                  </span>
                </span>
              </DropdownItem>
            ))}
          </div>
        )}
        <DropdownSeparator />
        <div className="p-1">
          <DropdownItem onSelect={() => navigate("/dashboard/messages")} className="justify-center text-accent">
            Open inbox
          </DropdownItem>
        </div>
      </DropdownContent>
    </DropdownMenu>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button className="rounded-full" aria-label="Account menu">
          <Avatar name={user?.name} src={user?.profilePhoto} size="sm" />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium text-fg">{user?.name}</p>
          <p className="truncate text-xs text-fg-muted">{user?.email}</p>
        </div>
        <DropdownSeparator />
        <DropdownItem icon={User} onSelect={() => navigate("/dashboard/settings?tab=profile")}>
          Profile
        </DropdownItem>
        <DropdownItem icon={CreditCard} onSelect={() => navigate("/dashboard/settings?tab=billing")}>
          Billing
        </DropdownItem>
        <DropdownItem icon={isDarkMode ? Sun : Moon} onSelect={toggleTheme}>
          {isDarkMode ? "Light mode" : "Dark mode"}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownLabel>Signed in as {user?.role === "admin" ? "admin" : "owner"}</DropdownLabel>
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

export default function Topbar({ onOpenMenu, onOpenSearch, unreadChats, unreadCount }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-canvas/70 lg:px-6">
      <Button variant="ghost" size="icon" icon={Menu} onClick={onOpenMenu} className="lg:hidden" aria-label="Open menu" />

      <button
        onClick={onOpenSearch}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-fg-subtle hover:border-line-strong transition-colors"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="flex-1 truncate text-left">
          <span className="sm:hidden">Search</span>
          <span className="hidden sm:inline">Search customers, orders…</span>
        </span>
        <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 font-mono text-[11px] text-fg-muted sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Notifications unreadChats={unreadChats} unreadCount={unreadCount} />
        <AccountMenu />
      </div>
    </header>
  );
}
