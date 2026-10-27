import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Circle, Clock, MessageSquare, PackageX, ShoppingCart } from "lucide-react";
import { Avatar, Button, Card, CardHeader, ChannelBadge, cn } from "../../components/ui";
import { formatRelative } from "../../utils/format";

function AttentionGroup({ icon: Icon, title, count, to, children, empty }) {
  return (
    <div className="border-t border-line px-5 py-4 first:border-t-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-caption font-medium text-fg">
          <Icon className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          {title}
          <span className={cn("rounded px-1.5 text-xs tabular-nums", count ? "bg-warning-soft text-warning-fg" : "bg-surface-2 text-fg-muted")}>
            {count}
          </span>
        </span>
        {count > 0 && (
          <Link to={to} className="text-xs font-medium text-accent hover:underline">
            View all
          </Link>
        )}
      </div>
      {count === 0 ? <p className="text-caption text-fg-muted">{empty}</p> : <ul className="flex flex-col gap-1">{children}</ul>}
    </div>
  );
}

// "Needs attention": unanswered chats, pending orders and low stock
export function NeedsAttention({ attention }) {
  const { unansweredChats, unansweredCount, pendingOrders, pendingCount, lowStock, lowStockCount, lowStockThreshold } = attention;

  return (
    <Card>
      <CardHeader title="Needs attention" description="Oldest first" />
      <AttentionGroup icon={MessageSquare} title="Unanswered chats" count={unansweredCount} to="/dashboard/messages" empty="Every chat has a reply.">
        {unansweredChats.map((chat) => (
          <li key={chat._id}>
            <Link
              to={`/dashboard/messages?customer=${chat.customerId?._id}`}
              className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2 transition-colors"
            >
              <Avatar name={chat.customerId?.name} size="xs" platform={chat.platform} />
              <span className="min-w-0 flex-1 truncate text-caption text-fg">
                <span className="font-medium">{chat.customerId?.name}</span>
                <span className="text-fg-muted"> · {chat.lastMessage?.content}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-warning-fg">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatRelative(chat.lastMessage?.timestamp)}
              </span>
            </Link>
          </li>
        ))}
      </AttentionGroup>
      <AttentionGroup icon={ShoppingCart} title="Pending orders" count={pendingCount} to="/dashboard/orders?status=pending" empty="No orders waiting.">
        {pendingOrders.map((order) => (
          <li key={order._id}>
            <Link
              to={`/dashboard/orders?id=${order._id}`}
              className="-mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-caption hover:bg-surface-2 transition-colors"
            >
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs text-fg">{order.orderNumber}</span>
                <span className="text-fg-muted"> · {order.customerId?.name}</span>
              </span>
              <span className="shrink-0 text-xs text-fg-muted">{formatRelative(order.createdAt)}</span>
            </Link>
          </li>
        ))}
      </AttentionGroup>
      <AttentionGroup
        icon={PackageX}
        title={`Low stock (≤ ${lowStockThreshold})`}
        count={lowStockCount}
        to="/dashboard/products?stock=low"
        empty="Everything is well stocked."
      >
        {lowStock.map((product) => (
          <li key={product._id} className="flex items-center justify-between gap-2 py-1 text-caption">
            <span className="truncate text-fg">{product.name}</span>
            <span className={cn("shrink-0 text-xs font-medium tabular-nums", product.stock === 0 ? "text-danger-fg" : "text-warning-fg")}>
              {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
            </span>
          </li>
        ))}
      </AttentionGroup>
    </Card>
  );
}

// Connected / not connected for each messaging channel
export function ChannelStatus({ channels }) {
  return (
    <Card>
      <CardHeader
        title="Channels"
        action={
          <Link to="/dashboard/settings?tab=channels" className="text-xs font-medium text-accent hover:underline">
            Manage
          </Link>
        }
      />
      <ul className="px-5 pb-4">
        {["whatsapp", "instagram", "facebook"].map((platform) => {
          const channel = channels[platform];
          return (
            <li key={platform} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <ChannelBadge platform={platform} />
                {channel.connected && channel.label && <span className="truncate text-caption text-fg-muted">{channel.label}</span>}
              </span>
              <span className={cn("flex shrink-0 items-center gap-1.5 text-xs font-medium", channel.connected ? "text-success-fg" : "text-fg-muted")}>
                <span className={cn("h-1.5 w-1.5 rounded-full", channel.connected ? "bg-success" : "bg-fg-subtle")} aria-hidden="true" />
                {channel.connected ? "Connected" : "Not connected"}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const STEPS = [
  { key: "businessProfile", title: "Add your business name", to: "/dashboard/settings?tab=profile" },
  { key: "whatsappConnected", title: "Connect WhatsApp", to: "/dashboard/settings?tab=channels", primary: true },
  { key: "firstProduct", title: "Add your first product", to: "/dashboard/products?new=1" },
  { key: "firstCustomer", title: "Add a customer", to: "/dashboard/customers?new=1" },
  { key: "firstOrder", title: "Create an order", to: "/dashboard/orders?new=1" },
];

// Shown until WhatsApp is connected
export function OnboardingChecklist({ onboarding }) {
  const done = STEPS.filter((step) => onboarding[step.key]).length;
  const next = STEPS.find((step) => !onboarding[step.key]);

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-fg">Set up your shop</h2>
          <p className="mt-0.5 text-caption text-fg-muted">
            {done} of {STEPS.length} done. Connect WhatsApp to start receiving customer messages here.
          </p>
          <div className="mt-3 h-1 w-56 max-w-full rounded-full bg-surface-3" aria-hidden="true">
            <div className="h-1 rounded-full bg-accent transition-[width]" style={{ width: `${(done / STEPS.length) * 100}%` }} />
          </div>
        </div>
        {next && (
          <Button as={Link} to={next.to} iconRight={ArrowRight}>
            {next.title}
          </Button>
        )}
      </div>
      <ol className="grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step) => {
          const complete = onboarding[step.key];
          return (
            <li key={step.key} className="border-b border-line last:border-b-0 sm:border-r lg:border-b-0">
              <Link to={step.to} className="flex items-center gap-2 px-5 py-3 text-caption hover:bg-surface-2 transition-colors">
                {complete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Done" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-fg-subtle" aria-label="Not done" />
                )}
                <span className={complete ? "text-fg-muted line-through" : "text-fg"}>{step.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
