import React, { useState } from "react";
import { CalendarClock, CalendarX2, CreditCard, IndianRupee, Store, TrendingUp } from "lucide-react";
import adminService from "../../services/admin.service";
import { useToast } from "../../components/Toast";
import { Badge, Button, Card, CardBody, CardHeader, DataTable, ErrorState, PageHeader, StatCard } from "../../components/ui";
import { formatCurrency, formatDate, formatNumber } from "../../utils/format";
import { useLoad } from "./AdminOverview";

// Defined once so useLoad's callback stays stable between renders
const fetchBilling = () => adminService.getBilling();

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const timeLeft = (shop) => {
  if (shop.status && shop.status !== "active") return shop.status.charAt(0).toUpperCase() + shop.status.slice(1);
  if (shop.daysLeft === null) return "No end date";
  if (shop.daysLeft < 0) return `Ended ${plural(-shop.daysLeft, "day")} ago`;
  if (shop.daysLeft === 0) return "Ends today";
  return `${plural(shop.daysLeft, "day")} left`;
};

// Monthly revenue per plan, as a share of the total
function PlanRevenue({ plans, mrr }) {
  return (
    <Card>
      <CardHeader title="Revenue by plan" description="Monthly, from active plans. One-time plans are paid once, so they add no monthly revenue." />
      <CardBody>
        <ul className="flex flex-col gap-4">
          {plans.map((plan) => {
            const share = mrr ? (plan.mrr / mrr) * 100 : 0;
            return (
              <li key={plan.plan}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-fg">
                    {plan.name}{" "}
                    <span className="text-caption text-fg-muted">
                      · {formatCurrency(plan.price)}
                      {plan.plan === "one-time" ? " once" : "/mo"} · {plural(plan.shops, "shop")}
                    </span>
                  </span>
                  <span className="tabular-nums font-medium text-fg">{plan.plan === "one-time" ? "—" : formatCurrency(plan.mrr)}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full bg-chart-1" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

function ExtendButtons({ shop, days, onExtended }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const extend = async (add) => {
    setBusy(add);
    try {
      await adminService.extendSubscription(shop._id, add);
      toast.success(`${shop.businessName || shop.name}: plan extended by ${add} days`);
      onExtended();
    } catch (err) {
      toast.error(err.message || "Couldn't extend the plan");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex justify-end gap-1.5">
      {days.map((add) => (
        <Button key={add} size="sm" variant="secondary" loading={busy === add} disabled={busy !== null} onClick={() => extend(add)}>
          +{add} days
        </Button>
      ))}
    </div>
  );
}

function ShopPlans({ title, description, rows, tone, days, onExtended, empty }) {
  const columns = [
    {
      key: "shop",
      header: "Shop",
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{s.businessName || s.name}</p>
          <p className="truncate text-caption text-fg-muted">{s.email}</p>
        </div>
      ),
    },
    { key: "plan", header: "Plan", hideBelow: "sm", cell: (s) => <span className="capitalize">{s.plan}</span> },
    { key: "endDate", header: "Ends", hideBelow: "md", cell: (s) => (s.endDate ? formatDate(s.endDate) : "—") },
    { key: "left", header: "Status", cell: (s) => <Badge tone={tone} dot>{timeLeft(s)}</Badge> },
    { key: "extend", header: "Extend", align: "right", cell: (s) => <ExtendButtons shop={s} days={days} onExtended={onExtended} /> },
  ];
  return (
    <section>
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <p className="mb-3 text-caption text-fg-muted">{description}</p>
      <DataTable columns={columns} rows={rows} empty={empty} pageSize={8} />
    </section>
  );
}

// Super Admin only: what the platform earns and which plans need attention
export default function AdminBilling() {
  const { data, error, load } = useLoad(fetchBilling);

  if (error) return <ErrorState title="Couldn't load billing" description={error} onRetry={load} />;
  const totals = data?.totals;

  return (
    <div>
      <PageHeader title="Billing & renewals" description="Subscription revenue, plans ending soon and plans that have ended. Only the Super Admin sees this." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MRR" icon={IndianRupee} loading={!data} value={formatCurrency(totals?.mrr)} deltaNote="Monthly, from active plans" />
        <StatCard label="Yearly run rate" icon={TrendingUp} loading={!data} value={formatCurrency(totals?.arr)} deltaNote="MRR × 12" />
        <StatCard label="Shops on a plan" icon={Store} loading={!data} value={formatNumber(totals?.payingShops)} />
        <StatCard label={`Ending in ${data?.soonDays ?? 7} days`} icon={CalendarClock} loading={!data} value={formatNumber(totals?.expiringSoon)} deltaNote={totals?.ended ? `${totals.ended} already ended` : undefined} />
      </div>

      {data && (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <PlanRevenue plans={data.byPlan} mrr={totals.mrr} />
          </div>
          <div className="flex min-w-0 flex-col gap-8 xl:col-span-2">
            <ShopPlans
              title={`Ending in the next ${data.soonDays} days`}
              description="Give a shop more time before its plan runs out. Days are added to the current end date."
              rows={data.expiringSoon}
              tone="warning"
              days={[7, 30]}
              onExtended={load}
              empty={{ icon: CreditCard, title: "Nothing ending soon", description: `No plan ends in the next ${data.soonDays} days.` }}
            />
            <ShopPlans
              title="Ended"
              description="Plans that expired, were cancelled or ran past their end date. Extending switches the plan back on from today."
              rows={data.ended}
              tone="danger"
              days={[7, 30]}
              onExtended={load}
              empty={{ icon: CalendarX2, title: "No ended plans", description: "Every shop with a plan is still running." }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
