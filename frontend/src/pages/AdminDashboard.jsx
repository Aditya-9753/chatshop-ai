import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminShell, { sectionsFor } from "../features/admin/AdminShell";
import AdminUsers from "../features/admin/AdminUsers";
import { AdminOverview } from "../features/admin/AdminOverview";
import AdminAnalytics from "../features/admin/AdminAnalytics";
import AdminBilling from "../features/admin/AdminBilling";
import { AdminCustomers, AdminOrders, AdminProducts } from "../features/admin/AdminRecords";
import AdminMessages from "../features/admin/AdminMessages";
import AdminSettings from "../features/admin/AdminSettings";
import AdminSecurity from "../features/admin/AdminSecurity";

const SECTIONS = {
  overview: AdminOverview,
  users: AdminUsers,
  orders: AdminOrders,
  customers: AdminCustomers,
  products: AdminProducts,
  messages: AdminMessages,
  analytics: AdminAnalytics,
  billing: AdminBilling,
  settings: AdminSettings,
  security: AdminSecurity,
};

const AdminDashboard = () => {
  const [params, setParams] = useSearchParams();
  const { isSuperAdmin } = useAuth();
  const section = sectionsFor(isSuperAdmin).some((s) => s.value === params.get("section")) ? params.get("section") : "overview";
  const Section = SECTIONS[section];
  // "Refresh data" remounts the section, which reloads everything it shows
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AdminShell section={section} onSection={(value) => setParams({ section: value })} onRefresh={() => setRefreshKey((k) => k + 1)}>
      <Section key={`${section}-${refreshKey}`} />
    </AdminShell>
  );
};

export default AdminDashboard;
