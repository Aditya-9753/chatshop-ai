import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, CheckSquare, IndianRupee, Plus, Receipt, Wallet } from "lucide-react";
import { Button, Card, CardBody, CardHeader, ErrorState, PageHeader, Skeleton, StatCard } from "../../components/ui";
import { ChartCard } from "../../components/charts/Charts";
import { BillingGate, BucketBadge, useLoad } from "../../features/billing/components";
import { useBilling } from "../../features/billing/BillingContext";
import { emiApi, fromPaise, inr } from "../../features/billing/api";
import { formatCurrencyCompact } from "../../utils/format";

const B = "/dashboard/billing";

function AttentionRow({ icon: Icon, tone, title, detail, to }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2 transition-colors">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block truncate text-caption text-fg-muted">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
    </Link>
  );
}

function Overview() {
  const { can, tenant } = useBilling();
  const { data, loading, error, reload } = useLoad(() => emiApi.get("/reports/dashboard"), []);

  if (error) return <ErrorState description={error.message} onRetry={reload} />;
  const d = data;
  const chartData = (d?.sales14d || []).map((row) => ({ date: row.date, sales: fromPaise(row.gross) }));
  const attention = d
    ? [
        d.overdue.count > 0 && { icon: AlertTriangle, tone: "bg-danger-soft text-danger-fg", title: `${d.overdue.count} overdue installment${d.overdue.count === 1 ? "" : "s"}`, detail: `${inr(d.overdue.amount)} to collect`, to: `${B}/emi?view=overdue` },
        d.pendingApprovals > 0 && { icon: CheckSquare, tone: "bg-warning-soft text-warning-fg", title: `${d.pendingApprovals} approval${d.pendingApprovals === 1 ? "" : "s"} waiting`, detail: "High EMI, waivers, foreclosures, cancellations", to: `${B}/approvals` },
      ].filter(Boolean)
    : [];

  return (
    <>
      <PageHeader
        title="Billing overview"
        description={`${tenant?.name || "Your shop"} · counter sales, EMI book and collections`}
        actions={
          can("invoice.create") && (
            <Button as={Link} to={`${B}/sale`} icon={Plus}>
              New sale
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sales today" icon={Receipt} loading={loading} value={d ? inr(d.salesToday.gross, { whole: true }) : "—"} deltaNote={d && `${d.salesToday.count} invoice${d.salesToday.count === 1 ? "" : "s"}`} />
        <StatCard label="EMI collected today" icon={Wallet} loading={loading} value={d ? inr(d.collectionsToday.amount, { whole: true }) : "—"} deltaNote={d && `${d.collectionsToday.count} receipt${d.collectionsToday.count === 1 ? "" : "s"}`} />
        <StatCard label="EMI book outstanding" icon={IndianRupee} loading={loading} value={d ? inr(d.emiBook.outstanding, { whole: true }) : "—"} deltaNote={d && `${d.emiBook.contracts} active contract${d.emiBook.contracts === 1 ? "" : "s"}`} />
        <StatCard label="Overdue" icon={CalendarClock} loading={loading} value={d ? inr(d.overdue.amount, { whole: true }) : "—"} deltaNote={d && `${d.overdue.count} installment${d.overdue.count === 1 ? "" : "s"}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Sales, last 14 days"
          description="GST-inclusive invoice value per day"
          data={chartData}
          series={[{ key: "sales", label: "Sales", color: "var(--chart-1)" }]}
          format={(v) => inr(Math.round(v * 100), { whole: true })}
          yFormat={formatCurrencyCompact}
          height={240}
        />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Needs attention" />
            <CardBody className="px-3">
              {loading && !d ? (
                <Skeleton className="h-20 w-full" />
              ) : attention.length ? (
                attention.map((row) => <AttentionRow key={row.title} {...row} />)
              ) : (
                <p className="px-2 py-3 text-caption text-fg-muted">All clear: nothing overdue or waiting on you.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="EMI book by days past due" action={<Link className="text-caption text-accent hover:underline" to={`${B}/emi`}>Open</Link>} />
            <CardBody>
              <ul className="flex flex-col gap-2">
                {(d?.buckets || []).map((b) => (
                  <li key={b.bucket} className="flex items-center justify-between text-sm">
                    <BucketBadge bucket={b.bucket} />
                    <Link to={`${B}/emi?view=bucket&bucket=${encodeURIComponent(b.bucket)}`} className="tabular-nums text-fg hover:text-accent">
                      {b.count} contract{b.count === 1 ? "" : "s"}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function BillingOverview() {
  return (
    <BillingGate perm="report.store">
      <Overview />
    </BillingGate>
  );
}
