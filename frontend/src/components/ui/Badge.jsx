import React from "react";
import { cn } from "./cn";

const TONES = {
  neutral: "bg-surface-2 text-fg-muted border-line",
  accent: "bg-accent-soft text-accent-soft-fg border-transparent",
  success: "bg-success-soft text-success-fg border-transparent",
  warning: "bg-warning-soft text-warning-fg border-transparent",
  danger: "bg-danger-soft text-danger-fg border-transparent",
};

const DOTS = {
  neutral: "bg-fg-subtle",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Badge({ tone = "neutral", dot, className, children }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}

// Order, payment, stock and message states share one mapping
const STATUS_TONES = {
  pending: "warning",
  confirmed: "accent",
  processing: "accent",
  paid: "success",
  shipped: "accent",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
  refunded: "neutral",
  failed: "danger",
  unpaid: "warning",
  partial: "warning",
  active: "success",
  inactive: "neutral",
  expired: "danger",
  open: "accent",
  closed: "neutral",
  archived: "neutral",
  snoozed: "warning",
  "in stock": "success",
  "low stock": "warning",
  "out of stock": "danger",
};

export function StatusPill({ status, label, className }) {
  const key = String(status || "").toLowerCase();
  const text = label || key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return (
    <Badge tone={STATUS_TONES[key] || "neutral"} dot className={className}>
      {text}
    </Badge>
  );
}

// Small brand marks; the channel colour is used only here
function WhatsAppMark(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.24 8.24 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.25 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  );
}

function InstagramMark(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookMark(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7.5h2.53l.38-2.94H13.5V8.7c0-.85.24-1.43 1.46-1.43h1.55V4.64A20.8 20.8 0 0 0 14.25 4.5c-2.24 0-3.77 1.37-3.77 3.88v2.18H7.95v2.94h2.53V21h3.02Z" />
    </svg>
  );
}

export const CHANNELS = {
  whatsapp: { label: "WhatsApp", icon: WhatsAppMark, color: "text-whatsapp" },
  instagram: { label: "Instagram", icon: InstagramMark, color: "text-instagram" },
  facebook: { label: "Facebook", icon: FacebookMark, color: "text-facebook" },
};

export function ChannelIcon({ platform, className }) {
  const channel = CHANNELS[platform];
  if (!channel) return null;
  const Icon = channel.icon;
  return <Icon className={cn("w-3.5 h-3.5 shrink-0", channel.color, className)} aria-hidden="true" />;
}

// Channel badge: brand mark plus name (or the mark alone when compact)
export function ChannelBadge({ platform, compact, className }) {
  const channel = CHANNELS[platform];
  if (!channel) return null;

  if (compact) {
    return (
      <span title={channel.label} className={cn("inline-flex", className)}>
        <ChannelIcon platform={platform} />
        <span className="sr-only">{channel.label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs font-medium text-fg-muted",
        className
      )}
    >
      <ChannelIcon platform={platform} />
      {channel.label}
    </span>
  );
}
