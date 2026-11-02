import React, { useMemo, useState } from "react";
import { Download, IndianRupee, Receipt, RotateCcw, Store, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useToast } from "../../../components/Toast";
import { Button, Card, CardBody, CardHeader, ErrorState, Input, Select, StatCard } from "../../../components/ui";
import { ChartCard } from "../../../components/charts/Charts";
import { formatCompact, formatNumber } from "../../../utils/format";
import { inr } from "../../billing/api";
import { platformAdminApi } from "../../platformBilling/api";
import { istToday, useData } from "./shared";

// Date ranges in India time; the financial year starts on 1 April
function presetRange(preset) {
  const today = istToday();
  const [y, m] = today.split("-").map(Number);
  if (preset === "last-month") {
    const first = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    return { from: first, to: last };
  }
  if (preset === "30d") return { from: istToday(-29), to: today };
  if (preset === "fy") return { from: `${m >= 4 ? y : y - 1}-04-01`, to: today };
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

const PRESETS = [
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "30d", label: "Last 30 days" },
  { value: "fy", label: "This financial year" },
  { value: "custom", label: "Custom" },
];

// Days between two dates, each with its amount (0 when nothing came in)
function fillDays(from, to, rows) {
  const byDay = new Map(rows.map((r) => [r.date, r]));
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`) && out.length < 400; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    out.push({ date, collected: (byDay.get(date)?.amountPaise || 0) / 100 });
  }
  return out;
}

export default function Overview() {
  const toast = useToast();
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState(presetRange("month"));
  const range = preset === "custom" ? custom : presetRange(preset);
  const { data, error, reload } = useData(() => platformAdminApi.overview(range), [range.from, range.to]);
  const series = useMemo(() => (data ? fillDays(data.range.from, data.range.to, data.collectionsByDay) : []), [data]);

  const download = async (kind) => {
    try {
      await platformAdminApi.exportCsv(kind, range);
    } catch (e) {
      toast.error(e.message || "Couldn't export");
    }
  };

  if (error) return <ErrorState title="Couldn't load revenue" description={error} onRetry={reload} />;
  const d = data;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Period" className="w-52" value={preset} onChange={(e) => setPreset(e.target.value)} options={PRESETS} />
        {preset === "custom" && (
          <>
            <Input label="From" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-44" />
            <Input label="To" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-44" />
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" icon={Download} onClick={() => download("invoices")}>
            Invoices CSV
          </Button>
          <Button variant="secondary" size="sm" icon={Download} onClick={() => download("payments")}>
            Payments CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gross billed" icon={Receipt} loading={!d} value={inr(d?.grossBilledPaise, { whole: true })} deltaNote={d && `${formatNumber(d.invoicesIssued)} invoices · net ${inr(d.netBilledPaise, { whole: true })}`} />
        <StatCard label="Collected" icon={Wallet} loading={!d} value={inr(d?.collectedPaise, { whole: true })} deltaNote={d && `${formatNumber(d.paymentsCaptured)} payments`} />
        <StatCard label="Refunds" icon={RotateCcw} loading={!d} value={inr(d?.refundsPaise, { whole: true })} deltaNote={d && `Net collections ${inr(d.netCollectionsPaise, { whole: true })}`} />
        <StatCard label="Outstanding" icon={IndianRupee} loading={!d} value={inr(d?.outstandingPaise, { whole: true })} deltaNote={d && (d.overdueInvoices ? `${d.overdueInvoices} overdue · ${inr(d.overduePaise, { whole: true })}` : `${d.outstandingInvoices} unpaid invoices`)} />
        <StatCard label="MRR" icon={TrendingUp} loading={!d} value={inr(d?.mrrPaise, { whole: true })} deltaNote="Monthly, paid plans, before GST" />
        <StatCard label="ARR" icon={TrendingUp} loading={!d} value={inr(d?.arrPaise, { whole: true })} deltaNote="MRR × 12" />
        <StatCard label="Paying shops" icon={Store} loading={!d} value={formatNumber(d?.payingShops)} deltaNote={d && `ARPU ${inr(d.arpuPaise, { whole: true })} · ${d.trials} on trial`} />
        <StatCard label="Churn" icon={TrendingDown} loading={!d} value={d ? `${d.churnPct}%` : ""} deltaNote={d && `${d.churnedShops} paid plans ended in this period`} />
      </div>

      {d && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title="Collections per day"
            description={`Payments captured, ${d.range.from} to ${d.range.to} (India time)`}
            data={series}
            series={[{ key: "collected", label: "Collected", color: "var(--chart-1)" }]}
            format={(v) => inr(Math.round(v * 100))}
            yFormat={(v) => `₹${formatCompact(v)}`}
            average
          />
          <Card>
            <CardHeader title="MRR by plan" description="Active paid plans today" />
            <CardBody>
              {d.byPlan.length === 0 ? (
                <p className="text-caption text-fg-muted">No paid plans yet. Trials and free grants don't count.</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {d.byPlan.map((p) => (
                    <li key={p.plan}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-fg">
                          {p.name} <span className="text-caption text-fg-muted">· {p.shops} shop{p.shops === 1 ? "" : "s"}</span>
                        </span>
                        <span className="font-medium tabular-nums">{inr(p.mrrPaise, { whole: true })}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-2">
                        <div className="h-2 rounded-full bg-chart-1" style={{ width: `${d.mrrPaise ? (p.mrrPaise / d.mrrPaise) * 100 : 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {d && (
        <Card>
          <CardHeader title="How these are counted" description="Only ChatShop's own invoices, payments and refunds. A shop's sales to its customers are never counted here." />
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-caption sm:grid-cols-2">
              {Object.entries(d.definitions).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-28 shrink-0 font-medium capitalize text-fg">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                  <dd className="text-fg-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
