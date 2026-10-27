import React from "react";
import { Check, CheckCheck, Package, Search } from "lucide-react";
import { ChannelIcon } from "../ui/Badge";
import { cn } from "../ui/cn";

// A live-rendered miniature of the inbox (built from the same tokens as
// the app, so it is always in sync with the real UI and both themes).
const CONVERSATIONS = [
  { name: "Priya Sharma", platform: "whatsapp", text: "Is the blue kurti in M?", time: "2m", unread: 2, active: true },
  { name: "Rahul Verma", platform: "instagram", text: "Payment done ✅", time: "14m" },
  { name: "Ananya Iyer", platform: "facebook", text: "When will it ship?", time: "1h" },
  { name: "Karan Mehta", platform: "whatsapp", text: "Thanks!", time: "3h" },
];

function Bubble({ out, children, status }) {
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-1.5 text-[11px] leading-snug",
          out ? "bg-accent text-accent-fg rounded-br-md" : "bg-surface-2 text-fg rounded-bl-md"
        )}
      >
        {children}
        {out && (
          <span className="ml-1.5 inline-flex align-middle opacity-80">
            {status === "read" ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProductPreview({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn("rounded-xl border border-line bg-surface shadow-popover overflow-hidden select-none", className)}
    >
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="ml-3 text-[10px] font-medium text-fg-muted">Inbox</span>
      </div>
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] min-h-[260px]">
        <div className="border-r border-line">
          <div className="m-2 flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[10px] text-fg-muted">
            <Search className="h-3 w-3" /> Search chats
          </div>
          {CONVERSATIONS.map((c) => (
            <div key={c.name} className={cn("flex items-start gap-2 px-2.5 py-2", c.active && "bg-accent-soft/60")}>
              <span className="relative mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold text-fg-muted">
                {c.name.split(" ").map((p) => p[0]).join("")}
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface p-px">
                  <ChannelIcon platform={c.platform} className="h-2.5 w-2.5" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[11px] font-medium text-fg">{c.name}</span>
                  <span className="text-[9px] text-fg-muted">{c.time}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[10px] text-fg-muted">{c.text}</span>
                  {c.unread && (
                    <span className="rounded-full bg-accent px-1 text-[9px] font-semibold text-accent-fg">{c.unread}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span className="text-[11px] font-semibold text-fg">Priya Sharma</span>
            <ChannelIcon platform="whatsapp" className="h-3 w-3" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5 p-3">
            <div className="mx-auto mb-1 rounded-full bg-surface-2 px-2 py-0.5 text-[9px] text-fg-muted">Today</div>
            <Bubble>Hi! Is the blue kurti available in M?</Bubble>
            <Bubble out status="read">Yes, in stock. Sending details 👇</Bubble>
            <div className="flex justify-end">
              <div className="w-[78%] rounded-xl border border-line bg-surface p-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft">
                    <Package className="h-3.5 w-3.5 text-accent-soft-fg" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-medium text-fg">Cotton kurti, indigo</div>
                    <div className="text-[10px] tabular-nums text-fg-muted">₹1,299 · Size M</div>
                  </div>
                </div>
              </div>
            </div>
            <Bubble>Perfect, I'll take it</Bubble>
          </div>
          <div className="m-2 rounded-lg border border-line px-2.5 py-1.5 text-[10px] text-fg-muted">Type a reply…</div>
        </div>
      </div>
    </div>
  );
}
