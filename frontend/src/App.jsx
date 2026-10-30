import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import { PageLoader } from "./components/ui";
import { BillingProvider } from "./features/billing/BillingContext";


// Pages are split per route so the landing and login pages load fast
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const Products = lazy(() => import("./pages/Products"));
const Orders = lazy(() => import("./pages/Orders"));
const Messages = lazy(() => import("./pages/Messages"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));

// EMI & billing
const BillingOverview = lazy(() => import("./pages/billing/BillingOverview"));
const BillingStart = lazy(() => import("./features/billing/BillingStart"));
const NewSale = lazy(() => import("./pages/billing/NewSale"));
const Invoices = lazy(() => import("./pages/billing/Invoices"));
const InvoiceDetail = lazy(() => import("./pages/billing/InvoiceDetail"));
const EmiList = lazy(() => import("./pages/billing/EmiList"));
const EmiDetail = lazy(() => import("./pages/billing/EmiDetail"));
const Stock = lazy(() => import("./pages/billing/Stock"));
const Approvals = lazy(() => import("./pages/billing/Approvals"));
const Payments = lazy(() => import("./pages/billing/Payments"));
const Accounts = lazy(() => import("./pages/billing/Accounts"));
const BillingSettings = lazy(() => import("./pages/billing/BillingSettings"));
const BillingStaff = lazy(() => import("./pages/billing/Staff"));

// Admin Pages
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

const FullPageLoader = () => <PageLoader className="min-h-screen" />;

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BillingProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<FullPageLoader />}>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />

                    {/* Admin Routes */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route
                      path="/admin/dashboard"
                      element={
                        <ProtectedRoute adminOnly>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />

                    {/* Protected Dashboard Routes */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route element={<PageOutlet />}>
                        <Route index element={<Dashboard />} />
                        <Route path="customers" element={<Customers />} />
                        <Route path="messages" element={<Messages />} />
                        <Route path="products" element={<Products />} />
                        <Route path="orders" element={<Orders />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="settings" element={<Settings />} />
                        {/* Profile now lives in Settings */}
                        <Route path="profile" element={<Navigate to="/dashboard/settings?tab=profile" replace />} />

                        <Route path="billing">
                          <Route index element={<BillingOverview />} />
                          <Route path="start" element={<BillingStart />} />
                          <Route path="sale" element={<NewSale />} />
                          <Route path="invoices" element={<Invoices />} />
                          <Route path="invoices/:id" element={<InvoiceDetail />} />
                          <Route path="emi" element={<EmiList />} />
                          <Route path="emi/:id" element={<EmiDetail />} />
                          <Route path="stock" element={<Stock />} />
                          <Route path="approvals" element={<Approvals />} />
                          <Route path="payments" element={<Payments />} />
                          <Route path="accounts" element={<Accounts />} />
                          <Route path="staff" element={<BillingStaff />} />
                          <Route path="settings" element={<BillingSettings />} />
                          {/* Old or mistyped billing links (e.g. the removed NBFC and KYC pages) */}
                          <Route path="*" element={<Navigate to="/dashboard/billing/start" replace />} />
                        </Route>
                      </Route>
                    </Route>

                    {/* Catch all - redirect to home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </BillingProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// Keeps the app shell on screen while a page chunk loads, and contains
// a crashing page to its own area (reset when the user navigates away).
// Shop staff only use EMI & billing: anything else sends them there.
function PageOutlet() {
  const location = useLocation();
  const { user } = useAuth();
  if (user?.role === "staff" && !location.pathname.startsWith("/dashboard/billing")) {
    return <Navigate to="/dashboard/billing/start" replace />;
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <ErrorBoundary inline key={location.pathname}>
        <Outlet />
      </ErrorBoundary>
    </Suspense>
  );
}

export default App;
