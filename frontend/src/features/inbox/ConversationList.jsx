import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, Radio, Search } from "lucide-react";
import { Avatar, Button, cn, EmptyState, ErrorState, Skeleton, Tabs } from "../../components/ui";
import { formatRelative } from "../../utils/format";

const CHANNEL_FILTERS = [
  { value: "all", label: "All channels" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
];

function ConversationRow({ conversation, active, fresh, onSelect }) {
  const customer = conversation.customerId || {};
  const last = conversation.lastMessage || {};
  const unread = conversation.unreadCount > 0;
  const preview = last.content || "No messages yet";

  return (
    <li>
      <button
        onClick={() => onSelect(conversation)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors duration-150",
          active ? "bg-accent-soft/70" : "hover:bg-surface-2",
          fresh && !active && "animate-row-glow"
        )}
      >
        <Avatar name={customer.name} src={customer.profilePicture} platform={conversation.platform} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm text-fg", unread ? "font-semibold" : "font-medium")}>
              {customer.name || customer.phone || "Unknown"}
            </span>
            <span className={cn("shrink-0 text-xs tabular-nums", unread ? "text-accent font-medium" : "text-fg-muted")}>
              {formatRelative(last.timestamp)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className={cn("truncate text-caption", unread ? "text-fg" : "text-fg-muted")}>
              {last.direction === "outgoing" && <span className="text-fg-muted">You: </span>}
              {preview}
            </span>
            {unread && (
              <span className="shrink-0 rounded-full bg-accent px-1.5 text-xs font-semibold tabular-nums text-accent-fg">
                {conversation.unreadCount}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function ConversationList({ conversations, loading, error, onRetry, selectedId, onSelect, onBroadcast, freshId }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [channel, setChannel] = useState("all");

  const unreadTotal = conversations.filter((c) => c.unreadCount > 0).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      const customer = c.customerId || {};
      if (view === "unread" && !(c.unreadCount > 0)) return false;
      if (view === "closed" ? c.status !== "closed" : view !== "all" && c.status === "closed") return false;
      if (channel !== "all" && c.platform !== channel) return false;
      if (!q) return true;
      return (
        (customer.name || "").toLowerCase().includes(q) ||
        (customer.phone || "").replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        (c.lastMessage?.content || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, query, view, channel]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-line p-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-fg">Inbox</h1>
          <Button variant="secondary" size="sm" icon={Radio} onClick={onBroadcast}>
            Broadcast
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
              className="h-8 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
            />
          </div>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            aria-label="Filter by channel"
            className="h-8 w-[104px] rounded-lg border border-line bg-surface px-2 text-xs text-fg-muted outline-none focus:border-accent"
          >
            {CHANNEL_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Tabs
          variant="pill"
          label="Filter chats"
          value={view}
          onChange={setView}
          fill
          tabs={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread", count: unreadTotal || undefined },
            { value: "closed", label: "Closed" },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex flex-col gap-1 p-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState title="Couldn't load chats" description={error} onRetry={onRetry} />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No conversations yet"
            description="Messages from WhatsApp, Instagram and Facebook land here as soon as a channel is connected."
            action={
              <Button as={Link} to="/dashboard/settings?tab=channels" size="sm">
                Connect a channel
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="No chats match" description="Try another search or filter." />
        ) : (
          <ul className="divide-y divide-line/60">
            {visible.map((conversation) => (
              <ConversationRow
                key={conversation._id === freshId?.id ? `${conversation._id}-${freshId.at}` : conversation._id}
                conversation={conversation}
                active={conversation._id === selectedId}
                fresh={conversation._id === freshId?.id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
