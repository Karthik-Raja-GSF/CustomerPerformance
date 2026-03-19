import { Outlet } from "react-router-dom";
import Layout from "@/components/layout";
import { ProtectedRoute } from "@/components/protected-route";
import { ReportIssueFab } from "@/components/report-issue-dialog";
import { SessionTimeoutWarning } from "@/components/session-timeout-warning";

export function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
      <SessionTimeoutWarning />
      <ReportIssueFab />
    </ProtectedRoute>
  );
}
