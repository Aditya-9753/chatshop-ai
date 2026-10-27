import React, { useState } from "react";
import { Card, CardBody, CardHeader, ChannelBadge, ErrorState, PageHeader, Skeleton, Tabs } from "../../components/ui";
import { ChartCard, seriesStats } from "../../components/charts/Charts";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../../utils/format";
import { Bars, fetchActivity, fetchSystem, TopShops, useLoad } from "./AdminOverview";

// Monthly series from the API come newest-first as { _id: "YYYY-MM" }
const monthly = (rows = [], key) =>
  [...rows].reverse().map((row) => ({ date: `${row._id}-01`, [key]: row[key] ?? row.count ?? 0 }));

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export default function AdminAnalytics() {
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

          {system.data && (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ChartCard
                  title="Shop growth by month"
                  description="New sign-ups per month, last 12 months"
                  data={monthly(system.data.userGrowth, "count")}
                  series={[{ key: "count", label: "Sign-ups", color: "var(--chart-2)" }]}
                  format={formatNumber}
                  granularity="month"
                />
              </div>
              <Card>
                <CardHeader title="Subscription distribution" description="Every account, by plan" />
                <CardBody>
                  <Bars
                    rows={(system.data.subscriptionDistribution || [])
                      .map((row) => ({ label: row._id ? row._id[0].toUpperCase() + row._id.slice(1) : "No plan", value: row.count }))
                      .sort((a, b) => b.value - a.value)}
                    total={(system.data.subscriptionDistribution || []).reduce((sum, row) => sum + row.count, 0)}
                  />
                </CardBody>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader title="Platform usage" description="Messages, customers and connected shops per channel, all time" />
                <div className="overflow-x-auto px-5 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-fg-muted">
                        <th scope="col" className="py-2 font-medium">Channel</th>
                        <th scope="col" className="py-2 text-right font-medium">Messages</th>
                        <th scope="col" className="py-2 text-right font-medium">Customers</th>
                        <th scope="col" className="py-2 text-right font-medium">Shops connected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(system.data.platformUsage || []).map((row) => (
                        <tr key={row.platform} className="border-b border-line last:border-0">
                          <td className="py-2.5"><ChannelBadge platform={row.platform} /></td>
                          <td className="py-2.5 text-right tabular-nums">{formatNumber(row.messages)}</td>
                          <td className="py-2.5 text-right tabular-nums">{formatNumber(row.customers)}</td>
                          <td className="py-2.5 text-right tabular-nums">{formatNumber(row.connectedShops)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
