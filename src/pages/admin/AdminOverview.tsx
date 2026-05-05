import { useEffect, useMemo, useState } from "react";
// Route updated to support delivery-only role redirect
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FolderTree, AlertTriangle, FileText, Ruler, HardHat, Users, Clock, Truck, LifeBuoy, Wrench, ShoppingBag, Map, Route, Boxes, CalendarClock, CheckCircle2 } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { statusBadgeVariant, statusLabel, normalizeStatus } from "./AdminQuotationEditor";

const QUOTATION_STATUSES = ["drafted", "finalized", "delivered", "rejected"] as const;

type UpcomingDelivery = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string | null;
  expected_delivery_date: string;
  status: string;
  total: number;
};

type AwaitingPricing = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string | null;
  created_at: string;
  created_by: string | null;
};

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    products: 0, categories: 0, lowStock: 0,
    quotations: 0, drafts: 0, myTasks: 0, workers: 0,
    openServices: 0, openComplaints: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [upcoming, setUpcoming] = useState<UpcomingDelivery[]>([]);
  const [awaitingPricing, setAwaitingPricing] = useState<AwaitingPricing[]>([]);

  useEffect(() => {
    const run = async () => {
      const queries = [
        supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null).then((r) => r),
        supabase.from("main_categories").select("id", { count: "exact", head: true }).is("deleted_at", null).then((r) => r),
        supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null).lte("stock_quantity", 5).then((r) => r),
        supabase.from("quotations").select("id", { count: "exact", head: true }).is("deleted_at", null).then((r) => r),
        supabase.from("quotations").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "drafted").then((r) => r),
        supabase.from("workers").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("is_active", true).then((r) => r),
        supabase.from("customer_services").select("id", { count: "exact", head: true }).is("deleted_at", null).not("status", "in", "(resolved,cancelled,converted)").then((r) => r),
        supabase.from("customer_complaints").select("id", { count: "exact", head: true }).is("deleted_at", null).not("status", "in", "(resolved,cancelled)").then((r) => r),
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
            supabase.from("quotations").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", s).then((r) => ({ s, count: r.count ?? 0 }))
          )
        );
        const map: Record<string, number> = {};
        statusResults.forEach((x) => { map[x.s] = x.count; });
        setStatusCounts(map);
      }

      // Upcoming deliveries (today → +2 days). Admin: all; staff: only their own
      if (user?.id && (isAdmin || isOfficeStaff || isMeasurementStaff)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in2 = new Date(today);
        in2.setDate(in2.getDate() + 2);
        const fromStr = today.toISOString().slice(0, 10);
        const toStr = in2.toISOString().slice(0, 10);
        let q = supabase
          .from("quotations")
          .select("id, quotation_id, party_name, party_place, expected_delivery_date, status, total, created_by")
          .is("deleted_at", null)
          .not("expected_delivery_date", "is", null)
          .gte("expected_delivery_date", fromStr)
          .lte("expected_delivery_date", toStr)
          .not("status", "in", "(delivered,rejected)")
          .order("expected_delivery_date", { ascending: true })
          .limit(50);
        if (!isAdmin) q = q.eq("created_by", user.id);
        const { data } = await q;
        setUpcoming((data ?? []) as UpcomingDelivery[]);
      }

      // Office staff: drafted quotations created by measurement staff
      // (i.e. those linked to a measurement task) — these need pricing.
      if (isOfficeStaff) {
        const { data } = await supabase
          .from("quotations")
          .select("id, quotation_id, party_name, party_place, created_at, created_by, source_task_id")
          .is("deleted_at", null)
          .eq("status", "drafted")
          .not("source_task_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(20);
        setAwaitingPricing((data ?? []) as AwaitingPricing[]);
      }
    };
    run();
  }, [user?.id, isMeasurementStaff, isOfficeStaff, isAdmin]);

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
    isOfficeStaff && { label: "Drafted quotations", value: stats.drafts, icon: Ruler, to: "/admin/quotations?status=drafted" },
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

      {upcoming.length > 0 && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
              <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Upcoming deliveries (next 2 days)
              <Badge variant="secondary" className="ml-1">{upcoming.length}</Badge>
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/quotations">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map((q) => {
              const d = new Date(q.expected_delivery_date + "T00:00:00");
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const days = Math.round((d.getTime() - today.getTime()) / 86400000);
              const dueLabel = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
              const dueTone = days <= 0
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : days === 1
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                : "bg-muted text-foreground border-border";
              return (
                <Link
                  key={q.id}
                  to={`/admin/quotations/${q.id}`}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-smooth hover:border-primary hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-foreground">{q.party_name}</span>
                      {q.party_place && (
                        <span className="truncate text-xs text-muted-foreground">· {q.party_place}</span>
                      )}
                      <Badge variant={statusBadgeVariant(q.status)} className="text-[10px]">
                        {statusLabel(q.status)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{q.quotation_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${dueTone}`}>
                      {dueLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {isOfficeStaff && awaitingPricing.length > 0 && (
        <Card className="mb-6 border-emerald-500/40 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Awaiting pricing
              <Badge variant="secondary" className="ml-1">{awaitingPricing.length}</Badge>
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/quotations?status=drafted">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Measurement staff submitted these — add prices, GST and finalize.</p>
            {awaitingPricing.slice(0, 5).map((q) => (
              <Link
                key={q.id}
                to={`/admin/quotations/${q.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 transition-smooth hover:border-primary hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{q.party_name}{q.party_place ? <span className="text-xs text-muted-foreground"> · {q.party_place}</span> : null}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{q.quotation_id}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Add prices</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

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
