import React, { useCallback, useEffect, useState } from "react";
import { IndianRupee, MessageSquare, ShoppingCart, Store, UserPlus, Users } from "lucide-react";
import adminService from "../../services/admin.service";
import { Avatar, Card, CardBody, CardHeader, ChannelBadge, ErrorState, PageHeader, Skeleton, StatCard, Tabs } from "../../components/ui";
import { ChartCard, seriesStats } from "../../components/charts/Charts";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../../utils/format";

const PLANS = [
  { key: "starter", label: "Starter" },
  { key: "business", label: "Business" },
  { key: "premium", label: "Premium" },
];

// Defined once so the load callbacks below stay stable between renders
const fetchDashboard = () => adminService.getDashboardStats();
const fetchSystem = () => adminService.getSystemStats();
const fetchActivity = (days) => adminService.getDailyActivity(days);

function useLoad(fetcher, arg) {
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

function Bars({ rows, total }) {
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
function TopShops({ shops, days }) {
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Shops" icon={Store} loading={!data} value={formatNumber(data?.users.total)} />
            <StatCard label="Active subscriptions" icon={Users} loading={!data} value={formatNumber(data?.users.premium)} />
            <StatCard label="MRR (estimated)" icon={IndianRupee} loading={!data} value={formatCurrency(data?.revenue.total)} />
            <StatCard label="New shops, 7 days" icon={UserPlus} loading={!data} value={formatNumber(data?.users.recentSignups)} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {activity.data ? (
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
            {activity.data ? <TopShops shops={activity.data.topShops} days={30} /> : <Skeleton className="h-[380px] rounded-xl" />}
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
                  {["whatsapp", "instagram"].map((p) => (
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

// Monthly series from the API come newest-first as { _id: "YYYY-MM" }
const monthly = (rows = [], key) =>
  [...rows].reverse().map((row) => ({ date: `${row._id}-01`, [key]: row[key] ?? row.count ?? 0 }));

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const activity = useLoad(fetchActivity, days);
  const system = useLoad(fetchSystem);
  const series = activity.data?.series || [];
  const stat = (key) => seriesStats(series, key);
  const best = (key, format) => (stat(key).bestDay ? format(stat(key).bestDay.value) : "—");

  return (
    <div>
      <PageHeader title="Analytics" description="Sign-ups, orders and conversations across every shop." />
      <Tabs variant="pill" tabs={RANGES} value={days} onChange={setDays} label="Date range" className="mb-6" />

      {activity.error ? (
        <Card>
          <ErrorState description={activity.error} onRetry={activity.load} />
        </Card>
      ) : !activity.data ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[380px] rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard
              title="Revenue per day"
              description="Paid orders across all shops, excluding cancelled."
              data={series}
              series={[{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }]}
              format={(v) => formatCurrency(v)}
              yFormat={formatCurrencyCompact}
              average
              summary={[
                { label: "Total", value: formatCurrency(stat("revenue").total) },
                { label: "Per day", value: formatCurrency(stat("revenue").average) },
                { label: "Best day", value: best("revenue", formatCurrency), note: stat("revenue").bestDay?.date },
              ]}
            />
            <ChartCard
              title="Orders per day"
              description="Every order except cancelled ones."
              data={series}
              series={[{ key: "orders", label: "Orders", color: "var(--chart-1)" }]}
              format={formatNumber}
              average
              summary={[
                { label: "Total orders", value: formatNumber(stat("orders").total) },
                { label: "Days with orders", value: `${stat("orders").activeDays} of ${series.length}` },
              ]}
            />
            <ChartCard
              title="New shops per day"
              description="Sign-ups, not counting admins."
              data={series}
              series={[{ key: "signups", label: "Sign-ups", color: "var(--chart-2)" }]}
              format={formatNumber}
              summary={[
                { label: "New shops", value: formatNumber(stat("signups").total) },
                { label: "Best day", value: best("signups", formatNumber), note: stat("signups").bestDay?.date },
              ]}
            />
            <ChartCard
              title="Messages per day"
              description="Sent and received, on every channel."
              data={series}
              series={[{ key: "messages", label: "Messages", color: "var(--chart-2)" }]}
              format={formatNumber}
              average
              summary={[
                { label: "Messages", value: formatNumber(stat("messages").total) },
                { label: "Per day", value: formatNumber(Math.round(stat("messages").average)) },
              ]}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <TopShops shops={activity.data.topShops} days={days} />
            <div className="lg:col-span-2">
              {system.data ? (
                <ChartCard
                  title="Revenue by month"
                  description="Paid orders across all shops, last 12 months"
                  data={monthly(system.data.monthlyRevenue, "revenue")}
                  series={[{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }]}
                  format={(v) => formatCurrency(v)}
                  yFormat={formatCurrencyCompact}
                  granularity="month"
                />
              ) : (
                <Skeleton className="h-[380px] rounded-xl" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
