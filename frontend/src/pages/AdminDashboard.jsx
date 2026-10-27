import React from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui";
import AdminShell, { ADMIN_SECTIONS } from "../features/admin/AdminShell";
import AdminUsers from "../features/admin/AdminUsers";
import { AdminAnalytics, AdminOverview } from "../features/admin/AdminOverview";
import { AdminCustomers, AdminOrders, AdminProducts } from "../features/admin/AdminRecords";
import AdminMessages from "../features/admin/AdminMessages";
import { SecuritySettings } from "../features/settings/AccountSettings";

function AdminSecurity() {
  const { user } = useAuth();
  return (
    <div>
      <PageHeader title="Security" description="Your admin password." />
      <div className="max-w-3xl">
        <SecuritySettings profile={user || {}} allowDelete={false} />
      </div>
    </div>
  );
}

const SECTIONS = {
  overview: AdminOverview,
  users: AdminUsers,
  orders: AdminOrders,
  customers: AdminCustomers,
  products: AdminProducts,
  messages: AdminMessages,
  analytics: AdminAnalytics,
  security: AdminSecurity,
};

const AdminDashboard = () => {
  const [params, setParams] = useSearchParams();
  const section = ADMIN_SECTIONS.some((s) => s.value === params.get("section")) ? params.get("section") : "overview";
  const Section = SECTIONS[section];

  return (
    <AdminShell section={section} onSection={(value) => setParams({ section: value })}>
      {/* key: reset the section's state when switching sections */}
      <Section key={section} />
    </AdminShell>
  );
};

export default AdminDashboard;
