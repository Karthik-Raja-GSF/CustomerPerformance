import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/shadcn/components/sonner";
import AIAgent from "@/pages/AIAgent";
import Settings from "@/pages/Settings";
import Prompts from "@/pages/settings/Prompts";
import Login from "@/pages/Login";
import ForceChangePassword from "@/pages/ForceChangePassword";
// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// import SiqImport from "@/pages/SiqImport"
import { ProtectedLayout } from "@/components/protected-layout";

export const routes = [
  { path: "/", title: "StarQ" },
  // TODO: SIQ Import temporarily disabled
  // { path: "/siq-import", title: "SIQ Data Import" },
  { path: "/settings", title: "Settings - Prompts" },
];

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route
          path="/force-change-password"
          element={<ForceChangePassword />}
        />

        {/* Protected routes with layout */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<AIAgent />} />
          {/* TODO: SIQ Import temporarily disabled */}
          {/* <Route path="/siq-import" element={<SiqImport />} /> */}
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
