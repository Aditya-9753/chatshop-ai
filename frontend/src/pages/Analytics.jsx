import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock, Download, IndianRupee, Megaphone, MessageSquare, Receipt, ShoppingCart, UserPlus, Users } from "lucide-react";
import api from "../services/api.service";
import { API_ENDPOINTS } from "../config/api.config";
import { ChannelStatus } from "../features/dashboard/Attention";
import analyticsService from "../services/analytics.service";
import { Button, Card, CardBody, CardHeader, ChannelBadge, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, Tabs } from "../components/ui";
import { ChannelSplit, ChartCard, seriesStats } from "../components/charts/Charts";
import { formatCurrency, formatCurrencyCompact, formatDuration, formatNumber, percentChange } from "../utils/format";

const DAY_MS = 86400000;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Presets end at the end of today; "custom" uses the two date inputs
const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "month", label: "This month" },
  { value: "365", label: "Last year" },
  { value: "custom", label: "Custom" },
];

const toInput = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function rangeFor(preset, custom) {
  const end = new Date(startOfDay(new Date()).getTime() + DAY_MS);
  if (preset === "today") {
    return { start: startOfDay(new Date()), end };
  }
  if (preset === "month") {
    const start = startOfDay(new Date());
    start.setDate(1);
    return { start, end };
  }
  if (preset === "custom") {
    const start = startOfDay(new Date(`${custom.from}T00:00:00`));
    const customEnd = new Date(startOfDay(new Date(`${custom.to}T00:00:00`)).getTime() + DAY_MS);
    return { start, end: customEnd };
  }
  return { start: new Date(end.getTime() - Number(preset) * DAY_MS), end };
}

