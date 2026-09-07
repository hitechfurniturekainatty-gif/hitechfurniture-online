import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [selected, setSelected] = useState("today");
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

  const sections = [
    { key: "today", label: "Today · Action centre", tone: "sand", node: <>{showAdmin ? <CommandCenterPanel compact /> : <RoleFocusPanel isAdmin={isAdmin} isOfficeStaff={isOfficeStaff} isWarehouse={isWarehouse} isDelivery={isDelivery} />}{showAdmin && <div className="mt-5"><ReceivablesTodayPanel /></div>}</> },
    ...(showOffice ? [{key:"sales",label:"Sales & quotations",tone:"blue",node:<><SalesFollowupPanel /><AdminOfficeAnalyticsDashboard /></>}] : []),
    ...(showProduction ? [{key:"production",label:"Production",tone:"violet",node:<AdminProductionAnalyticsDashboard />}] : []),
    ...(showWarehouse ? [{key:"warehouse",label:"Stock & warehouse",tone:"sage",node:<AdminWarehouseAnalyticsDashboard />}] : []),
    ...(showDelivery ? [{key:"delivery",label:"Delivery",tone:"terracotta",node:<AdminDeliveryAnalyticsDashboard />}] : []),
    ...(showAdmin ? [{key:"reports",label:"Business reports",tone:"blue",node:<AdminAnalyticsDashboard />},{key:"website",label:"Website health",tone:"sage",node:<AdminSeoHealthDashboard />}] : []),
  ];

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

      <Tabs value={sections.some(s => s.key === selected) ? selected : "today"} onValueChange={setSelected}>
        <TabsList aria-label="Dashboard departments" className="mb-5 flex h-auto flex-wrap justify-start gap-2">{sections.map(s => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}</TabsList>
        {sections.map(s => <TabsContent key={s.key} value={s.key} className={`overview-section overview-${s.tone} space-y-5 rounded-2xl border p-4 sm:p-5`}>{s.node}</TabsContent>)}
      </Tabs>
    </AdminShell>
  );
};

export default AdminOverview;