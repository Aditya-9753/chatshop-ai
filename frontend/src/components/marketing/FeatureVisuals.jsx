import React from "react";
import { ArrowUpRight, Check, CheckCheck, Truck } from "lucide-react";
import { ChannelIcon } from "../ui/Badge";
import { cn } from "../ui/cn";

// Small, static renders of real screens, built from the app's own tokens

const Frame = ({ className, children }) => (
  <div aria-hidden="true" className={cn("select-none rounded-xl border border-line bg-surface p-4 shadow-popover", className)}>
    {children}
  </div>
);

const Pill = ({ tone, children }) => {
  const tones = {
    warning: "bg-warning-soft text-warning-fg",
    accent: "bg-accent-soft text-accent-soft-fg",
    success: "bg-success-soft text-success-fg",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
};

export function InboxVisual() {
  return (
    <Frame className="flex flex-col gap-2">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold text-fg-muted">AI</span>
        <span className="text-sm font-semibold text-fg">Ananya Iyer</span>
        <ChannelIcon platform="instagram" />
        <span className="ml-auto text-xs text-fg-muted">Instagram</span>
      </div>
      <div className="mt-1 max-w-[75%] rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-2 text-[13px] text-fg">
        Do you ship to Pune? 🙂
      </div>
      <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[13px] text-accent-fg">
        Yes! Free shipping above ₹500, delivered in 3–5 days.
        <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
          4:12 pm <CheckCheck className="h-3 w-3" strokeWidth={2.75} />
        </span>
      </div>
      <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-md bg-accent px-3 py-2 text-[13px] text-accent-fg">
        Want me to reserve one for you?
        <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
          4:12 pm <Check className="h-3 w-3" />
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Delivery time", "Payment methods", "Return policy"].map((t) => (
          <span key={t} className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-fg-muted">
            {t}
          </span>
        ))}
      </div>
    </Frame>
  );
}

export function OrdersVisual() {
  const rows = [
    { id: "ORD-1042", name: "Priya Sharma", total: "₹1,299", status: ["accent", "Confirmed"], platform: "whatsapp" },
    { id: "ORD-1041", name: "Rahul Verma", total: "₹3,450", status: ["accent", "Shipped"], platform: "instagram", icon: Truck },
    { id: "ORD-1040", name: "Karan Mehta", total: "₹899", status: ["success", "Delivered"], platform: "whatsapp" },
    { id: "ORD-1039", name: "Sneha Reddy", total: "₹2,100", status: ["warning", "Pending"], platform: "facebook" },
  ];
  return (
    <Frame className="p-0">
      <div className="flex gap-4 border-b border-line px-4 pt-3 text-[12px]">
        {["All", "Pending", "Paid", "Shipped"].map((t, i) => (
          <span key={t} className={cn("-mb-px border-b-2 pb-2", i === 0 ? "border-accent text-fg" : "border-transparent text-fg-muted")}>
            {t}
          </span>
        ))}
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
            <span className="font-mono text-[11px] text-fg-muted">{r.id}</span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-fg">
              {r.name} <ChannelIcon platform={r.platform} className="h-3 w-3" />
            </span>
            <span className="tabular-nums text-fg">{r.total}</span>
            <Pill tone={r.status[0]}>{r.status[1]}</Pill>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export function InsightsVisual() {
  const bars = [32, 45, 38, 60, 52, 74, 68];
  return (
    <Frame>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Revenue", "₹84,320", "12.4%"],
          ["Median response", "4m", "31.0%"],
        ].map(([label, value, delta]) => (
          <div key={label} className="rounded-lg border border-line p-3">
            <p className="text-[11px] text-fg-muted">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-fg">{value}</p>
            <p className="flex items-center gap-0.5 text-[11px] font-medium text-success-fg">
              <ArrowUpRight className="h-3 w-3" /> {delta}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-28 items-end gap-2 border-b border-line">
        {bars.map((h, i) => (
          <span key={i} className="flex-1 rounded-t bg-chart-1" style={{ height: `${h}%`, opacity: i === bars.length - 1 ? 1 : 0.55 }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-fg-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </Frame>
  );
}
