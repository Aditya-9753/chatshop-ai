import React, { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, BarChart3, Table2 } from "lucide-react";
import { Card, CardBody, CardHeader, ChannelIcon, CHANNELS, cn } from "../ui";
import { formatCompact } from "../../utils/format";

const shortDate = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const longDate = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const shortMonth = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const tickLabel = (granularity) => (granularity === "month" ? shortMonth : shortDate);
const tooltipLabel = (granularity) => (granularity === "month" ? shortMonth : longDate);

const AXIS_TICK = { fill: "var(--fg-muted)", fontSize: 12 };

// One readout for every series at the hovered date; values lead, labels follow
function SeriesTooltip({ active, payload, label, series, format, granularity, stacked }) {
  if (!active || !payload?.length) return null;
  const total = series.reduce((sum, s) => sum + (payload.find((p) => p.dataKey === s.key)?.value || 0), 0);
  return (
    <div className="min-w-[150px] rounded-lg border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="mb-1.5 text-xs text-fg-muted">{tooltipLabel(granularity)(label)}</p>
      {series.map((s) => {
        const value = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
        return (
          <p key={s.key} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            <span className="font-semibold tabular-nums text-fg">{format(value)}</span>
            <span className="text-fg-muted">{s.label}</span>
          </p>
        );
      })}
      {stacked && series.length > 1 && (
        <p className="mt-1.5 flex justify-between gap-3 border-t border-line pt-1.5 text-xs">
          <span className="text-fg-muted">Total</span>
          <span className="font-semibold tabular-nums text-fg">{format(total)}</span>
        </p>
      )}
    </div>
  );
}

