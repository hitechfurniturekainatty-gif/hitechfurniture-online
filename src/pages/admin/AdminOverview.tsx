import { useEffect, useMemo, useState } from "react";
// Route updated to support delivery-only role redirect
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FolderTree, AlertTriangle, FileText, Ruler, HardHat, Users, Clock, Truck, LifeBuoy, Wrench, ShoppingBag, Map, Route, Boxes, CalendarClock, CheckCircle2, Phone, MapPin, ArrowRight, Warehouse, Layers, Link2, Sparkles, TrendingUp } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { statusBadgeVariant, statusLabel, normalizeStatus } from "./AdminQuotationEditor";
import { computeStage, ALL_STAGES, STAGE_DEFS, stageToneClasses, type PipelineStage } from "@/lib/quotationPipeline";

const QUOTATION_STATUSES = ["drafted", "finalized", "delivered", "rejected"] as const;

type UpcomingDelivery = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string | null;
  party_phone: string | null;
  expected_delivery_date: string;
  status: string;
  total: number;
};

type AwaitingPricing = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string | null;
  party_phone: string | null;
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
  const [pipelineCounts, setPipelineCounts] = useState<Record<PipelineStage, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  // 30-day trend series for sparklines
  const [trendDays, setTrendDays] = useState(30);
  const [trends, setTrends] = useState<{
    quotByDay: number[];
    tripsByDay: number[];
    statusTotals: Record<string, number>;
    outForDelivery: number;
    tripsActive: number;
    tripsCompleted: number;
  }>({ quotByDay: [], tripsByDay: [], statusTotals: {}, outForDelivery: 0, tripsActive: 0, tripsCompleted: 0 });
  // Fulfillment split metrics (Ready Stock vs Custom Production)
  const [fulfillment, setFulfillment] = useState({
    quotsReadyOnly: 0,
    quotsCustomOnly: 0,
    quotsMixed: 0,
    itemsReadyInWarehouse: 0,
    itemsInProduction: 0,
    jobsInWarehouse: 0,
    jobsDispatched: 0,
  });

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
          .select("id, quotation_id, party_name, party_place, party_phone, expected_delivery_date, status, total, created_by")
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
          .select("id, quotation_id, party_name, party_place, party_phone, created_at, created_by, source_task_id")
          .is("deleted_at", null)
          .eq("status", "drafted")
          .not("submitted_for_pricing_at", "is", null)
          .order("created_at", { ascending: false })
          .limit(20);
        setAwaitingPricing((data ?? []) as AwaitingPricing[]);
      }

      // Pipeline summary (admin/office staff)
      if (isAdmin || isOfficeStaff) {
        const [qP, jP, tqP, itP] = await Promise.all([
          supabase.from("quotations").select("id, status, advance_amount, submitted_for_pricing_at, is_direct_order, source_task_id, document_type").is("deleted_at", null).eq("document_type", "quotation"),
          supabase.from("job_work_orders").select("quotation_id, status, warehouse_status").is("deleted_at", null),
          supabase.from("trip_quotations").select("quotation_id, delivered_at, trips:trip_id(status)") as any,
          supabase.from("quotation_items").select("quotation_id, fulfillment_route") as any,
        ]);
        const jobsByQ: Record<string, { total: number; done: number; warehouse: number; dispatched: number }> = {};
        ((jP.data ?? []) as any[]).forEach((j) => {
          if (!j.quotation_id) return;
          const cur = jobsByQ[j.quotation_id] ?? { total: 0, done: 0, warehouse: 0, dispatched: 0 };
          cur.total++;
          if (j.status === "completed" || j.status === "done") cur.done++;
          if (j.warehouse_status === "in_warehouse" || j.warehouse_status === "ready_to_pack" || j.warehouse_status === "ready_for_dispatch") cur.warehouse++;
          if (j.warehouse_status === "dispatched") cur.dispatched++;
          jobsByQ[j.quotation_id] = cur;
        });
        const tripsByQ: Record<string, { has: boolean; completed: boolean }> = {};
        ((tqP.data ?? []) as any[]).forEach((tq) => {
          const cur = tripsByQ[tq.quotation_id] ?? { has: false, completed: false };
          cur.has = true;
          if (tq.trips?.status === "completed" || tq.delivered_at) cur.completed = true;
          tripsByQ[tq.quotation_id] = cur;
        });
        const itemsByQ: Record<string, { total: number; ready: number; custom: number }> = {};
        ((itP.data ?? []) as any[]).forEach((it) => {
          const qid = it.quotation_id as string;
          if (!qid) return;
          const cur = itemsByQ[qid] ?? { total: 0, ready: 0, custom: 0 };
          cur.total += 1;
          if (it.fulfillment_route === "custom") cur.custom += 1;
          else cur.ready += 1;
          itemsByQ[qid] = cur;
        });
        const counts: Record<PipelineStage, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        let quotsReadyOnly = 0, quotsCustomOnly = 0, quotsMixed = 0;
        let itemsReadyInWarehouse = 0, itemsInProduction = 0;
        let jobsInWarehouse = 0, jobsDispatched = 0;
        Object.values(jobsByQ).forEach((j) => {
          jobsInWarehouse += j.warehouse;
          jobsDispatched += j.dispatched;
        });
        ((qP.data ?? []) as any[]).forEach((q) => {
          const j = jobsByQ[q.id];
          const t = tripsByQ[q.id];
          const info = computeStage({
            status: q.status,
            advance_amount: q.advance_amount,
            submitted_for_pricing_at: q.submitted_for_pricing_at,
            is_direct_order: q.is_direct_order,
            source_task_id: q.source_task_id,
            jobs_total: j?.total ?? 0,
            jobs_completed: j?.done ?? 0,
            jobs_in_warehouse: j?.warehouse ?? 0,
            jobs_dispatched: j?.dispatched ?? 0,
            has_trip: t?.has ?? false,
            trip_completed: t?.completed ?? false,
            items_total: itemsByQ[q.id]?.total ?? 0,
            items_ready_stock: itemsByQ[q.id]?.ready ?? 0,
            items_custom: itemsByQ[q.id]?.custom ?? 0,
          });
          counts[info.stage]++;
          const it = itemsByQ[q.id];
          if (it && it.total > 0) {
            if (it.ready > 0 && it.custom === 0) quotsReadyOnly++;
            else if (it.custom > 0 && it.ready === 0) quotsCustomOnly++;
            else if (it.ready > 0 && it.custom > 0) quotsMixed++;
            // Items "ready in warehouse" count only when the quotation has
            // reached at least Stage 5 (Warehouse) — before that they're
            // still being prepped in OPS.
            if (info.stage >= 5) itemsReadyInWarehouse += it.ready;
            // Custom items are "in production" while their quotation is in
            // Production (Stage 4) and not yet handed off.
            if (info.stage === 4) itemsInProduction += it.custom;
          }
        });
        setPipelineCounts(counts);
        setFulfillment({ quotsReadyOnly, quotsCustomOnly, quotsMixed, itemsReadyInWarehouse, itemsInProduction, jobsInWarehouse, jobsDispatched });
      }

      // Trend series — last `trendDays` days for quotations created and trips planned.
      if (isAdmin || isOfficeStaff) {
        const days = trendDays;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));
        const startIso = start.toISOString();
        const startDate = startIso.slice(0, 10);
        const [qT, tT] = await Promise.all([
          supabase.from("quotations").select("created_at, status").is("deleted_at", null).gte("created_at", startIso),
          supabase.from("trips").select("trip_date, status").is("deleted_at", null).gte("trip_date", startDate),
        ]);
        const quotByDay = new Array(days).fill(0);
        const tripsByDay = new Array(days).fill(0);
        const statusTotals: Record<string, number> = {};
        const dayIndex = (iso: string) => {
          const d = new Date(iso); d.setHours(0, 0, 0, 0);
          return Math.floor((d.getTime() - start.getTime()) / 86400000);
        };
        ((qT.data ?? []) as any[]).forEach((q) => {
          const i = dayIndex(q.created_at);
          if (i >= 0 && i < days) quotByDay[i]++;
          const s = normalizeStatus(q.status || "drafted");
          statusTotals[s] = (statusTotals[s] ?? 0) + 1;
        });
        let outForDelivery = 0, tripsActive = 0, tripsCompleted = 0;
        ((tT.data ?? []) as any[]).forEach((t) => {
          const i = dayIndex(t.trip_date);
          if (i >= 0 && i < days) tripsByDay[i]++;
          if (t.status === "completed") tripsCompleted++;
          else if (t.status === "in_progress") { outForDelivery++; tripsActive++; }
          else if (t.status === "planned") tripsActive++;
        });
        setTrends({ quotByDay, tripsByDay, statusTotals, outForDelivery, tripsActive, tripsCompleted });
      }
    };
    run();
  }, [user?.id, isMeasurementStaff, isOfficeStaff, isAdmin, trendDays]);

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
    isOfficeStaff && { label: "Stage 1 · Client Hub", value: pipelineCounts[1], icon: Ruler, to: "/admin/pipeline" },
    isOfficeStaff && { label: "Stage 3 · OPS", value: pipelineCounts[3], icon: FileText, to: "/admin/quotations?status=stage3" },
    isOfficeStaff && { label: "Stage 4 · Production", value: pipelineCounts[4], icon: HardHat, to: "/admin/pipeline" },
    isOfficeStaff && { label: "Stage 5 · Warehouse", value: pipelineCounts[5], icon: Warehouse, to: "/admin/pipeline" },
    isOfficeStaff && { label: "Partially Ready", value: fulfillment.quotsMixed, icon: Layers, to: "/admin/quotations" },
    isOfficeStaff && { label: "Open services", value: stats.openServices, icon: Wrench, to: "/admin/services?tab=service" },
    isOfficeStaff && { label: "Open complaints", value: stats.openComplaints, icon: AlertTriangle, to: "/admin/services?tab=complaint" },
    isAdmin && { label: "Production Unit", value: stats.workers, icon: HardHat, to: "/admin/workers" },
  ].filter(Boolean) as StatCard[];

  const logisticsCards: StatCard[] = isOfficeStaff
    ? [
        { label: "Stage 6 · Out for Delivery", value: pipelineCounts[6], icon: Truck, to: "/admin/logistics" },
        { label: "Logistics Mapping", value: pipelineCounts[6], icon: Map, to: "/admin/logistics" },
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
      subtitle: "6-stage pipeline counts, services and complaints",
      icon: ShoppingBag,
      // Green / success theme
      accent: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
      cards: salesCards,
    },
    {
      key: "logistics",
      title: "Logistics & Fleet",
      subtitle: "Stage 6 dispatch — Out for Delivery, trips and routes",
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

      {/* Top Highlight Grids: Upcoming Deliveries + In-Progress Quotations */}
      {(isAdmin || isOfficeStaff || isMeasurementStaff) && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Upcoming Deliveries */}
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
                <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Upcoming Deliveries
                <Badge variant="secondary" className="ml-1">{upcoming.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
                  No deliveries scheduled in the next 2 days.
                </p>
              ) : (
                upcoming.slice(0, 5).map((q) => (
                  <Link
                    key={q.id}
                    to={`/admin/quotations/${q.id}`}
                    className="block rounded-lg border bg-card p-3 transition-smooth hover:border-primary hover:shadow-sm"
                  >
                    <p className="truncate font-medium text-foreground">{q.party_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {q.party_phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{q.party_phone}</span>
                      )}
                      {q.party_place && (
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{q.party_place}</span>
                      )}
                    </div>
                  </Link>
                ))
              )}
              <Button asChild variant="outline" size="sm" className="mt-1 w-full">
                <Link to="/admin/quotations">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>

          {/* OPS: In-Progress (renamed from Awaiting Pricing) */}
          {isOfficeStaff && (
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  OPS: In-Progress
                  <Badge variant="secondary" className="ml-1">{awaitingPricing.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {awaitingPricing.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
                    No quotations in OPS right now.
                  </p>
                ) : (
                  awaitingPricing.slice(0, 5).map((q) => (
                    <Link
                      key={q.id}
                      to={`/admin/quotations/${q.id}`}
                      className="block rounded-lg border bg-card p-3 transition-smooth hover:border-primary hover:shadow-sm"
                    >
                      <p className="truncate font-medium text-foreground">{q.party_name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {q.party_phone && (
                          <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{q.party_phone}</span>
                        )}
                        {q.party_place && (
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{q.party_place}</span>
                        )}
                      </div>
                    </Link>
                  ))
                )}
                <Button asChild variant="outline" size="sm" className="mt-1 w-full">
                  <Link to="/admin/quotations?status=stage3">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 6-Stage Pipeline: Client Hub → Dimensions → OPS → Production → Warehouse → Logistics */}
      {(isAdmin || isOfficeStaff) && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="font-display text-lg sm:text-xl">Quotations by Status</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Live counts across the new 6-stage automated pipeline.</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/pipeline">Open monitor</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {ALL_STAGES.map((s) => {
                const def = STAGE_DEFS[s];
                return (
                  <Link
                    key={s}
                    to={`/admin/pipeline`}
                    className={`group relative block rounded-xl border p-3 transition-smooth hover:shadow-product ${stageToneClasses(def.tone)}`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Stage {s}</p>
                    <p className="font-display text-2xl font-semibold">{pipelineCounts[s]}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold">{def.label}</p>
                    <p className="text-[10px] opacity-70">{def.owner}</p>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend sparklines — quotations & deliveries over the last N days */}
      {(isAdmin || isOfficeStaff) && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Quotations Trend
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">New quotations created per day · last {trendDays} days</p>
              </div>
              <RangeToggle value={trendDays} onChange={setTrendDays} />
            </CardHeader>
            <CardContent>
              <Sparkline data={trends.quotByDay} stroke="hsl(var(--primary))" height={64} />
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                {Object.entries(trends.statusTotals)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([s, n]) => (
                    <Badge key={s} variant={statusBadgeVariant(s)} className="capitalize">
                      {statusLabel(s)} · {n}
                    </Badge>
                  ))}
                {Object.keys(trends.statusTotals).length === 0 && (
                  <span className="text-muted-foreground">No quotations in this window.</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
                  <Truck className="h-4 w-4 text-sky-600" />
                  Deliveries Trend
                </CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">Trips planned per day · last {trendDays} days</p>
              </div>
              <RangeToggle value={trendDays} onChange={setTrendDays} />
            </CardHeader>
            <CardContent>
              <Sparkline data={trends.tripsByDay} stroke="hsl(var(--sky, 199 89% 48%))" fallbackStroke="#0284c7" height={64} />
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">Out for Delivery · {trends.outForDelivery}</Badge>
                <Badge variant="secondary" className="bg-sky-100 text-sky-800">Active trips · {trends.tripsActive}</Badge>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Completed · {trends.tripsCompleted}</Badge>
                <Link to="/admin/trips" className="ml-auto inline-flex items-center text-[11px] font-medium text-primary hover:underline">
                  Open trips <ArrowRight className="ml-0.5 h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fulfillment Split — Ready Stock vs Custom Production (per item routing) */}
      {(isAdmin || isOfficeStaff) && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
                <Layers className="h-5 w-5 text-primary" />
                Fulfillment Split
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Per-item routing — Ready Stock items skip production and go straight to Warehouse.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Ready Stock only</p>
                <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.quotsReadyOnly}</p>
                <p className="text-[10px] text-muted-foreground">Quotations</p>
              </div>
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">Custom only</p>
                <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.quotsCustomOnly}</p>
                <p className="text-[10px] text-muted-foreground">Quotations</p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Partially Ready</p>
                <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.quotsMixed}</p>
                <p className="text-[10px] text-muted-foreground">Mixed quotations</p>
              </div>
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  <Warehouse className="h-3 w-3" /> In Warehouse
                </p>
                <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.itemsReadyInWarehouse + fulfillment.jobsInWarehouse}</p>
                <p className="text-[10px] text-muted-foreground">Items ready to pack</p>
              </div>
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                  <HardHat className="h-3 w-3" /> In Production
                </p>
                <p className="font-display text-2xl font-semibold text-foreground">{fulfillment.itemsInProduction}</p>
                <p className="text-[10px] text-muted-foreground">Custom items being built</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* What's New — recent platform updates so admins can quickly see / try them */}
      {isAdmin && (
        <Card className="mb-6 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-display text-lg sm:text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              What's new
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Latest improvements live in your workspace — May 2026.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Link2 className="h-4 w-4 text-emerald-600" />
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">NEW</span>
                </div>
                <p className="text-sm font-semibold">Live Mobile Share Link</p>
                <p className="mt-0.5 text-xs text-muted-foreground">A 3rd export option next to JPG / PDF — pinch-zoom URL that auto-updates with every edit, WhatsApp-ready.</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Warehouse className="h-4 w-4 text-amber-600" />
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">NEW</span>
                </div>
                <p className="text-sm font-semibold">Per-Item Ready Stock vs Custom</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Toggle each line item — Ready Stock skips Production and goes straight to Warehouse. Mixed orders show "Partially Ready".</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">NEW</span>
                </div>
                <p className="text-sm font-semibold">6-Stage Automated Pipeline</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Client Hub → Dimensions → OPS → Production → Warehouse → Logistics. Files move automatically as work progresses.</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Users className="h-4 w-4 text-sky-600" />
                  <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">NEW</span>
                </div>
                <p className="text-sm font-semibold">Role-Based Dashboards & Guide</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Office, Measurement, Production Unit and Delivery each land on a tailored screen — and the User Guide now shows only their relevant chapters.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/pipeline">Open Pipeline Monitor <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin/quotations">Try per-item routing <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/guide">Read the guide <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
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
            <Button asChild variant="outline"><Link to="/admin/measurement-tasks"><Ruler className="mr-2 h-4 w-4" />Assign Dimensions</Link></Button>
            {isAdmin && <Button asChild variant="outline"><Link to="/admin/workers"><HardHat className="mr-2 h-4 w-4" />Manage Production</Link></Button>}
            {isAdmin && <Button asChild variant="outline"><Link to="/admin/staff"><Users className="mr-2 h-4 w-4" />Staff management</Link></Button>}
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
};

export default AdminOverview;

// ---------- Lightweight chart helpers (no extra deps) ----------

const Sparkline = ({ data, stroke = "hsl(var(--primary))", fallbackStroke, height = 56 }: { data: number[]; stroke?: string; fallbackStroke?: string; height?: number }) => {
  if (!data || data.length === 0) {
    return <div className="flex h-14 items-center justify-center text-xs text-muted-foreground">No data yet.</div>;
  }
  const w = 600; // viewBox width — scales to container
  const h = 100;
  const max = Math.max(1, ...data);
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${(h - (v / max) * (h - 8) - 2).toFixed(1)}`);
  const path = `M ${points.join(" L ")}`;
  const area = `${path} L ${(w).toFixed(1)},${h} L 0,${h} Z`;
  const lastIdx = data.length - 1;
  const lastX = lastIdx * stepX;
  const lastY = h - (data[lastIdx] / max) * (h - 8) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" stroke="none" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={fallbackStroke ? { stroke: fallbackStroke } : undefined} />
      <circle cx={lastX} cy={lastY} r={3.5} fill={fallbackStroke || stroke} />
    </svg>
  );
};

const RangeToggle = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="inline-flex items-center rounded-md border bg-card p-0.5 text-[11px]">
    {[7, 14, 30].map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => onChange(d)}
        className={`rounded px-2 py-0.5 font-medium transition-colors ${value === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        {d}d
      </button>
    ))}
  </div>
);
