import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/shadcn/components/sonner";
import AIAgent from "@/pages/AIAgent";
import Settings from "@/pages/Settings";
import Prompts from "@/pages/settings/Prompts";
import StockiqSync from "@/pages/StockiqSync";
import CustomerBids from "@/pages/CustomerBids";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import ForceChangePassword from "@/pages/ForceChangePassword";
import { ProtectedLayout } from "@/components/protected-layout";

export const routes = [
  { path: "/", title: "StarQ" },
  { path: "/stockiq-sync", title: "StockIQ Sync" },
  { path: "/back-to-school", title: "Back to School" },
  { path: "/settings", title: "Settings - Prompts" },
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
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<AIAgent />} />
          <Route path="/stockiq-sync" element={<StockiqSync />} />
          <Route path="/back-to-school" element={<CustomerBids />} />
          <Route path="/settings" element={<Settings />}>
            <Route index element={<Prompts />} />
          </Route>
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
