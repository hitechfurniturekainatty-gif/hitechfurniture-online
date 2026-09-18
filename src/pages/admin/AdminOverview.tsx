import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  ClipboardList,
  FileText,
  ShoppingCart,
  Boxes,
  PackageSearch,
  Hammer,
  Truck,
  WalletCards,
  Wrench,
  Users,
  ListTodo,
  BarChart3,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CommandCenterPanel } from "@/components/admin/CommandCenterPanel";
import { SalesFollowupPanel } from "@/components/admin/SalesFollowupPanel";
import { ReceivablesTodayPanel } from "@/components/admin/ReceivablesTodayPanel";
import { RoleFocusPanel } from "@/components/admin/RoleFocusPanel";

const overviewLoaders = {
  reports: () => import("./AdminAnalyticsDashboard"),
  sales: () => import("./AdminOfficeAnalyticsDashboard"),
  production: () => import("./AdminProductionAnalyticsDashboard"),
  warehouse: () => import("./AdminWarehouseAnalyticsDashboard"),
  delivery: () => import("./AdminDeliveryAnalyticsDashboard"),
  website: () => import("./AdminSeoHealthDashboard"),
};

const AdminAnalyticsDashboard = lazy(overviewLoaders.reports);
const AdminOfficeAnalyticsDashboard = lazy(overviewLoaders.sales);
const AdminProductionAnalyticsDashboard = lazy(overviewLoaders.production);
const AdminWarehouseAnalyticsDashboard = lazy(overviewLoaders.warehouse);
const AdminDeliveryAnalyticsDashboard = lazy(overviewLoaders.delivery);
const AdminSeoHealthDashboard = lazy(overviewLoaders.website);

type DashboardCounts = {
  enquiries: number;
  quotations: number;
  orders: number;
  inventory: number;
  production: number;
  services: number;
  deliveries: number;
  payments: number;
  tasks: number;
};

