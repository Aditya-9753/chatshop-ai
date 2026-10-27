import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { IndianRupee, MessageSquare, ShoppingCart, Store, UserPlus, Users } from "lucide-react";
import adminService from "../../services/admin.service";
import { Avatar, Card, CardBody, CardHeader, ChannelBadge, ErrorState, PageHeader, Skeleton, StatCard, StatusPill } from "../../components/ui";
import { ChartCard, seriesStats } from "../../components/charts/Charts";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber, formatRelative, percentChange } from "../../utils/format";
import { shopName } from "./AdminRecords";
import { QuickActions, SystemStatusCard } from "./AdminTools";

const PLANS = [
  { key: "starter", label: "Starter" },
  { key: "business", label: "Business" },
  { key: "premium", label: "Premium" },
];

// Defined once so the load callbacks below stay stable between renders
const fetchDashboard = () => adminService.getDashboardStats();
export const fetchSystem = () => adminService.getSystemStats();
export const fetchActivity = (days) => adminService.getDailyActivity(days);
const fetchRecentOrders = () => adminService.listAll("orders", { limit: 6 });
const fetchRecentChats = () => adminService.listAll("conversations", { limit: 6 });
const fetchNewShops = () => adminService.getAllUsers({ limit: 6 });
const fetchTrends = () => adminService.getTrends();

// A short "latest" list with a link to the full section
function RecentCard({ title, description, section, rows, empty, render }) {
  const [, setParams] = useSearchParams();
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={
          <button onClick={() => setParams({ section })} className="text-xs font-medium text-accent hover:underline">
            View all
          </button>
        }
      />
      <div className="px-5 pb-4">
        {!rows ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-caption text-fg-muted">{empty}</p>
        ) : (
          <ul className="divide-y divide-line/60">{rows.map(render)}</ul>
        )}
      </div>
    </Card>
  );
}

export function useLoad(fetcher, arg) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetcher(arg);
      setData(response.data);
    } catch (err) {
      setError(err.message || "Please try again.");
    }
  }, [fetcher, arg]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, load };
}

