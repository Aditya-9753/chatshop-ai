import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { BarChart3, LayoutDashboard, Lock, LogOut, Menu, Moon, Sun, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { LogoMark } from "../../components/Logo";
import {
  Avatar,
  Badge,
  Button,
  cn,
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
  TooltipProvider,
} from "../../components/ui";

export const ADMIN_SECTIONS = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "users", label: "Users", icon: Users },
  { value: "analytics", label: "Analytics", icon: BarChart3 },
  { value: "security", label: "Security", icon: Lock },
];

function AdminNav({ section, onSection }) {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2.5 p-1.5">
        <LogoMark />
        <span className="text-sm font-semibold text-fg">ChatShop</span>
        <Badge tone="accent">Admin</Badge>
      </div>
      <nav aria-label="Admin" className="mt-2 flex-1">
        <ul className="flex flex-col gap-0.5">
          {ADMIN_SECTIONS.map((item) => {
            const active = item.value === section;
            return (
              <li key={item.value}>
                <button
                  onClick={() => onSection(item.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                    active ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active && "text-accent")} aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

// Same structure as the app shell, with an "Admin" badge and admin nav
export default function AdminShell({ section, onSection, children }) {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (value) => {
    onSection(value);
    setMenuOpen(false);
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-canvas">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line bg-surface lg:block">
          <AdminNav section={section} onSection={go} />
        </aside>

        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in lg:hidden" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-line bg-surface outline-none lg:hidden">
              <Dialog.Title className="sr-only">Admin navigation</Dialog.Title>
              <Dialog.Description className="sr-only">Admin sections</Dialog.Description>
              <AdminNav section={section} onSection={go} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="lg:pl-60">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas/85 px-4 backdrop-blur lg:px-8">
            <Button variant="ghost" size="icon" icon={Menu} onClick={() => setMenuOpen(true)} className="lg:hidden" aria-label="Open menu" />
            <span className="text-sm text-fg-muted">Platform administration</span>
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownTrigger asChild>
                  <button className="rounded-full" aria-label="Account menu">
                    <Avatar name={user?.name} size="sm" />
                  </button>
                </DropdownTrigger>
                <DropdownContent className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium text-fg">{user?.name}</p>
                    <p className="truncate text-xs text-fg-muted">{user?.email}</p>
                  </div>
                  <DropdownSeparator />
                  <DropdownItem icon={isDarkMode ? Sun : Moon} onSelect={toggleTheme}>
                    {isDarkMode ? "Light mode" : "Dark mode"}
                  </DropdownItem>
                  <DropdownItem
                    icon={LogOut}
                    onSelect={() => {
                      logout();
                      navigate("/admin/login");
                    }}
                  >
                    Log out
                  </DropdownItem>
                </DropdownContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 lg:px-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