const EMPTY_COUNTS: DashboardCounts = {
  enquiries: 0,
  quotations: 0,
  orders: 0,
  inventory: 0,
  production: 0,
  services: 0,
  deliveries: 0,
  payments: 0,
  tasks: 0,
};

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWarehouse, user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState("today");
  const [visited,setVisited]=useState<string[]>(["today"]);
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [countsLoading, setCountsLoading] = useState(true);

  const showAdmin = isAdmin;
  const showOffice = isOfficeStaff;
  const showProduction = isOfficeStaff;
  const showWarehouse = isOfficeStaff || isWarehouse;
  const showDelivery = isOfficeStaff || isDelivery;

  useEffect(() => {
    if (authLoading || !user) return;
    const connection=(navigator as Navigator & {connection?:{saveData?:boolean;effectiveType?:string}}).connection;
    if(connection?.saveData||connection?.effectiveType?.includes("2g")) return;

    const keys: (keyof typeof overviewLoaders)[] = [];
    if (showOffice) keys.push("sales");
    if (showProduction) keys.push("production");
    if (showWarehouse) keys.push("warehouse");
    if (showDelivery) keys.push("delivery");
    if (showAdmin) keys.push("reports","website");

    let cancelled = false;
    const preload = () => {
      if (cancelled) return;
      void Promise.allSettled(keys.map(key => overviewLoaders[key]()));
    };
    const win = window as Window & { requestIdleCallback?: (cb: () => void, options?: {timeout?: number}) => number; cancelIdleCallback?: (id:number)=>void };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(preload,{timeout:1800});
      return () => { cancelled = true; win.cancelIdleCallback?.(id); };
    }
    const id = window.setTimeout(preload,700);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [authLoading,user,showAdmin,showOffice,showProduction,showWarehouse,showDelivery]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      setCountsLoading(true);
      const [
        enquiries,
        quotations,
        orders,
        inventory,
        production,
        services,
        deliveries,
        payments,
        tasks,
      ] = await Promise.all([
        supabase.from("quotations").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("lead_type", "lead").not("status", "in", "(rejected,delivered)"),
        supabase.from("quotations").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "drafted"),
        supabase.from("quotations").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("pipeline_stage", 3).neq("status", "rejected"),
        supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("job_work_orders").select("id", { count: "exact", head: true }).is("deleted_at", null).not("status", "in", "(completed,cancelled)"),
        supabase.from("customer_services").select("id", { count: "exact", head: true }).is("deleted_at", null).neq("status", "resolved"),
        supabase.from("quotations").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("pipeline_stage", 6).neq("status", "delivered").neq("status", "rejected"),
        supabase.from("receivables").select("id", { count: "exact", head: true }).is("closed_at", null),
        supabase.from("staff_diary_notes").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "pending"),
      ]);
      if (cancelled) return;
      setCounts({
        enquiries: enquiries.count ?? 0,
        quotations: quotations.count ?? 0,
        orders: orders.count ?? 0,
        inventory: inventory.count ?? 0,
        production: production.count ?? 0,
        services: services.count ?? 0,
        deliveries: deliveries.count ?? 0,
        payments: payments.count ?? 0,
        tasks: tasks.count ?? 0,
      });
      setCountsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  if (!authLoading && user && isMeasurementStaff && !isOfficeStaff && !isDelivery) return <Navigate to="/admin/my-work" replace />;

  const cards = useMemo(() => [
    {
      title: "Enquiries",
      count: counts.enquiries,
      detail: "Open customer enquiries",
      sub: "New leads, follow-up and customer requirements",
      action: "Open Enquiries",
      href: "/admin/enquiries",
      icon: ClipboardList,
      show: showOffice || showAdmin,
    },
    {
      title: "Demand Tracker",
      count: "→",
      detail: "Connected enquiry demand",
      sub: "Item demand remains linked to the enquiry pipeline",
      action: "View Demand",
      href: "/admin/enquiries",
      icon: PackageSearch,
      show: showOffice || showAdmin,
    },
    {
      title: "Quotations",
      count: counts.quotations,
      detail: "Draft quotations",
      sub: "Prepare, revise, share and convert",
      action: "Open Quotations",
      href: "/admin/quotations",
      icon: FileText,
      show: showOffice || showAdmin,
    },
    {
      title: "Orders",
      count: counts.orders,
      detail: "Orders in pipeline",
      sub: "Existing sales pipeline — no duplicate workflow",
      action: "View Orders",
      href: "/admin/pipeline",
      icon: ShoppingCart,
      show: showOffice || showAdmin,
    },
    {
      title: "Inventory",
      count: counts.inventory,
      detail: "Active catalogue products",
      sub: "Stock ledger, receiving and stock take",
      action: "Open Inventory",
      href: "/admin/inventory/ledger",
      icon: Boxes,
      show: showOffice || showAdmin || showWarehouse,
    },
    {
      title: "Purchase",
      count: "→",
      detail: "Reorder & requirements",
      sub: "Review items that need replenishment",
      action: "Open Purchase",
      href: "/admin/inventory/reorder",
      icon: PackageSearch,
      show: showOffice || showAdmin,
    },
    {
      title: "Production",
      count: counts.production,
      detail: "Active work orders",
      sub: "Pending, assigned and production jobs",
      action: "Open Production",
      href: "/admin/production",
      icon: Hammer,
      show: showProduction || showAdmin,
    },
    {
      title: "Delivery",
      count: counts.deliveries,
      detail: "Pending delivery flow",
      sub: "Logistics, routes and delivery handoff",
      action: "Open Delivery",
      href: "/admin/logistics",
      icon: Truck,
      show: showDelivery || showOffice || showAdmin,
    },
    {
      title: "Payments",
      count: counts.payments,
      detail: "Open receivables",
      sub: "Pending and overdue customer balances",
      action: "View Payments",
      href: "/admin/backlog",
      icon: WalletCards,
      show: showOffice || showAdmin,
    },
    {
      title: "Repairs & Service",
      count: counts.services,
      detail: "Open service requests",
      sub: "Repair, service and customer support jobs",
      action: "Open Service",
      href: "/admin/services",
      icon: Wrench,
      show: showOffice || showAdmin,
    },
    {
      title: "Customers",
      count: "→",
      detail: "Customer-linked records",
      sub: "Open through enquiries and quotation history",
      action: "View Customers",
      href: "/admin/enquiries",
      icon: Users,
      show: showOffice || showAdmin,
    },
    {
      title: "Tasks / Follow-ups",
      count: counts.tasks,
      detail: "Open diary tasks",
      sub: "Today, overdue and upcoming follow-ups",
      action: "Open Tasks",
      href: "/admin/diary",
      icon: ListTodo,
      show: true,
    },
    {
      title: "Reports",
      count: "↗",
      detail: "Business analytics",
      sub: "Sales, stock, pipeline and performance",
      action: "Open Reports",
      href: "/admin#detailed-dashboards",
      icon: BarChart3,
      show: showAdmin,
    },
  ].filter((card) => card.show), [counts, showOffice, showAdmin, showWarehouse, showProduction, showDelivery]);

  const roleTitle = isAdmin ? "Home Dashboard" : isOfficeStaff ? "Sales & Office Dashboard" : isWarehouse ? "Warehouse Dashboard" : isDelivery ? "Delivery Dashboard" : "Work Dashboard";
  const roleSub = isAdmin
    ? "One screen for enquiries, quotations, orders, stock, production, delivery and payments."
    : isOfficeStaff
      ? "Customer enquiries, quotations, orders and follow-ups in one clean view."
      : isWarehouse
        ? "Stock, order readiness and delivery handoff."
        : isDelivery
          ? "Trips, routes and pending deliveries."
          : "Your assigned work and next actions.";

  const sections = [
    { key: "today", label: "Today · Action centre", tone: "sand", node: <>{showAdmin ? <CommandCenterPanel compact /> : <RoleFocusPanel isAdmin={isAdmin} isOfficeStaff={isOfficeStaff} isWarehouse={isWarehouse} isDelivery={isDelivery} />}{showAdmin && <div className="mt-5"><ReceivablesTodayPanel /></div>}</> },
    ...(showOffice ? [{key:"sales",label:"Sales & quotations",tone:"blue",node:<><SalesFollowupPanel /><AdminOfficeAnalyticsDashboard /></>}] : []),
    ...(showProduction ? [{key:"production",label:"Production",tone:"violet",node:<AdminProductionAnalyticsDashboard />}] : []),
    ...(showWarehouse ? [{key:"warehouse",label:"Stock & warehouse",tone:"sage",node:<AdminWarehouseAnalyticsDashboard />}] : []),
    ...(showDelivery ? [{key:"delivery",label:"Delivery",tone:"terracotta",node:<AdminDeliveryAnalyticsDashboard />}] : []),
    ...(showAdmin ? [{key:"reports",label:"Business reports",tone:"slate",node:<AdminAnalyticsDashboard />},{key:"website",label:"Website health",tone:"rose",node:<AdminSeoHealthDashboard />}] : []),
  ];

  return (
    <AdminShell>
      <div className="mb-5 rounded-2xl border border-[#8b6b4f]/15 bg-gradient-to-br from-[#fbf8f4] to-white px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b6b4f]">Hitech Furniture & Interiors</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-[#2f2925] sm:text-3xl">{roleTitle}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{roleSub}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Enquiries" value={counts.enquiries} loading={countsLoading} />
            <MiniStat label="Orders" value={counts.orders} loading={countsLoading} />
            <MiniStat label="Delivery" value={counts.deliveries} loading={countsLoading} />
            <MiniStat label="Payments" value={counts.payments} loading={countsLoading} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} to={card.href} className="group block">
              <Card className="h-full border-[#8b6b4f]/15 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#8b6b4f]/35 hover:shadow-md">
                <CardContent className="flex h-full min-h-[178px] flex-col p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8b6b4f]/10 text-[#76563f]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-right">
                      {countsLoading && typeof card.count === "number" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="font-display text-2xl font-semibold text-[#2f2925]">{card.count}</span>
                      )}
                    </div>
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">{card.title}</h2>
                  <p className="mt-1 text-xs font-medium text-[#8b6b4f]">{card.detail}</p>
                  <p className="mt-1.5 flex-1 text-xs leading-5 text-muted-foreground">{card.sub}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-xs font-semibold text-[#76563f]">
                    <span>{card.action}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div id="detailed-dashboards" className="mt-8">
        <div className="mb-3">
          <h2 className="font-display text-xl font-semibold text-[#2f2925]">Detailed dashboards</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use these only when you need deeper operational details or reports.</p>
        </div>
        <Tabs value={sections.some(s => s.key === selected) ? selected : "today"} onValueChange={key=>{setSelected(key);setVisited(prev=>prev.includes(key)?prev:[...prev,key]);}}>
          <TabsList aria-label="Dashboard departments" className="mb-5 flex h-auto flex-wrap justify-start gap-2">
            {sections.map(s => <TabsTrigger key={s.key} value={s.key} className={`overview-tab overview-${s.tone}`}><span className="overview-tab-dot" aria-hidden="true"/>{s.label}</TabsTrigger>)}
          </TabsList>
          {sections.filter(s=>visited.includes(s.key)).map(s => (
            <TabsContent forceMount hidden={s.key!==(sections.some(s=>s.key===selected)?selected:"today")} key={s.key} value={s.key} className={`overview-section overview-${s.tone} space-y-5 rounded-2xl border p-4 sm:p-5`}>
              <Suspense fallback={<div role="status" className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading {s.label}…</div>}>{s.node}</Suspense>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminShell>
  );
};

const MiniStat = ({ label, value, loading }: { label: string; value: number; loading: boolean }) => (
  <div className="min-w-[92px] rounded-xl border border-[#8b6b4f]/15 bg-white px-3 py-2.5 shadow-sm">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <div className="mt-1 font-display text-lg font-semibold text-[#2f2925]">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : value}
    </div>
  </div>
);

export default AdminOverview;
