import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { CommandCenterPanel } from "@/components/admin/CommandCenterPanel";
import { SalesFollowupPanel } from "@/components/admin/SalesFollowupPanel";
import AdminAnalyticsDashboard from "./AdminAnalyticsDashboard";
import AdminOfficeAnalyticsDashboard from "./AdminOfficeAnalyticsDashboard";
import AdminProductionAnalyticsDashboard from "./AdminProductionAnalyticsDashboard";
import AdminWarehouseAnalyticsDashboard from "./AdminWarehouseAnalyticsDashboard";
import AdminDeliveryAnalyticsDashboard from "./AdminDeliveryAnalyticsDashboard";
import { AdminSeoHealthDashboard } from "./AdminSeoHealthDashboard";

// Single post-login landing page. Composes the Command Center + role dashboards
// as stacked sections. Admin sees the full business picture; office staff see
// the action-oriented sales/operations sections relevant to daily work.
const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWarehouse, user, loading: authLoading } = useAuth();

  // Measurement staff have their own dedicated page (assigned tasks).
  if (!authLoading && user && isMeasurementStaff && !isOfficeStaff && !isDelivery) {
    return <Navigate to="/admin/my-work" replace />;
  }

  const showAdmin = isAdmin;
  const showOffice = isOfficeStaff;
  const showProduction = isOfficeStaff;
  const showWarehouse = isOfficeStaff || isWarehouse;
  const showDelivery = isOfficeStaff || isDelivery;

  const sections: { key: string; node: JSX.Element }[] = [
    showAdmin && { key: "command-center", node: <CommandCenterPanel /> },
    (showAdmin || showOffice) && { key: "sales-followups", node: <SalesFollowupPanel /> },
    showAdmin && { key: "admin", node: <AdminAnalyticsDashboard /> },
    showAdmin && { key: "seo-health", node: <AdminSeoHealthDashboard /> },
    showOffice && { key: "office", node: <AdminOfficeAnalyticsDashboard /> },
    showProduction && { key: "production", node: <AdminProductionAnalyticsDashboard /> },
    showWarehouse && { key: "warehouse", node: <AdminWarehouseAnalyticsDashboard /> },
    showDelivery && { key: "delivery", node: <AdminDeliveryAnalyticsDashboard /> },
  ].filter(Boolean) as { key: string; node: JSX.Element }[];

  return (
    <AdminShell>
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Live snapshot of your business and today's action list.</p>
      </div>

      {sections.length === 0 ? (
        <p className="text-muted-foreground">No dashboard sections are available for your role yet. Ask an admin to check your access.</p>
      ) : (
        <div>
          {sections.map((s) => (
            <div key={s.key} className="border-t border-border/60 py-8 first:border-t-0 first:pt-0">
              {s.node}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
};

export default AdminOverview;
