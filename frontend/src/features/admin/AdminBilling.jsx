import React, { useState } from "react";
import { PageHeader, Tabs } from "../../components/ui";
import Overview from "./billing/Overview";
import Renewals from "./billing/Renewals";
import Invoices from "./billing/Invoices";
import Payments from "./billing/Payments";
import Reconciliation from "./billing/Reconciliation";
import Plans from "./billing/Plans";
import BillingSettings from "./billing/Settings";

const TABS = [
  { value: "overview", label: "Overview", component: Overview },
  { value: "renewals", label: "Renewals", component: Renewals },
  { value: "invoices", label: "Invoices", component: Invoices },
  { value: "payments", label: "Payments", component: Payments },
  { value: "reconciliation", label: "Reconciliation", component: Reconciliation },
  { value: "plans", label: "Plans", component: Plans },
  { value: "settings", label: "Settings", component: BillingSettings },
];

// Super Admin only: what ChatShop AI bills shops for using the product
export default function AdminBilling() {
  const [tab, setTab] = useState("overview");
  const Section = TABS.find((t) => t.value === tab).component;
  return (
    <div>
      <PageHeader title="Billing & revenue" description="ChatShop's own plans, invoices, payments and refunds. A shop's sales to its customers are never counted here. Only the Super Admin sees this." />
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Billing sections" className="mb-6" />
      <Section />
    </div>
  );
}
