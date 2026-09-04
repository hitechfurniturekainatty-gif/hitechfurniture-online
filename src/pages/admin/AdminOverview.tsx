import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { CommandCenterPanel } from "@/components/admin/CommandCenterPanel";
import { SalesFollowupPanel } from "@/components/admin/SalesFollowupPanel";
import { FurnitureWorkflowLauncher } from "@/components/admin/FurnitureWorkflowLauncher";
import AdminAnalyticsDashboard from "./AdminAnalyticsDashboard";
import AdminOfficeAnalyticsDashboard from "./AdminOfficeAnalyticsDashboard";
import AdminProductionAnalyticsDashboard from "./AdminProductionAnalyticsDashboard";
import AdminWarehouseAnalyticsDashboard from "./AdminWarehouseAnalyticsDashboard";
import AdminDeliveryAnalyticsDashboard from "./AdminDeliveryAnalyticsDashboard";
import { AdminSeoHealthDashboard } from "./AdminSeoHealthDashboard";

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWarehouse, user, loading: authLoading } = useAuth();

  if (!authLoading && user && isMeasurementStaff && !isOfficeStaff && !isDelivery) {
    return <Navigate to="/admin/my-work" replace />;
  }

  const showAdmin = isAdmin;
  const showOffice = isOfficeStaff;
  const showProduction = isOfficeStaff;
  const showWarehouse = isOfficeStaff || isWarehouse;
  const showDelivery = isOfficeStaff || isDelivery;

  const sections: { key: string; node: JSX.Element }[] = [
    (showAdmin || showOffice) && { key: "workflow-launcher", node: <FurnitureWorkflowLauncher /> },
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
        <h1 className="font-display text-2xl sm:text-3xl">Furniture Shop Command Center</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">One place for today's work — enquiry, custom orders, production, dispatch, delivery and customer collections.</p>
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
