import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, IndianRupee, MessageSquare, Plus, ShoppingCart, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import analyticsService from "../services/analytics.service";
import { Button, Card, CardBody, CardHeader, ErrorState, PageHeader, Skeleton, StatCard } from "../components/ui";
import { ChannelSplit, ChartCard } from "../components/charts/Charts";
import { ChannelStatus, NeedsAttention, OnboardingChecklist } from "../features/dashboard/Attention";
import { formatCurrency, formatDuration, formatNumber, percentChange } from "../utils/format";

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <StatCard key={i} label=" " loading />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-[340px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    </>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await analyticsService.getOverview();
      setData(response.data);
    } catch (err) {
      setError(err.message || "Please try again.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpi = (key) => data?.kpis[key] || { current: 0, previous: 0 };
  const spark = (key) => data?.series.map((day) => day[key]);
  const shopName = user?.businessInfo?.businessName;

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(" ")[0] || "there"}`}
        description={`Here's how ${shopName || "your shop"} did in the last 7 days.`}
        actions={
          <>
            <Button as={Link} to="/dashboard/messages" variant="secondary" icon={MessageSquare}>
              Open inbox
            </Button>
            <Button as={Link} to="/dashboard/orders?new=1" icon={Plus}>
              New order
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState title="Couldn't load your dashboard" description={error} onRetry={load} />
        </Card>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          {!data.onboarding.whatsappConnected && <OnboardingChecklist onboarding={data.onboarding} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue"
              icon={IndianRupee}
              value={formatCurrency(kpi("revenue").current)}
              delta={percentChange(kpi("revenue").current, kpi("revenue").previous)}
              sparkline={spark("revenue")}
            />
            <StatCard
              label="Orders"
              icon={ShoppingCart}
              value={formatNumber(kpi("orders").current)}
              delta={percentChange(kpi("orders").current, kpi("orders").previous)}
              sparkline={spark("orders")}
            />
            <StatCard
              label="New customers"
              icon={UserPlus}
              value={formatNumber(kpi("newCustomers").current)}
              delta={percentChange(kpi("newCustomers").current, kpi("newCustomers").previous)}
              sparkline={spark("newCustomers")}
            />
            <StatCard
              label="Median response time"
              icon={Clock}
              value={formatDuration(kpi("responseTimeMinutes").current)}
              delta={
                kpi("responseTimeMinutes").current != null && kpi("responseTimeMinutes").previous
                  ? percentChange(kpi("responseTimeMinutes").current, kpi("responseTimeMinutes").previous)
                  : undefined
              }
              invertDelta
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <ChartCard
                title="Revenue"
                description="Paid orders, excluding cancelled, per day"
                data={data.series}
                series={[{ key: "revenue", label: "Revenue", color: "var(--chart-1)" }]}
                format={(v) => formatCurrency(v)}
              />
              <Card>
                <CardHeader title="Messages by channel" description="Last 7 days, both directions" />
                <CardBody>
                  <ChannelSplit rows={data.channelStats} valueKey="messages" format={formatNumber} />
                </CardBody>
              </Card>
            </div>
            <div className="flex flex-col gap-6">
              <NeedsAttention attention={data.attention} />
              <ChannelStatus channels={data.channels} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
