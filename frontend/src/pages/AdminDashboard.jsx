import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminShell, { sectionsFor } from "../features/admin/AdminShell";
import AdminUsers from "../features/admin/AdminUsers";
import { AdminOverview } from "../features/admin/AdminOverview";
import AdminAnalytics from "../features/admin/AdminAnalytics";
import AdminBilling from "../features/admin/AdminBilling";
import AdminAssistant from "../features/admin/AdminAssistant";
import ShopAdminOverview from "../features/admin/ShopAdminOverview";
import AdminEmi from "../features/admin/AdminEmi";
import { AdminCustomers, AdminOrders, AdminProducts } from "../features/admin/AdminRecords";
import AdminMessages from "../features/admin/AdminMessages";
import AdminSettings from "../features/admin/AdminSettings";
import AdminSecurity from "../features/admin/AdminSecurity";
import { SystemHealth, IncidentCenter, IncidentDetails, GuardianNotifications, AuditLogs } from "../features/systemGuardian";

const SECTIONS = {
  overview: AdminOverview,
  users: AdminUsers,
  orders: AdminOrders,
  customers: AdminCustomers,
  products: AdminProducts,
  messages: AdminMessages,
  analytics: AdminAnalytics,
  billing: AdminBilling,
  assistant: AdminAssistant,
  emi: AdminEmi,
  settings: AdminSettings,
  security: AdminSecurity,
  // System Guardian sections (Super Admin only)
  guardian_health: SystemHealth,
  guardian_incidents: IncidentCenter,
  guardian_notifications: GuardianNotifications,
  guardian_audit: AuditLogs,
};

const AdminDashboard = () => {
  const [params, setParams] = useSearchParams();
  const { isSuperAdmin, isShopAdmin } = useAuth();
  const section = sectionsFor(isSuperAdmin, isShopAdmin).some((s) => s.value === params.get("section")) ? params.get("section") : "overview";
  const incidentId = params.get("incident");
  // An Admin who looks after one shop gets that shop's overview, not the platform's
  let Section = isShopAdmin && section === "overview" ? ShopAdminOverview : SECTIONS[section];
  if (section === "guardian_incidents" && incidentId) Section = IncidentDetails;
  // "Refresh data" remounts the section, which reloads everything it shows
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AdminShell section={section} onSection={(value) => setParams({ section: value })} onRefresh={() => setRefreshKey((k) => k + 1)}>
      <Section
        key={`${section}-${incidentId || ""}-${refreshKey}`}
        incidentId={incidentId || undefined}
      />
    </AdminShell>
  );
};

export default AdminDashboard;
