import React, { useCallback, useEffect, useState } from "react";
import { IndianRupee, MessageSquare, ShoppingCart, UserPlus, Users } from "lucide-react";
import adminService from "../../services/admin.service";
import { Card, CardBody, CardHeader, ChannelBadge, ErrorState, PageHeader, Skeleton, StatCard } from "../../components/ui";
import { ChartCard } from "../../components/charts/Charts";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../../utils/format";

const PLANS = [
  { key: "starter", label: "Starter" },
  { key: "business", label: "Business" },
  { key: "premium", label: "Premium" },
];

// Defined once so the load callback below stays stable between renders
const fetchDashboard = () => adminService.getDashboardStats();
const fetchSystem = () => adminService.getSystemStats();

function useLoad(fetcher) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetcher();
      setData(response.data);
    } catch (err) {
      setError(err.message || "Please try again.");
    }
  }, [fetcher]);
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

export function AdminOverview() {
  const { data, error, load } = useLoad(fetchDashboard);

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
            <StatCard label="Shops" icon={Users} loading={!data} value={formatNumber(data?.users.total)} />
            <StatCard label="Active subscriptions" icon={UserPlus} loading={!data} value={formatNumber(data?.users.premium)} />
            <StatCard label="MRR (estimated)" icon={IndianRupee} loading={!data} value={formatCurrency(data?.revenue.total)} />
            <StatCard label="New shops, 7 days" icon={UserPlus} loading={!data} value={formatNumber(data?.users.recentSignups)} />
          </div>
          {!data ? (
            <Skeleton className="mt-6 h-64 rounded-xl" />
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
                <CardHeader title="Activity" description="Across all shops" />
                <CardBody className="grid grid-cols-2 gap-3">
                  {[
                    ["Customers", data.entities.customers, Users],
                    ["Orders", data.entities.orders, ShoppingCart],
                    ["Messages", data.entities.messages, MessageSquare],
                    ["Products", data.entities.products, ShoppingCart],
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
  [...rows]
    .reverse()
    .map((row) => ({ date: `${row._id}-01`, [key]: row[key] ?? row.count ?? 0 }));

export function AdminAnalytics() {
  const { data, error, load } = useLoad(fetchSystem);

  return (
    <div>
      <PageHeader title="Analytics" description="Growth and order volume across the platform, by month." />
      {error ? (
        <Card>
          <ErrorState description={error} onRetry={load} />
        </Card>
      ) : !data ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard
            title="New shops"
            description="Sign-ups per month"
            data={monthly(data.userGrowth, "count")}
            series={[{ key: "count", label: "Sign-ups", color: "var(--chart-1)" }]}
            format={formatNumber}
            granularity="month"
            kind="area"
          />
          <ChartCard
            title="Order revenue"
            description="Paid orders across all shops, per month"
            data={monthly(data.monthlyRevenue, "revenue")}
            series={[{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }]}
            format={(v) => formatCurrency(v)}
            yFormat={formatCurrencyCompact}
            granularity="month"
            kind="area"
          />
        </div>
      )}
    </div>
  );
}
