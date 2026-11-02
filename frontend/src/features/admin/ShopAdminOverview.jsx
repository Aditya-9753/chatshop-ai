import React from "react";
import { useSearchParams } from "react-router-dom";
import { IndianRupee, MessageSquare, Package, ShoppingCart, Store, Users } from "lucide-react";
import adminService from "../../services/admin.service";
import { Card, CardBody, CardHeader, ChannelBadge, DetailRow, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, StatusPill } from "../../components/ui";
import { ChartCard, seriesStats } from "../../components/charts/Charts";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber, formatRelative } from "../../utils/format";
import { useData } from "./billing/shared";

// The shop this Admin looks after (the server returns only that one), with its numbers
const loadShop = async () => {
  const list = await adminService.getAllUsers({ limit: 1 });
  const shop = list.data?.[0];
  if (!shop) return { data: null };
  const detail = await adminService.getUser(shop._id);
  return { data: { shop, stats: detail.data.stats } };
};

function LatestList({ title, section, rows, empty, render }) {
  const [, setParams] = useSearchParams();
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <button onClick={() => setParams({ section })} className="text-xs font-medium text-accent hover:underline">
            View all
          </button>
        }
      />
      <div className="px-5 pb-4">
        {!rows ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-caption text-fg-muted">{empty}</p>
        ) : (
          <ul className="divide-y divide-line/60">{rows.map(render)}</ul>
        )}
      </div>
    </Card>
  );
}

// Overview for an Admin who looks after one shop: that shop only
export default function ShopAdminOverview() {
  const shop = useData(loadShop, []);
  const activity = useData(() => adminService.getDailyActivity(30), []);
  const orders = useData(() => adminService.listAll("orders", { limit: 6 }), []);
  const chats = useData(() => adminService.listAll("conversations", { limit: 6 }), []);

  if (shop.error) return <ErrorState title="Couldn't load your shop" description={shop.error} onRetry={shop.reload} />;
  if (!shop.loading && !shop.data) {
    return (
      <Card>
        <EmptyState icon={Store} title="No shop assigned yet" description="The Super Admin chooses which shop you look after. Once they do, sign in again to see its orders, customers and chats." />
      </Card>
    );
  }

  const s = shop.data?.shop;
  const stats = shop.data?.stats;
  const sub = s?.subscription || {};
  return (
    <div>
      <PageHeader title={s ? s.businessInfo?.businessName || s.name : "Your shop"} description="Your shop at a glance. As its admin you see only this shop's data." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Customers" icon={Users} loading={!stats} value={formatNumber(stats?.customers)} />
        <StatCard label="Orders" icon={ShoppingCart} loading={!stats} value={formatNumber(stats?.orders)} />
        <StatCard label="Revenue (paid orders)" icon={IndianRupee} loading={!stats} value={formatCurrency(stats?.revenue)} />
        <StatCard label="Messages" icon={MessageSquare} loading={!stats} value={formatNumber(stats?.messages)} />
        <StatCard label="Products" icon={Package} loading={!stats} value={formatNumber(stats?.products)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {activity.data ? (
            <ChartCard
              title="Order revenue per day"
              description="Paid orders, last 30 days"
              data={activity.data.series}
              series={[{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }]}
              format={(v) => formatCurrency(v)}
              yFormat={formatCurrencyCompact}
              average
              summary={[
                { label: "Total", value: formatCurrency(seriesStats(activity.data.series, "revenue").total) },
                { label: "Orders", value: formatNumber(seriesStats(activity.data.series, "orders").total) },
                { label: "Messages", value: formatNumber(seriesStats(activity.data.series, "messages").total) },
              ]}
            />
          ) : activity.error ? (
            <Card>
              <ErrorState title="Couldn't load the chart" description={activity.error} onRetry={activity.reload} />
            </Card>
          ) : (
            <Skeleton className="h-[380px] rounded-xl" />
          )}
        </div>
        <Card>
          <CardHeader title="Shop details" />
          <CardBody>
            {!s ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <dl className="divide-y divide-line">
                <DetailRow label="Owner">{s.name}</DetailRow>
                <DetailRow label="Email">{s.email}</DetailRow>
                <DetailRow label="Phone">{s.phone && s.phone !== "-" ? s.phone : "—"}</DetailRow>
                <DetailRow label="GSTIN">{s.businessInfo?.gstNumber || "—"}</DetailRow>
                <DetailRow label="Plan">
                  <span className="capitalize">{sub.plan || "None"}</span> {sub.trial && "(trial)"} <StatusPill status={sub.status || "inactive"} />
                </DetailRow>
                <DetailRow label="Plan ends">{sub.endDate ? formatDate(sub.endDate) : "—"}</DetailRow>
                <DetailRow label="Channels">
                  <span className="flex flex-wrap justify-end gap-1">
                    {["whatsapp", "instagram", "facebook"].filter((p) => s[`${p}Config`]?.isConnected).map((p) => <ChannelBadge key={p} platform={p} />)}
                    {!["whatsapp", "instagram", "facebook"].some((p) => s[`${p}Config`]?.isConnected) && "None connected"}
                  </span>
                </DetailRow>
                <DetailRow label="Joined">{formatDate(s.createdAt)}</DetailRow>
              </dl>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LatestList
          title="Recent orders"
          section="orders"
          rows={orders.data}
          empty="No orders yet"
          render={(o) => (
            <li key={o._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-fg">{o.orderNumber}</span>
                <span className="block truncate text-caption text-fg-muted">
                  {o.customerId?.name || "Customer"} · {formatRelative(o.createdAt)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <StatusPill status={o.status} />
                <span className="tabular-nums">{formatCurrency(o.total)}</span>
              </span>
            </li>
          )}
        />
        <LatestList
          title="Latest chats"
          section="messages"
          rows={chats.data}
          empty="No chats yet"
          render={(c) => (
            <li key={c._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-fg">{c.customerId?.name || "Customer"}</span>
                <span className="block truncate text-caption text-fg-muted">{c.lastMessage?.content || "—"}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <ChannelBadge platform={c.platform} compact />
                <span className="text-caption text-fg-muted">{formatRelative(c.lastMessage?.timestamp || c.updatedAt)}</span>
              </span>
            </li>
          )}
        />
      </div>
    </div>
  );
}
