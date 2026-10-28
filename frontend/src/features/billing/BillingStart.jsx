import React from "react";
import { Navigate } from "react-router-dom";
import { PageLoader, ErrorState } from "../../components/ui";
import { BILLING_ITEMS } from "../../layouts/navigation";
import { useBilling } from "./BillingContext";

// Landing spot after sign-in for staff: the first page their role can use
export default function BillingStart() {
  const billing = useBilling();
  if (billing.loading && !billing.me) return <PageLoader />;
  if (billing.error) return <ErrorState title="EMI & billing is unavailable" description={billing.error.message} onRetry={billing.reload} />;
  const first = BILLING_ITEMS.find((item) => billing.can(item.perm));
  return <Navigate to={first?.href || "/dashboard/billing/settings?tab=account"} replace />;
}
