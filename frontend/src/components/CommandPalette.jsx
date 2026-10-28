import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { Moon, Plus, Search, ShoppingCart, Sun, User } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import customerService from "../services/customer.service";
import orderService from "../services/order.service";
import { NAV_ITEMS } from "../layouts/navigation";
import { ChannelIcon } from "./ui";
import { formatCurrency } from "../utils/format";

const itemClass =
  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg cursor-pointer select-none data-[selected=true]:bg-surface-2";
const groupClass =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-muted";

/**
 * Ctrl+K / ⌘K: jump to a page, a customer or an order, or run an action.
 * Customers and orders are loaded when the palette opens.
 */
export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const onKeyDown = (event) => {
      // Browser autofill fires keydown events with no key
      if (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    customerService
      .getCustomers({ limit: 200 })
      .then((res) => setCustomers(res.data || []))
      .catch(() => {});
    orderService
      .getOrders({ limit: 100 })
      .then((res) => setOrders(res.data || []))
      .catch(() => {});
  }, [open]);

  const run = (action) => {
    onOpenChange(false);
    action();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search"
      overlayClassName="fixed inset-0 z-50 bg-overlay animate-fade-in"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-popover animate-slide-up"
    >
      {/* Names the dialog for screen readers (Radix requires both) */}
      <Dialog.Title className="sr-only">Search</Dialog.Title>
      <Dialog.Description className="sr-only">Jump to a page, a customer or an order, or run an action.</Dialog.Description>
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Search className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
        <Command.Input
          placeholder="Search pages, customers, orders…"
          className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <kbd className="rounded border border-line bg-surface-2 px-1.5 font-mono text-[11px] text-fg-muted">Esc</kbd>
      </div>
      <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto scrollbar-thin p-1.5">
        <Command.Empty className="py-10 text-center text-sm text-fg-muted">No results.</Command.Empty>

        <Command.Group heading="Actions" className={groupClass}>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/dashboard/orders?new=1"))}>
            <Plus className="h-4 w-4 text-fg-muted" /> New order
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/dashboard/customers?new=1"))}>
            <Plus className="h-4 w-4 text-fg-muted" /> New customer
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/dashboard/products?new=1"))}>
            <Plus className="h-4 w-4 text-fg-muted" /> New product
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(toggleTheme)} keywords={["theme", "dark", "light"]}>
            {isDarkMode ? <Sun className="h-4 w-4 text-fg-muted" /> : <Moon className="h-4 w-4 text-fg-muted" />}
            Switch to {isDarkMode ? "light" : "dark"} mode
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Pages" className={groupClass}>
          {NAV_ITEMS.map((item) => (
            <Command.Item key={item.href} className={itemClass} onSelect={() => run(() => navigate(item.href))}>
              <item.icon className="h-4 w-4 text-fg-muted" /> {item.name}
            </Command.Item>
          ))}
        </Command.Group>

        {customers.length > 0 && (
          <Command.Group heading="Customers" className={groupClass}>
            {customers.map((customer) => (
              <Command.Item
                key={customer._id}
                value={`customer ${customer.name} ${customer.phone || ""} ${customer.email || ""} ${customer._id}`}
                className={itemClass}
                onSelect={() => run(() => navigate(`/dashboard/customers?id=${customer._id}`))}
              >
                <User className="h-4 w-4 text-fg-muted" />
                <span className="flex-1 truncate">{customer.name}</span>
                <span className="text-xs text-fg-muted">{customer.phone}</span>
                <ChannelIcon platform={customer.platform} />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {orders.length > 0 && (
          <Command.Group heading="Orders" className={groupClass}>
            {orders.map((order) => (
              <Command.Item
                key={order._id}
                value={`order ${order.orderNumber} ${order.customerId?.name || ""} ${order._id}`}
                className={itemClass}
                onSelect={() => run(() => navigate(`/dashboard/orders?id=${order._id}`))}
              >
                <ShoppingCart className="h-4 w-4 text-fg-muted" />
                <span className="font-mono text-caption">{order.orderNumber}</span>
                <span className="flex-1 truncate text-fg-muted">{order.customerId?.name}</span>
                <span className="text-xs tabular-nums text-fg-muted">{formatCurrency(order.total)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