export function Bars({ rows, total }) {
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const share = total ? (row.value / total) * 100 : 0;
        return (
          <li key={row.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-fg">{row.label}</span>
              <span className="tabular-nums text-fg">
                {formatNumber(row.value)} <span className="text-fg-muted">· {share.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className="h-2 rounded-full bg-chart-1" style={{ width: `${share}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// The shops that sold the most in the selected window
export function TopShops({ shops, days }) {
  const max = Math.max(1, ...shops.map((s) => s.revenue));
  return (
    <Card>
      <CardHeader title="Top shops" description={`By paid revenue, last ${days} days`} />
      <CardBody>
        {shops.length === 0 ? (
          <p className="py-6 text-center text-caption text-fg-muted">No paid orders in this period yet.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {shops.map((shop, i) => (
              <li key={shop._id}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="w-4 text-xs tabular-nums text-fg-muted">{i + 1}</span>
                    <Avatar name={shop.name} size="xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-fg">{shop.business || shop.name}</span>
                      <span className="block truncate text-xs text-fg-muted">
                        {shop.email} · {formatNumber(shop.orders)} orders
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-fg">{formatCurrency(shop.revenue)}</span>
                </div>
                <div className="ml-6 h-1.5 rounded-full bg-surface-2">
                  <div className="h-1.5 rounded-full bg-chart-1" style={{ width: `${(shop.revenue / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

export function AdminOverview() {
  const { data, error, load } = useLoad(fetchDashboard);
  const activity = useLoad(fetchActivity, 30);
  const recentOrders = useLoad(fetchRecentOrders);
  const recentChats = useLoad(fetchRecentChats);
  const newShops = useLoad(fetchNewShops);
  const trends = useLoad(fetchTrends);
  const trend = (key) => trends.data && percentChange(trends.data[key].current, trends.data[key].previous);
  const VS = "vs previous 30 days";
  // When the previous 30 days had nothing, say so instead of a blank
  const note = (key) => trends.data && !trends.data[key].previous && "No data from the 30 days before to compare";
  const totals = activity.data && {
    revenue: seriesStats(activity.data.series, "revenue").total,
    orders: seriesStats(activity.data.series, "orders").total,
    messages: seriesStats(activity.data.series, "messages").total,
  };

  return (
    <div>
      <PageHeader title="Overview" description="Health of the platform at a glance." />
      {error ? (
        <Card>
          <ErrorState description={error} onRetry={load} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Total shops" icon={Store} loading={!data} value={formatNumber(data?.users.total)} delta={trend("users")} deltaLabel={VS} deltaNote={note("users")} />
            <StatCard label="Active subscriptions" icon={Users} loading={!data} value={formatNumber(data?.users.premium)} delta={trend("activeSubscriptions")} deltaLabel={VS} deltaNote={note("activeSubscriptions")} />
            <StatCard label="Active shops, 30 days" icon={UserPlus} loading={!data} value={formatNumber(data?.users.active)} delta={trend("activeUsers")} deltaLabel={VS} deltaNote={note("activeUsers")} />
            <StatCard label="MRR (estimated)" icon={IndianRupee} loading={!data} value={formatCurrency(data?.revenue.total)} />
            <StatCard label="Order revenue, 30 days" icon={IndianRupee} loading={!trends.data} value={formatCurrency(trends.data?.orderRevenue.current)} delta={trend("orderRevenue")} deltaLabel={VS} deltaNote={note("orderRevenue")} />
            <StatCard label="New shops, 7 days" icon={UserPlus} loading={!data} value={formatNumber(data?.users.recentSignups)} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <QuickActions
              onChanged={() => {
                load();
                newShops.load();
                trends.load();
              }}
            />
            <div className="lg:col-span-2">
              <SystemStatusCard />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {activity.error ? (
                <Card>
                  <ErrorState title="Couldn't load the revenue chart" description={activity.error} onRetry={activity.load} />
                </Card>
              ) : activity.data ? (
                <ChartCard
                  title="Order revenue across all shops"
                  description="Paid orders per day, last 30 days"
                  data={activity.data.series}
                  series={[{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }]}
                  format={(v) => formatCurrency(v)}
                  yFormat={formatCurrencyCompact}
                  average
                  summary={[
                    { label: "Revenue", value: formatCurrency(totals.revenue) },
                    { label: "Orders", value: formatNumber(totals.orders) },
                    { label: "Messages", value: formatNumber(totals.messages) },
                  ]}
                />
              ) : (
                <Skeleton className="h-[380px] rounded-xl" />
              )}
            </div>
            {activity.data ? <TopShops shops={activity.data.topShops} days={30} /> : !activity.error && <Skeleton className="h-[380px] rounded-xl" />}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RecentCard
              title="Recent orders"
              description="Newest first, every shop"
              section="orders"
              rows={recentOrders.data}
              empty="No orders yet."
              render={(o) => (
                <li key={o._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-fg">
                      <span className="font-mono text-caption">{o.orderNumber}</span> · {o.customerId?.name || "Customer"}
                    </span>
                    <span className="block truncate text-xs text-fg-muted">
                      {shopName(o.userId)} · {formatRelative(o.createdAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="tabular-nums text-fg">{formatCurrency(o.total)}</span>
                    <StatusPill status={o.status} />
                  </span>
                </li>
              )}
            />
            <RecentCard
              title="Latest chats"
              description="Most recent conversations, every shop"
              section="messages"
              rows={recentChats.data}
              empty="No conversations yet."
              render={(c) => (
                <li key={c._id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Avatar name={c.customerId?.name} size="sm" platform={c.platform} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-fg">{c.customerId?.name || "Customer"}</span>
                      <span className="shrink-0 text-xs text-fg-muted">{formatRelative(c.lastMessage?.timestamp)}</span>
                    </span>
                    <span className="block truncate text-caption text-fg-muted">
                      {shopName(c.userId)} · {c.lastMessage?.content || "No messages"}
                    </span>
                  </span>
                </li>
              )}
            />
            <RecentCard
              title="Newest shops"
              description="Latest sign-ups"
              section="users"
              rows={newShops.data}
              empty="No shops yet."
              render={(u) => (
                <li key={u._id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Avatar name={u.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fg">{shopName(u)}</span>
                    <span className="block truncate text-caption text-fg-muted">
                      {u.email} · joined {formatDate(u.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-caption capitalize text-fg">{u.subscription?.plan || "No plan"}</span>
                    <span className="block text-xs tabular-nums text-fg-muted">{formatCurrency(u.activity?.revenue || 0)}</span>
                  </span>
                </li>
              )}
            />
          </div>

          {!data ? (
            <Skeleton className="mt-6 h-48 rounded-xl" />
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader title="Plan breakdown" description="Active subscriptions by plan" />
                <CardBody>
                  <Bars
                    rows={PLANS.map((p) => ({ label: p.label, value: data.subscriptions[p.key] || 0 }))}
                    total={PLANS.reduce((sum, p) => sum + (data.subscriptions[p.key] || 0), 0)}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Connected channels" description="Shops with each channel live" />
                <CardBody className="flex flex-col gap-3">
                  {["whatsapp", "instagram", "facebook"].map((p) => (
                    <div key={p} className="flex items-center justify-between">
                      <ChannelBadge platform={p} />
                      <span className="text-sm tabular-nums text-fg">
                        {formatNumber(data.platforms[p])} <span className="text-fg-muted">of {formatNumber(data.users.total)}</span>
                      </span>
                    </div>
                  ))}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Activity" description="All time, across all shops" />
                <CardBody className="grid grid-cols-2 gap-3">
                  {[
                    ["Customers", data.entities.customers],
                    ["Orders", data.entities.orders],
                    ["Messages", data.entities.messages],
                    ["Products", data.entities.products],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-line p-2.5">
                      <p className="text-xs text-fg-muted">{label}</p>
                      <p className="text-sm font-semibold tabular-nums text-fg">{formatNumber(value)}</p>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
