import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/shadcn/components/sonner";
import { Feature } from "@/config/features";
import { FeatureGuard } from "@/components/feature-guard";
import AIAgent from "@/pages/AIAgent";
import Settings from "@/pages/Settings";
import Prompts from "@/pages/settings/Prompts";
import RbacAdmin from "@/pages/settings/RbacAdmin";
import StockiqSync from "@/pages/StockiqSync";
import CustomerBidsSync from "@/pages/CustomerBidsSync";
import DemandValidationTool from "@/pages/DemandValidationTool";
import MonthlyForecast from "@/pages/MonthlyForecast";
import ConfirmedBidItems from "@/pages/ConfirmedBidItems";
import BidExportHistory from "@/pages/BidExportHistory";
import EoDashboard from "@/pages/EoDashboard";
import EoRiskReview from "@/pages/EoRiskReview";
import EoActions from "@/pages/EoActions";
import EoDisposition from "@/pages/EoDisposition";
import CustomerPerformance from "@/pages/CustomerPerformance";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import ForceChangePassword from "@/pages/ForceChangePassword";
import { ProtectedLayout } from "@/components/protected-layout";
import { EoProvider } from "@/contexts/eo-context";

export const routes = [
  { path: "/", title: "StarQ" },
  { path: "/stockiq-sync", title: "StockIQ Sync" },
  { path: "/customer-bids-sync", title: "Customer Bids Sync" },
  {
    path: "/sales-insights/demand-validation-tool",
    title: "Demand Validation Tool",
  },
  { path: "/demand-planning/monthly-forecast", title: "Monthly Forecast" },
  {
    path: "/demand-planning/confirmed-bid-items",
    title: "Confirmed Bid Items",
  },
  { path: "/bid-export-history", title: "Bid Items Export History" },
  { path: "/eo/dashboard", title: "E&O Dashboard" },
  { path: "/eo/risk-review", title: "Risk Review" },
  { path: "/eo/actions", title: "Actions" },
  { path: "/eo/disposition", title: "Disposition" },
  { path: "/customer-performance", title: "Customer Performance" },
  { path: "/settings", title: "Settings - Prompts" },
  { path: "/settings/rbac", title: "Settings - Access Control" },
];

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/force-change-password"
          element={<ForceChangePassword />}
        />

        {/* Protected routes with layout */}
        <Route
          element={
            <EoProvider>
              <ProtectedLayout />
            </EoProvider>
          }
        >
          <Route
            path="/"
            element={
              <FeatureGuard feature={Feature.STARQ}>
                <AIAgent />
              </FeatureGuard>
            }
          />
          <Route
            path="/stockiq-sync"
            element={
              <FeatureGuard feature={Feature.STOCKIQ_SYNC}>
                <StockiqSync />
              </FeatureGuard>
            }
          />
          <Route
            path="/customer-bids-sync"
            element={
              <FeatureGuard feature={Feature.CUSTOMER_BIDS_SYNC}>
                <CustomerBidsSync />
              </FeatureGuard>
            }
          />
          <Route
            path="/sales-insights/demand-validation-tool"
            element={
              <FeatureGuard feature={Feature.DEMAND_VALIDATION_TOOL}>
                <DemandValidationTool />
              </FeatureGuard>
            }
          />
          <Route
            path="/demand-planning/monthly-forecast"
            element={
              <FeatureGuard feature={Feature.MONTHLY_FORECAST}>
                <MonthlyForecast />
              </FeatureGuard>
            }
          />
          <Route
            path="/demand-planning/confirmed-bid-items"
            element={
              <FeatureGuard feature={Feature.CONFIRMED_BID_ITEMS}>
                <ConfirmedBidItems />
              </FeatureGuard>
            }
          />
          <Route
            path="/bid-export-history"
            element={
              <FeatureGuard feature={Feature.BID_EXPORT}>
                <BidExportHistory />
              </FeatureGuard>
            }
          />
          <Route
            path="/eo/dashboard"
            element={
              <FeatureGuard feature={Feature.EO_DASHBOARD}>
                <EoDashboard />
              </FeatureGuard>
            }
          />
          <Route
            path="/eo/risk-review"
            element={
              <FeatureGuard feature={Feature.EO_RISK_REVIEW}>
                <EoRiskReview />
              </FeatureGuard>
            }
          />
          <Route
            path="/eo/actions"
            element={
              <FeatureGuard feature={Feature.EO_ACTIONS}>
                <EoActions />
              </FeatureGuard>
            }
          />
          <Route
            path="/eo/disposition"
            element={
              <FeatureGuard feature={Feature.EO_DISPOSITION}>
                <EoDisposition />
              </FeatureGuard>
            }
          />
          <Route
            path="/customer-performance"
            element={
              <FeatureGuard feature={Feature.CUSTOMER_PERFORMANCE}>
                <CustomerPerformance />
              </FeatureGuard>
            }
          />
          <Route path="/settings" element={<Settings />}>
            <Route
              index
              element={
                <FeatureGuard feature={Feature.PROMPT_BUILDER}>
                  <Prompts />
                </FeatureGuard>
              }
            />
            <Route
              path="rbac"
              element={
                <FeatureGuard feature={Feature.RBAC_ADMIN}>
                  <RbacAdmin />
                </FeatureGuard>
              }
            />
          </Route>
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