function Legend({ series, shape = "bar" }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-4" aria-label="Legend">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-2 text-xs text-fg-muted">
          <span
            className={shape === "bar" ? "h-2.5 w-2.5 rounded-sm" : "h-0.5 w-4 rounded-full"}
            style={{ background: s.color }}
            aria-hidden="true"
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

const chartLabel = (series) => `${series.map((s) => s.label).join(" and ")} over time`;

/**
 * Smooth area chart, used for long monthly trends.
 * series: [{ key, label, color }]
 */
export function TimeSeriesChart({ data, series, format = (v) => v, yFormat = formatCompact, height = 260, granularity }) {
  return (
    <div>
      <Legend series={series} shape="line" />
      <div style={{ height }} role="img" aria-label={chartLabel(series)}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="date" tickFormatter={tickLabel(granularity)} tick={AXIS_TICK} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={yFormat} tick={AXIS_TICK} axisLine={false} tickLine={false} width={52} allowDecimals={false} />
            <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={<SeriesTooltip series={series} format={format} granularity={granularity} />} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: s.color }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Column chart: one bar per day, easiest to read for daily amounts.
 * `stacked` piles the series on top of each other (with a 2px gap);
 * `average` draws a labelled line at the daily average of the total.
 */
export function BarSeriesChart({ data, series, format = (v) => v, yFormat = formatCompact, height = 260, stacked, average, granularity }) {
  const totals = data.map((row) => series.reduce((sum, s) => sum + (row[s.key] || 0), 0));
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const showAverage = average && avg > 0;

  // An all-zero chart only draws a meaningless axis; say it plainly instead
  if (!totals.some(Boolean)) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-lg border border-dashed border-line text-caption text-fg-muted">
        Nothing to show for this period yet.
      </div>
    );
  }

  return (
    <div>
      <Legend series={series} />
      {showAverage && (
        <p className="mb-2 flex items-center gap-2 text-xs text-fg-muted">
          <span className="w-4 border-t border-dashed border-fg-muted" aria-hidden="true" />
          Daily average {format(Number(avg.toFixed(avg < 10 ? 1 : 0)))}
        </p>
      )}
      <div style={{ height }} role="img" aria-label={chartLabel(series)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="date" tickFormatter={tickLabel(granularity)} tick={AXIS_TICK} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={16} />
            <YAxis tickFormatter={yFormat} tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={<SeriesTooltip series={series} format={format} granularity={granularity} stacked={stacked} />}
            />
            {showAverage && (
              <ReferenceLine y={avg} stroke="var(--fg-muted)" strokeWidth={1} strokeDasharray="4 4" ifOverflow="extendDomain" />
            )}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                stackId={stacked ? "total" : undefined}
                maxBarSize={24}
                radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0}
                stroke={stacked ? "var(--surface)" : undefined}
                strokeWidth={stacked ? 2 : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Daily values as a table: the accessible alternative to the chart
export function SeriesTable({ data, series, format = (v) => v, granularity }) {
  return (
    <div className="max-h-[280px] overflow-auto scrollbar-thin rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-fg-muted">
              Date
            </th>
            {series.map((s) => (
              <th key={s.key} scope="col" className="px-3 py-2 text-right text-xs font-medium text-fg-muted">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date} className="border-t border-line">
              <td className="px-3 py-1.5 text-fg">{tooltipLabel(granularity)(row.date)}</td>
              {series.map((s) => (
                <td key={s.key} className="px-3 py-1.5 text-right tabular-nums text-fg">
                  {format(row[s.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The headline numbers above a chart, so the reader gets the answer
 * before reading the bars. items: [{ label, value, delta? }]
 */
function ChartSummary({ items }) {
  return (
    <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-fg-muted">{item.label}</dt>
          <dd className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums tracking-tight text-fg">{item.value}</span>
            {typeof item.delta === "number" && Number.isFinite(item.delta) && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                  item.delta >= 0 ? "text-success-fg" : "text-danger-fg"
                )}
              >
                {item.delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(item.delta).toFixed(0)}%
              </span>
            )}
            {/* "vs previous…" only makes sense next to a percentage */}
            {item.note && (item.delta === undefined || Number.isFinite(item.delta)) && (
              <span className="text-xs text-fg-muted">{item.note}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Card with a title, an optional summary row and a chart/table toggle.
 * kind: "bar" (default, per-day amounts) or "area" (long trends).
 */
export function ChartCard({
  title,
  description,
  data,
  series,
  format,
  yFormat,
  height,
  granularity,
  kind = "bar",
  stacked,
  average,
  summary,
  className,
}) {
  const [view, setView] = useState("chart");
  const Chart = kind === "area" ? TimeSeriesChart : BarSeriesChart;

  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        action={
          <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Display as">
            {[
              { value: "chart", icon: BarChart3, label: "Chart" },
              { value: "table", icon: Table2, label: "Table" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setView(option.value)}
                aria-pressed={view === option.value}
                aria-label={`Show as ${option.label.toLowerCase()}`}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  view === option.value ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
                )}
              >
                <option.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        }
      />
      <CardBody>
        {summary && <ChartSummary items={summary} />}
        {view === "chart" ? (
          <Chart
            data={data}
            series={series}
            format={format}
            yFormat={yFormat}
            height={height}
            granularity={granularity}
            stacked={stacked}
            average={average}
          />
        ) : (
          <SeriesTable data={data} series={series} format={format} granularity={granularity} />
        )}
      </CardBody>
    </Card>
  );
}

// Best day, total and daily average of one series, for a chart summary
export function seriesStats(data, key) {
  const total = data.reduce((sum, row) => sum + (row[key] || 0), 0);
  const best = data.reduce((top, row) => ((row[key] || 0) > (top?.[key] || 0) ? row : top), null);
  return {
    total,
    average: data.length ? total / data.length : 0,
    bestDay: best && best[key] > 0 ? { date: shortDate(best.date), value: best[key] } : null,
    activeDays: data.filter((row) => (row[key] || 0) > 0).length,
  };
}

/**
 * Share per channel as labelled horizontal bars. Labels and values are
 * always visible (the WhatsApp green is too light to carry meaning alone).
 */
export function ChannelSplit({ rows, valueKey, format = (v) => v }) {
  const total = rows.reduce((sum, row) => sum + (row[valueKey] || 0), 0);
  const bg = { whatsapp: "bg-whatsapp", instagram: "bg-instagram", facebook: "bg-facebook" };

  if (!total) return <p className="py-6 text-center text-caption text-fg-muted">Nothing in this period yet.</p>;

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const value = row[valueKey] || 0;
        const share = total ? (value / total) * 100 : 0;
        return (
          <li key={row.platform}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-fg">
                <ChannelIcon platform={row.platform} /> {CHANNELS[row.platform]?.label}
              </span>
              <span className="tabular-nums text-fg">
                {format(value)} <span className="text-fg-muted">· {share.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className={cn("h-2 rounded-full", bg[row.platform])} style={{ width: `${share}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
