import React from "react";
import { Navigate } from "react-router-dom";
import { PageLoader } from "../../components/ui";
import { useBilling } from "./BillingContext";
import { BillingBlocked } from "./components";

// Landing spot after sign-in for staff (My work), and for links to pages a
// role can't open: the first page this person can use
export default function BillingStart() {
  const billing = useBilling();
  if (billing.loading && !billing.me) return <PageLoader />;
  if (billing.error) return <BillingBlocked error={billing.error} onRetry={billing.reload} />;
  return <Navigate to={billing.items[0]?.href || "/dashboard/billing/settings?tab=account"} replace />;
}
