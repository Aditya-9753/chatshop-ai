import React, { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardBody, CardHeader, ChannelIcon, CHANNELS, cn } from "../ui";
import { formatCompact } from "../../utils/format";

const shortDate = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const shortMonth = (key) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const labelFor = (granularity) => (granularity === "month" ? shortMonth : shortDate);

// One tooltip for every series at the hovered date; values lead, labels follow
function SeriesTooltip({ active, payload, label, series, format, granularity }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-popover">
      <p className="mb-1 text-xs text-fg-muted">{labelFor(granularity)(label)}</p>
      {series.map((s) => {
        const row = payload.find((p) => p.dataKey === s.key);
        return (
          <p key={s.key} className="flex items-center gap-2 text-xs">
            <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            <span className="font-semibold tabular-nums text-fg">{format(row?.value ?? 0)}</span>
            <span className="text-fg-muted">{s.label}</span>
          </p>
        );
      })}
    </div>
  );
}

/**
 * Line/area chart over days. series: [{ key, label, color }] (max 2-3).
 * A legend is shown for 2+ series; a single series is named by the card title.
 */
export function TimeSeriesChart({ data, series, format = (v) => v, height = 260, dimmed, granularity }) {
  return (
    <div className={cn("transition-opacity duration-200", dimmed && "opacity-50")}>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-4" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div style={{ height }} role="img" aria-label={`${series.map((s) => s.label).join(" and ")} over time`}>
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
            <XAxis
              dataKey="date"
              tickFormatter={labelFor(granularity)}
              tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v) => formatCompact(v)}
              tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
              content={<SeriesTooltip series={series} format={format} granularity={granularity} />}
            />
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

// Daily values as a table: the accessible alternative to the chart
export function SeriesTable({ data, series, format = (v) => v, granularity }) {
  return (
    <div className="max-h-[280px] overflow-auto scrollbar-thin rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-fg-muted">Date</th>
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
              <td className="px-3 py-1.5 text-fg">{labelFor(granularity)(row.date)}</td>
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

// Card with a title and a chart/table toggle in the header
export function ChartCard({ title, description, data, series, format, height, dimmed, granularity, className }) {
  const [view, setView] = useState("chart");
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
        {view === "chart" ? (
          <TimeSeriesChart data={data} series={series} format={format} height={height} dimmed={dimmed} granularity={granularity} />
        ) : (
          <SeriesTable data={data} series={series} format={format} granularity={granularity} />
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Share per channel as labelled horizontal bars. Labels and values are
 * always visible (the WhatsApp green is too light to carry meaning alone).
 */
export function ChannelSplit({ rows, valueKey, format = (v) => v }) {
  const total = rows.reduce((sum, row) => sum + (row[valueKey] || 0), 0);
  const bg = { whatsapp: "bg-whatsapp", instagram: "bg-instagram", facebook: "bg-facebook" };

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