// Download the report as CSV: headline numbers, then one row per day
function exportReport(report, range) {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const day = (d) => d.toISOString().slice(0, 10);
  const last = new Date(range.end.getTime() - 1);
  const k = report.kpis;
  const lines = [
    ["ChatShop report", `${day(range.start)} to ${day(last)}`],
    [],
    ["Metric", "This period", "Previous period"],
    ["Revenue", k.revenue.current, k.revenue.previous],
    ["Orders", k.orders.current, k.orders.previous],
    ["Average order", Math.round(k.averageOrderValue.current), Math.round(k.averageOrderValue.previous)],
    ["New customers", k.newCustomers.current, k.newCustomers.previous],
    ["Messages received", k.messagesReceived.current, k.messagesReceived.previous],
    ["Messages sent", k.messagesSent.current, k.messagesSent.previous],
    ["Median response (min)", k.responseTimeMinutes.current ?? "", k.responseTimeMinutes.previous ?? ""],
    [],
    ["Date", "Revenue", "Orders", "Messages received", "Messages sent", "New customers"],
    ...report.series.map((d) => [d.date, d.revenue, d.orders, d.messagesIn, d.messagesOut, d.newCustomers]),
  ];
  const blob = new Blob([lines.map((row) => row.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `analytics-${day(range.start)}-to-${day(last)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function RankedList({ rows, empty, render }) {
  if (!rows.length) return <p className="py-6 text-center text-caption text-fg-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.revenue)) || 1;
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <li key={row._id || row.productId || row.name || i}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-xs tabular-nums text-fg-muted">{i + 1}</span>
              {render(row)}
            </span>
            <span className="shrink-0 tabular-nums text-fg">{formatCurrency(row.revenue)}</span>
          </div>
          <div className="ml-6 h-1.5 rounded-full bg-surface-2">
            <div className="h-1.5 rounded-full bg-chart-1" style={{ width: `${(row.revenue / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

const Analytics = () => {
  const [preset, setPreset] = useState("30");
  const [custom, setCustom] = useState({ from: toInput(Date.now() - 30 * DAY_MS), to: toInput(Date.now()) });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [channels, setChannels] = useState(null);

  // Connection status per channel, for the Platform status card
  useEffect(() => {
    api
      .get(API_ENDPOINTS.USER.PROFILE)
      .then((res) => {
        const u = res.data;
        setChannels({
          whatsapp: { connected: !!u.whatsappConfig?.isConnected, label: u.whatsappConfig?.phoneNumber },
          instagram: { connected: !!u.instagramConfig?.isConnected, label: u.instagramConfig?.username },
          facebook: { connected: !!u.facebookConfig?.isConnected, label: u.facebookConfig?.pageName },
        });
      })
      .catch(() => setChannels(null));
  }, []);

  const customValid = preset !== "custom" || (custom.from && custom.to && custom.from <= custom.to);
  const range = useMemo(() => (customValid ? rangeFor(preset, custom) : null), [preset, custom, customValid]);

  const load = useCallback(async () => {
    if (!range) return;
    setLoading(true);
    setError(null);
    try {
      const response = await analyticsService.getReport(range);
      setReport(response.data);
    } catch (err) {
      setError(err.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const kpi = (key) => report?.kpis[key] || { current: 0, previous: 0 };
  const delta = (key) => percentChange(kpi(key).current, kpi(key).previous);
  const days = range ? Math.round((range.end - range.start) / DAY_MS) : 0;
  const deltaLabel = `vs previous ${days} days`;
  const initial = loading && !report;
  const stats = useMemo(
    () =>
      report && {
        revenue: seriesStats(report.series, "revenue"),
        orders: seriesStats(report.series, "orders"),
        newCustomers: seriesStats(report.series, "newCustomers"),
      },
    [report]
  );

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Sales and conversations for any period, compared with the period before."
        actions={
          <Button variant="secondary" icon={Download} disabled={!report || !range} onClick={() => exportReport(report, range)}>
            Export
          </Button>
        }
      />

      {/* One filter row scopes every number and chart below */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs variant="pill" tabs={PRESETS} value={preset} onChange={setPreset} label="Date range" />
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-fg-muted" aria-hidden="true" />
            <input
              type="date"
              aria-label="From"
              value={custom.from}
              max={custom.to}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent"
            />
            <span className="text-fg-muted">–</span>
            <input
              type="date"
              aria-label="To"
              value={custom.to}
              min={custom.from}
              max={toInput(Date.now())}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
        )}
      </div>

      {error && !report ? (
        <Card>
          <ErrorState title="Couldn't load analytics" description={error} onRetry={load} />
        </Card>
      ) : (
        <div className={loading && report ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Revenue" icon={IndianRupee} loading={initial} value={formatCurrency(kpi("revenue").current)} delta={delta("revenue")} deltaLabel={deltaLabel} />
            <StatCard label="Orders" icon={ShoppingCart} loading={initial} value={formatNumber(kpi("orders").current)} delta={delta("orders")} deltaLabel={deltaLabel} />
            <StatCard label="Average order" icon={Receipt} loading={initial} value={formatCurrency(kpi("averageOrderValue").current)} delta={delta("averageOrderValue")} deltaLabel={deltaLabel} />
            <StatCard label="New customers" icon={UserPlus} loading={initial} value={formatNumber(kpi("newCustomers").current)} delta={delta("newCustomers")} deltaLabel={deltaLabel} />
            <StatCard label="Messages received" icon={MessageSquare} loading={initial} value={formatNumber(kpi("messagesReceived").current)} delta={delta("messagesReceived")} deltaLabel={deltaLabel} />
            <StatCard
              label="Median response"
              icon={Clock}
              loading={initial}
              value={formatDuration(kpi("responseTimeMinutes").current)}
              delta={kpi("responseTimeMinutes").current != null && kpi("responseTimeMinutes").previous ? delta("responseTimeMinutes") : undefined}
              deltaLabel={deltaLabel}
              invertDelta
            />
          </div>

          {initial ? (
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Skeleton className="h-[340px] rounded-xl" />
              <Skeleton className="h-[340px] rounded-xl" />
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <ChartCard
                  title="Revenue per day"
                  description="Paid orders, excluding cancelled."
                  data={report.series}
                  series={[{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }]}
                  format={(v) => formatCurrency(v)}
                  yFormat={formatCurrencyCompact}
                  average
                  summary={[
                    { label: "Total revenue", value: formatCurrency(kpi("revenue").current), delta: delta("revenue"), note: deltaLabel },
                    { label: "Per day", value: formatCurrency(stats.revenue.average) },
                    { label: "Best day", value: stats.revenue.bestDay ? formatCurrency(stats.revenue.bestDay.value) : "—", note: stats.revenue.bestDay?.date },
                  ]}
                />
                <ChartCard
                  title="Orders per day"
                  description="Every order except cancelled ones."
                  data={report.series}
                  series={[{ key: "orders", label: "Orders", color: "var(--chart-1)" }]}
                  format={formatNumber}
                  average
                  summary={[
                    { label: "Total orders", value: formatNumber(kpi("orders").current), delta: delta("orders"), note: deltaLabel },
                    { label: "Average order", value: formatCurrency(kpi("averageOrderValue").current) },
                    { label: "Days with orders", value: `${stats.orders.activeDays} of ${report.series.length}` },
                  ]}
                />
                <ChartCard
                  title="Messages per day"
                  description="Received from customers and sent by you, stacked."
                  data={report.series}
                  series={[
                    { key: "messagesIn", label: "Received", color: "var(--chart-1)" },
                    { key: "messagesOut", label: "Sent", color: "var(--chart-2)" },
                  ]}
                  stacked
                  format={formatNumber}
                  summary={[
                    { label: "Received", value: formatNumber(kpi("messagesReceived").current), delta: delta("messagesReceived"), note: deltaLabel },
                    { label: "Sent", value: formatNumber(kpi("messagesSent").current) },
                    { label: "Median reply time", value: formatDuration(kpi("responseTimeMinutes").current) },
                  ]}
                />
                <ChartCard
                  title="New customers per day"
                  description="People who messaged or bought from you for the first time."
                  data={report.series}
                  series={[{ key: "newCustomers", label: "New customers", color: "var(--chart-2)" }]}
                  format={formatNumber}
                  summary={[
                    { label: "New customers", value: formatNumber(kpi("newCustomers").current), delta: delta("newCustomers"), note: deltaLabel },
                    { label: "Best day", value: stats.newCustomers.bestDay ? formatNumber(stats.newCustomers.bestDay.value) : "—", note: stats.newCustomers.bestDay?.date },
                  ]}
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader title="Revenue by channel" description="Where paid orders came from" />
                  <CardBody>
                    <ChannelSplit rows={report.channels} valueKey="revenue" format={(v) => formatCurrency(v)} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Top products" description="By revenue in this period" />
                  <CardBody>
                    <RankedList
                      rows={report.topProducts}
                      empty="No paid orders in this period."
                      render={(p) => (
                        <span className="min-w-0 truncate text-fg">
                          {p.name} <span className="text-caption text-fg-muted">· {formatNumber(p.quantity)} sold</span>
                        </span>
                      )}
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Top customers" description="By revenue in this period" />
                  <CardBody>
                    <RankedList
                      rows={report.topCustomers}
                      empty="No paid orders in this period."
                      render={(c) => (
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-fg">{c.name}</span>
                          <ChannelBadge platform={c.platform} compact />
                        </span>
                      )}
                    />
                  </CardBody>
                </Card>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card>
                  <CardHeader title="Customers by channel" description={`All customers · ${formatNumber(report.channels.reduce((sum, c) => sum + c.customers, 0))} in total`} />
                  <CardBody>
                    <ChannelSplit rows={report.channels} valueKey="customers" format={formatNumber} />
                  </CardBody>
                </Card>
                {channels ? <ChannelStatus channels={channels} /> : <Skeleton className="h-48 rounded-xl" />}
                <Card>
                  <CardHeader title="Quick actions" />
                  <CardBody className="grid grid-cols-1 gap-2">
                    <Button as={Link} to="/dashboard/customers" variant="secondary" icon={Users} className="justify-start">
                      Manage customers
                    </Button>
                    <Button as={Link} to="/dashboard/messages?broadcast=1" variant="secondary" icon={Megaphone} className="justify-start">
                      Send broadcast
                    </Button>
                    <Button as={Link} to="/dashboard/orders" variant="secondary" icon={ShoppingCart} className="justify-start">
                      View all orders
                    </Button>
                  </CardBody>
                </Card>
              </div>

              {report.series.every((d) => !d.revenue && !d.messagesIn && !d.messagesOut) && (
                <Card className="mt-6">
                  <EmptyState
                    icon={CalendarDays}
                    title="Nothing happened in this period"
                    description="Pick a longer range, or connect a channel to start receiving messages."
                  />
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Analytics;
