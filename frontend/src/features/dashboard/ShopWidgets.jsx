import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, MessageSquare, Package, ShoppingCart, UserCog, UserPlus } from "lucide-react";
import { Avatar, Button, Card, CardBody, CardHeader, cn, StatusPill } from "../../components/ui";
import { PRICING } from "../marketing/content";
import { formatCurrency, formatRelative } from "../../utils/format";

// The old dashboard's quick actions, each opening the real form
export function QuickActionsCard() {
  const actions = [
    { to: "/dashboard/customers?new=1", icon: UserPlus, label: "Add customer" },
    { to: "/dashboard/products?new=1", icon: Package, label: "Add product" },
    { to: "/dashboard/orders?new=1", icon: ShoppingCart, label: "Create order" },
    { to: "/dashboard/settings?tab=profile", icon: UserCog, label: "Edit profile" },
  ];
  return (
    <Card>
      <CardHeader title="Quick actions" />
      <CardBody className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Button key={a.label} as={Link} to={a.to} variant="secondary" icon={a.icon} className="justify-start">
            {a.label}
          </Button>
        ))}
      </CardBody>
    </Card>
  );
}

const describe = (item) => {
  if (item.kind === "message") return { title: `${item.name || "A customer"} sent a message`, detail: item.text };
  if (item.kind === "order") return { title: `New order ${item.text}`, detail: `${item.name || "Customer"} · ${formatCurrency(item.total)}` };
  return { title: `${item.name} became a customer`, detail: null };
};

const linkFor = (item) =>
  item.kind === "message"
    ? `/dashboard/messages?customer=${item.customerId}`
    : item.kind === "order"
      ? `/dashboard/orders?id=${item.orderId}`
      : `/dashboard/customers?id=${item.customerId}`;

// What happened lately: messages in, orders, new customers (was placeholder text)
export function RecentActivity({ items }) {
  return (
    <Card>
      <CardHeader title="Recent activity" description="Messages, orders and new customers, newest first" />
      <div className="px-5 pb-4">
        {items.length === 0 ? (
          <p className="py-6 text-center text-caption text-fg-muted">Nothing has happened yet. Activity appears here as customers message you.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {items.map((item, i) => {
              const { title, detail } = describe(item);
              return (
                <li key={`${item.kind}-${i}`}>
                  <Link to={linkFor(item)} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2 transition-colors">
                    <span className="relative">
                      <Avatar name={item.name} size="sm" platform={item.platform} />
                      <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-line bg-surface">
                        {item.kind === "message" ? (
                          <MessageSquare className="h-2.5 w-2.5 text-fg-muted" />
                        ) : item.kind === "order" ? (
                          <ShoppingCart className="h-2.5 w-2.5 text-accent" />
                        ) : (
                          <UserPlus className="h-2.5 w-2.5 text-success" />
                        )}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{title}</span>
                      {detail && <span className="block truncate text-caption text-fg-muted">{detail}</span>}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-fg-muted">{formatRelative(item.at)}</span>
                      {item.kind === "order" && <StatusPill status={item.status} />}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

// The old "Upgrade Plan" card: what the next plan adds, from the real price list
export function UpgradeCard({ plan }) {
  const order = PRICING.map((p) => p.key);
  const next = PRICING.find((p, i) => !p.oneTime && i > order.indexOf(plan));
  if (!next) return null;
  return (
    <Card className="border-accent/30 bg-accent-soft/30">
      <CardHeader title={`Upgrade to ${next.name}`} description={`${formatCurrency(next.price)} a month · ${next.blurb}`} />
      <CardBody>
        <ul className="mb-4 flex flex-col gap-1.5">
          {next.features.map((f) => (
            <li key={f} className={cn("flex items-start gap-2 text-caption text-fg")}>
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
        <Button as={Link} to="/dashboard/settings?tab=billing" size="sm" iconRight={ArrowRight}>
          See plans
        </Button>
      </CardBody>
    </Card>
  );
}
