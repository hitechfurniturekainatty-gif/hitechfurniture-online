import { useEffect, useMemo, useState } from "react";
// Route updated to support delivery-only role redirect
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FolderTree, AlertTriangle, FileText, Ruler, HardHat, Users, Clock, Truck, LifeBuoy, Wrench, ShoppingBag, Map, Route, Boxes } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { statusBadgeVariant, statusLabel } from "./AdminQuotationEditor";

const QUOTATION_STATUSES = ["draft", "drafted", "finalized", "sent", "accepted", "completed", "rejected"] as const;

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    products: 0, categories: 0, lowStock: 0,
    quotations: 0, drafts: 0, myTasks: 0, workers: 0,
    openServices: 0, openComplaints: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const run = async () => {
      const queries = [
        supabase.from("products").select("id", { count: "exact", head: true }).then((r) => r),
        supabase.from("main_categories").select("id", { count: "exact", head: true }).then((r) => r),
        supabase.from("products").select("id", { count: "exact", head: true }).lte("stock_quantity", 5).then((r) => r),
        supabase.from("quotations").select("id", { count: "exact", head: true }).then((r) => r),
        supabase.from("quotations").select("id", { count: "exact", head: true }).eq("status", "draft").then((r) => r),
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true).then((r) => r),
        supabase.from("customer_services").select("id", { count: "exact", head: true }).not("status", "in", "(resolved,cancelled,converted)").then((r) => r),
        supabase.from("customer_complaints").select("id", { count: "exact", head: true }).not("status", "in", "(resolved,cancelled)").then((r) => r),
      ];
      if (user?.id && isMeasurementStaff) {
        queries.push(
          supabase.from("measurement_tasks").select("id", { count: "exact", head: true })
            .eq("assigned_to", user.id).neq("status", "completed").then((r) => r)
        );
      }
      const r = await Promise.all(queries);
      setStats({
        products: r[0].count ?? 0,
        categories: r[1].count ?? 0,
        lowStock: r[2].count ?? 0,
        quotations: r[3].count ?? 0,
        drafts: r[4].count ?? 0,
        workers: r[5].count ?? 0,
        openServices: r[6].count ?? 0,
        openComplaints: r[7].count ?? 0,
        myTasks: r[8]?.count ?? 0,
      });

      // Status breakdown for office staff
      if (isOfficeStaff) {
        const statusResults = await Promise.all(
          QUOTATION_STATUSES.map((s) =>
            supabase.from("quotations").select("id", { count: "exact", head: true }).eq("status", s).then((r) => ({ s, count: r.count ?? 0 }))
          )
        );
        const map: Record<string, number> = {};
        statusResults.forEach((x) => { map[x.s] = x.count; });
        setStatusCounts(map);
      }
    };
    run();
  }, [user?.id, isMeasurementStaff, isOfficeStaff]);

  // Measurement-only staff: redirect to personal page
  if (!authLoading && user && isMeasurementStaff && !isOfficeStaff && !isDelivery) {
    return <Navigate to="/admin/my-work" replace />;
  }
  // Delivery-only users: send straight to their trip list
  if (!authLoading && user && isDelivery && !isOfficeStaff && !isMeasurementStaff) {
    return <Navigate to="/admin/my-trips" replace />;
  }

  type StatCard = { label: string; value: number; icon: any; to: string };
  type Group = {
    key: string;
    title: string;
    subtitle: string;
    icon: any;
    accent: string; // tailwind classes for tint (icon bg + border)
    cards: StatCard[];
  };

  const salesCards: StatCard[] = [
    isMeasurementStaff && { label: "My pending tasks", value: stats.myTasks, icon: Clock, to: "/admin/measurement-tasks" },
    isOfficeStaff && { label: "Quotations", value: stats.quotations, icon: FileText, to: "/admin/quotations" },
    isOfficeStaff && { label: "Draft quotations", value: stats.drafts, icon: Ruler, to: "/admin/quotations?status=draft" },
    isOfficeStaff && { label: "Open services", value: stats.openServices, icon: Wrench, to: "/admin/services?tab=service" },
    isOfficeStaff && { label: "Open complaints", value: stats.openComplaints, icon: AlertTriangle, to: "/admin/services?tab=complaint" },
    isAdmin && { label: "Workers", value: stats.workers, icon: HardHat, to: "/admin/workers" },
  ].filter(Boolean) as StatCard[];

  const logisticsCards: StatCard[] = isOfficeStaff
    ? [
        { label: "Logistics Mapping", value: 0, icon: Map, to: "/admin/logistics" },
        { label: "Trips", value: 0, icon: Truck, to: "/admin/trips" },
        ...(isAdmin ? [{ label: "Route Manager", value: 0, icon: Route, to: "/admin/routes" }] : []),
      ]
    : [];

  const inventoryCards: StatCard[] = isAdmin
    ? [
        { label: "Products", value: stats.products, icon: Package, to: "/admin/products" },
        { label: "Categories", value: stats.categories, icon: FolderTree, to: "/admin/categories" },
        { label: "Low stock (≤5)", value: stats.lowStock, icon: AlertTriangle, to: "/admin/products" },
      ]
    : [];

  const groups: Group[] = [
    {
      key: "sales",
      title: "Sales & Services",
      subtitle: "Quotations, customer services and complaints",
      icon: ShoppingBag,
      // Green / success theme
      accent: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
      cards: salesCards,
    },
    {
      key: "logistics",
      title: "Logistics & Fleet",
      subtitle: "Routes, trips and live mapping",
      icon: Truck,
      // Blue / info theme
      accent: "border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400",
      cards: logisticsCards,
    },
    {
      key: "inventory",
      title: "Inventory & Catalog",
      subtitle: "Products and categories",
      icon: Boxes,
      // Orange / warning theme
      accent: "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400",
      cards: inventoryCards,
    },
  ].filter((g) => g.cards.length > 0);

  return (
    <AdminShell>
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {isMeasurementStaff && !isOfficeStaff ? "Your assigned measurement tasks." : "Quick snapshot of your business."}
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.key} className={`rounded-2xl border p-4 sm:p-5 ${g.accent.replace("text-", "")}`}>
            <div className="mb-3 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${g.accent}`}>
                <g.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold sm:text-xl">{g.title}</h2>
                <p className="text-xs text-muted-foreground">{g.subtitle}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.cards.map((c) => (
                <Link key={c.label} to={c.to} className="block">
                  <Card className="bg-card transition-smooth hover:shadow-product">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="truncate">{c.label}</span>
                        <c.icon className={`h-4 w-4 ${g.accent.split(" ").filter((cls) => cls.startsWith("text-")).join(" ")}`} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-display text-3xl font-semibold text-foreground">{c.value}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {isOfficeStaff && (
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-xl">Quotations by status</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/admin/quotations">View all</Link></Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {QUOTATION_STATUSES.map((s) => (
              <Link key={s} to={`/admin/quotations?status=${s}`} className="block">
                <div className="flex flex-col items-start gap-2 rounded-lg border bg-card p-3 transition-smooth hover:border-primary hover:shadow-sm">
                  <Badge variant={statusBadgeVariant(s)} className="text-[10px]">{statusLabel(s)}</Badge>
                  <p className="font-display text-2xl font-semibold text-foreground">{statusCounts[s] ?? 0}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {isOfficeStaff && (
        <Card className="mt-8">
          <CardHeader><CardTitle className="font-display text-xl">Quick actions</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild><Link to="/admin/quotations"><FileText className="mr-2 h-4 w-4" />New quotation</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/services"><LifeBuoy className="mr-2 h-4 w-4" />Service & Complaint Hub</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/measurement-tasks"><Ruler className="mr-2 h-4 w-4" />Assign measurement</Link></Button>
            {isAdmin && <Button asChild variant="outline"><Link to="/admin/workers"><HardHat className="mr-2 h-4 w-4" />Manage workers</Link></Button>}
            {isAdmin && <Button asChild variant="outline"><Link to="/admin/staff"><Users className="mr-2 h-4 w-4" />Staff management</Link></Button>}
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
};

export default AdminOverview;
