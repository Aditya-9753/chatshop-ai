import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ArrowLeft, CheckCircle2, MessageSquare, MoreVertical, PanelRight, RotateCcw } from "lucide-react";
import {
  Avatar,
  Button,
  ChannelBadge,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusPill,
} from "../../components/ui";
import { formatDayLabel } from "../../utils/format";
import MessageBubble from "./MessageBubble";

const GROUP_GAP_MS = 5 * 60 * 1000;

// Insert a date separator before the first message of each day, and mark
// messages that continue a run from the same side within five minutes
function buildTimeline(messages) {
  const items = [];
  let lastDay = null;
  messages.forEach((message, i) => {
    const day = new Date(message.createdAt).toDateString();
    if (day !== lastDay) {
      items.push({ kind: "day", key: `day-${day}`, label: formatDayLabel(message.createdAt) });
      lastDay = day;
    }
    const prev = messages[i - 1];
    const grouped =
      prev &&
      prev.direction === message.direction &&
      new Date(prev.createdAt).toDateString() === day &&
      new Date(message.createdAt) - new Date(prev.createdAt) < GROUP_GAP_MS;
    items.push({ kind: "message", key: message._id, message, grouped });
  });
  return items;
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-6">
      {[60, 40, 70, 35, 55].map((width, i) => (
        <div key={i} className={i % 2 ? "flex justify-end" : "flex"}>
          <Skeleton className="h-10 rounded-2xl" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function ChatThread({
  conversation,
  messages,
  loading,
  error,
  onRetryLoad,
  onBack,
  onTogglePanel,
  onSetStatus,
  onRetryMessage,
  onEditMessage,
  onDeleteMessage,
  composer,
}) {
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const customer = conversation.customerId || {};
  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const closed = conversation.status === "closed";

  // Follow new messages only when the reader is already near the bottom
  const onScroll = () => {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    stickToBottom.current = true;
  }, [conversation._id]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [timeline, loading]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
        <Button variant="ghost" size="icon" icon={ArrowLeft} onClick={onBack} className="md:hidden" aria-label="Back to chats" />
        <Avatar name={customer.name} src={customer.profilePicture} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-fg">{customer.name || customer.phone || "Customer"}</h2>
            <ChannelBadge platform={conversation.platform} compact />
            {closed && <StatusPill status="closed" />}
          </div>
          {customer.phone && <p className="truncate text-xs text-fg-muted">{customer.phone}</p>}
        </div>
        <DropdownMenu>
          <DropdownTrigger asChild>
            <Button variant="ghost" size="icon" icon={MoreVertical} aria-label="Conversation actions" />
          </DropdownTrigger>
          <DropdownContent>
            {closed ? (
              <DropdownItem icon={RotateCcw} onSelect={() => onSetStatus("open")}>
                Reopen conversation
              </DropdownItem>
            ) : (
              <DropdownItem icon={CheckCircle2} onSelect={() => onSetStatus("closed")}>
                Mark as closed
              </DropdownItem>
            )}
          </DropdownContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" icon={PanelRight} onClick={onTogglePanel} aria-label="Customer details" />
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 sm:px-6"
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${customer.name || "customer"}`}
      >
        {loading ? (
          <ThreadSkeleton />
        ) : error ? (
          <ErrorState title="Couldn't load messages" description={error} onRetry={onRetryLoad} />
        ) : messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No messages yet" description="Send the first message below." />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col pb-2">
            {timeline.map((item) =>
              item.kind === "day" ? (
                <div key={item.key} className="sticky top-0 z-10 my-3 flex justify-center">
                  <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-fg-muted">
                    {item.label}
                  </span>
                </div>
              ) : (
                <MessageBubble
                  key={item.key}
                  message={item.message}
                  grouped={item.grouped}
                  onRetry={onRetryMessage}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                />
              )
            )}
          </div>
        )}
      </div>

      {composer}
    </div>
  );
}
