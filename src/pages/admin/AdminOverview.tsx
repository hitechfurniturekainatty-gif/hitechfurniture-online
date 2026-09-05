import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { CommandCenterPanel } from "@/components/admin/CommandCenterPanel";
import { SalesFollowupPanel } from "@/components/admin/SalesFollowupPanel";
import { FurnitureWorkflowLauncher } from "@/components/admin/FurnitureWorkflowLauncher";
import { ReceivablesTodayPanel } from "@/components/admin/ReceivablesTodayPanel";
import { RoleFocusPanel } from "@/components/admin/RoleFocusPanel";
import AdminAnalyticsDashboard from "./AdminAnalyticsDashboard";
import AdminOfficeAnalyticsDashboard from "./AdminOfficeAnalyticsDashboard";
import AdminProductionAnalyticsDashboard from "./AdminProductionAnalyticsDashboard";
import AdminWarehouseAnalyticsDashboard from "./AdminWarehouseAnalyticsDashboard";
import AdminDeliveryAnalyticsDashboard from "./AdminDeliveryAnalyticsDashboard";
import { AdminSeoHealthDashboard } from "./AdminSeoHealthDashboard";

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWarehouse, user, loading: authLoading } = useAuth();
  if (!authLoading && user && isMeasurementStaff && !isOfficeStaff && !isDelivery) return <Navigate to="/admin/my-work" replace />;

  const showAdmin = isAdmin;
  const showOffice = isOfficeStaff;
  const showProduction = isOfficeStaff;
  const showWarehouse = isOfficeStaff || isWarehouse;
  const showDelivery = isOfficeStaff || isDelivery;

  const roleTitle = isAdmin ? "Admin Command Center" : isOfficeStaff ? "Sales & Office Dashboard" : isWarehouse ? "Warehouse Dashboard" : isDelivery ? "Delivery Dashboard" : "Work Dashboard";
  const roleSub = isAdmin
    ? "Business control without clutter — today's actions, pipeline health, operations and receivables."
    : isOfficeStaff
      ? "Customer follow-ups, quotations, measurements, order progress and receivable follow-up in one place."
      : isWarehouse
        ? "Ready orders, dispatch preparation and delivery handoff."
        : isDelivery
          ? "Trips, routes, customer deliveries and balance collection handoff."
          : "Your assigned work and next actions.";

  const sections: { key: string; node: JSX.Element }[] = [
    { key: "role-focus", node: <RoleFocusPanel isAdmin={isAdmin} isOfficeStaff={isOfficeStaff} isWarehouse={isWarehouse} isDelivery={isDelivery} /> },
    (showAdmin || showOffice) && { key: "workflow-launcher", node: <FurnitureWorkflowLauncher /> },
    showAdmin && { key: "receivables-today", node: <ReceivablesTodayPanel /> },
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
      <div className="admin-page-head mb-6 px-5 py-5 sm:mb-7 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1 rounded-full bg-[#96aba2]" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Hitech Furniture & Interiors</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-[#263238] sm:text-3xl">{roleTitle}</h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{roleSub}</p>
      </div>

      {sections.length === 0 ? (
        <p className="text-muted-foreground">No dashboard sections are available for your role yet. Ask an admin to check your access.</p>
      ) : (
        <div>
          {sections.map((s) => (
            <div key={s.key} className="border-t border-[#e7e9e6] py-7 first:border-t-0 first:pt-0 sm:py-8">
              {s.node}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
};

export default AdminOverview;