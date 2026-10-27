import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { X } from "lucide-react";
import { cn } from "./cn";

const MODAL_SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

function CloseButton() {
  return (
    <Dialog.Close
      className="rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
      aria-label="Close"
    >
      <X className="w-4 h-4" />
    </Dialog.Close>
  );
}

/**
 * Centered dialog. Focus is trapped and Escape closes it (Radix Dialog).
 * `footer` renders a right-aligned action row.
 */
export function Modal({ open, onOpenChange, title, description, size = "md", footer, children, className }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] flex flex-col",
            "rounded-2xl border border-line bg-surface shadow-popover animate-slide-up outline-none",
            MODAL_SIZES[size],
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-fg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-caption text-fg-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <CloseButton />
          </div>
          {children && <div className="px-5 pb-5 overflow-y-auto scrollbar-thin">{children}</div>}
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Side sheet that slides in from the right (bottom sheet on phones)
export function Drawer({ open, onOpenChange, title, description, footer, width = "max-w-xl", children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface border-line shadow-popover outline-none",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border-t animate-slide-in-bottom",
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:h-full sm:w-full sm:rounded-none sm:border-t-0 sm:border-l sm:animate-slide-in-right",
            width
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-fg truncate">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-caption text-fg-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <CloseButton />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Confirmation dialog for destructive actions
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", tone = "danger", onConfirm, loading }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Dialog.Close asChild>
            <button className="h-9 px-3.5 rounded-lg border border-line bg-surface text-sm font-medium text-fg hover:bg-surface-2 transition-colors">
              Cancel
            </button>
          </Dialog.Close>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "h-9 px-3.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors",
              tone === "danger"
                ? "bg-danger text-white dark:text-canvas hover:opacity-90"
                : "bg-accent text-accent-fg hover:bg-accent-hover"
            )}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </>
      }
    />
  );
}

export const DropdownMenu = Menu.Root;
export const DropdownTrigger = Menu.Trigger;

export function DropdownContent({ align = "end", className, children, ...props }) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-[180px] rounded-xl border border-line bg-surface p-1 shadow-popover animate-fade-in",
          className
        )}
        {...props}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropdownItem({ icon: Icon, danger, className, children, ...props }) {
  return (
    <Menu.Item
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none cursor-pointer select-none",
        "data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        danger ? "text-danger-fg" : "text-fg",
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn("w-4 h-4", danger ? "text-danger-fg" : "text-fg-muted")} aria-hidden="true" />}
      {children}
    </Menu.Item>
  );
}

export function DropdownLabel({ children }) {
  return <Menu.Label className="px-2 py-1.5 text-xs text-fg-muted">{children}</Menu.Label>;
}

export function DropdownSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />;
}

export const TooltipProvider = RadixTooltip.Provider;

export function Tooltip({ content, side = "top", children }) {
  if (!content) return children;
  return (
    <RadixTooltip.Root delayDuration={300}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-fg px-2 py-1 text-xs text-canvas shadow-popover animate-fade-in"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
