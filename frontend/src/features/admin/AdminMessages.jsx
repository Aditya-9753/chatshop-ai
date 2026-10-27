import React, { useEffect, useState } from "react";
import { Check, CheckCheck, MessageSquare } from "lucide-react";
import adminService from "../../services/admin.service";
import { Avatar, Badge, ChannelBadge, cn, DataTable, Drawer, PageHeader, Skeleton, StatusPill } from "../../components/ui";
import { formatDayLabel, formatRelative, formatTime } from "../../utils/format";
import { ShopCell, shopName, useAdminList } from "./AdminRecords";

// Read-only thread so the admin can see what a shop and customer said
function Thread({ conversationId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    adminService
      .getConversationMessages(conversationId)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message || "Couldn't load the messages"));
  }, [conversationId]);

  if (error) return <p className="text-caption text-danger-fg">{error}</p>;
  if (!data) {
    return (
      <div className="space-y-3">
        {[60, 40, 70].map((w, i) => (
          <Skeleton key={i} className="h-10 rounded-2xl" style={{ width: `${w}%`, marginLeft: i % 2 ? "auto" : 0 }} />
        ))}
      </div>
    );
  }
  if (data.messages.length === 0) return <p className="text-caption text-fg-muted">No messages in this conversation.</p>;

  let lastDay = null;
  return (
    <div className="flex flex-col gap-1.5">
      {data.messages.map((m) => {
        const day = new Date(m.createdAt).toDateString();
        const showDay = day !== lastDay;
        lastDay = day;
        const out = m.direction === "outgoing";
        const Tick = m.status === "sent" ? Check : CheckCheck;
        return (
          <React.Fragment key={m._id}>
            {showDay && (
              <div className="my-2 flex justify-center">
                <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-fg-muted">{formatDayLabel(m.createdAt)}</span>
              </div>
            )}
            <div className={cn("flex", out ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", out ? "rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md border border-line bg-surface-2 text-fg")}>
                <p className="whitespace-pre-wrap break-words">{m.content?.text || m.content?.caption || `[${m.type}]`}</p>
                <p className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", out ? "text-accent-fg/80" : "text-fg-muted")}>
                  {formatTime(m.createdAt)}
                  {out && m.status === "failed" && <span className="font-medium">· Not delivered</span>}
                  {out && ["sent", "delivered", "read"].includes(m.status) && <Tick className="h-3.5 w-3.5" aria-label={m.status} />}
                </p>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function AdminMessages() {
  const list = useAdminList("conversations");
  const [open, setOpen] = useState(null);
  const unread = list.rows.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const columns = [
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      sortValue: (c) => c.customerId?.name,
      cell: (c) => (
        <span className="flex items-center gap-3">
          <Avatar name={c.customerId?.name} size="sm" platform={c.platform} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{c.customerId?.name || "Customer"}</span>
              {c.unreadCount > 0 && <Badge tone="accent">{c.unreadCount} unread</Badge>}
            </span>
            <span className="block max-w-xs truncate text-caption text-fg-muted">
              {c.lastMessage?.direction === "outgoing" ? "Shop: " : ""}
              {c.lastMessage?.content || "No messages"}
            </span>
          </span>
        </span>
      ),
    },
    { key: "shop", header: "Shop", sortable: true, sortValue: (c) => shopName(c.userId), cell: (c) => <ShopCell shop={c.userId} /> },
    { key: "platform", header: "Channel", hideBelow: "md", cell: (c) => <ChannelBadge platform={c.platform} /> },
    { key: "status", header: "Status", hideBelow: "lg", cell: (c) => <StatusPill status={c.status} /> },
    {
      key: "last",
      header: "Last message",
      sortable: true,
      sortValue: (c) => (c.lastMessage?.timestamp ? new Date(c.lastMessage.timestamp) : null),
      cell: (c) => <span className="text-fg-muted">{formatRelative(c.lastMessage?.timestamp)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Messages" description={`Every conversation on every shop · ${list.rows.length} chats · ${unread} unread`} />
      <DataTable
        columns={columns}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.load}
        searchable
        searchPlaceholder="Search customer, message or shop"
        searchText={(c) => `${c.customerId?.name || ""} ${c.customerId?.phone || ""} ${c.lastMessage?.content || ""} ${shopName(c.userId)}`}
        toolbar={list.shopFilter}
        onRowClick={setOpen}
        empty={{ icon: MessageSquare, title: "No conversations yet", description: "Chats from every shop appear here." }}
        pageSize={20}
      />
      <Drawer
        open={!!open}
        onOpenChange={(v) => !v && setOpen(null)}
        title={open?.customerId?.name || "Conversation"}
        description={open && `${shopName(open.userId)} · ${open.customerId?.phone || ""} · read-only`}
      >
        {open && <Thread conversationId={open._id} />}
      </Drawer>
    </div>
  );
}
