import { useEffect, useMemo, useState } from "react";
// Route updated to support delivery-only role redirect
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, FolderTree, AlertTriangle, FileText, Ruler, HardHat, Users, Clock, Truck, LifeBuoy, Wrench, ShoppingBag, Map, Route, Boxes, CalendarClock, ArrowRight, Warehouse, Layers } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { statusBadgeVariant, statusLabel, normalizeStatus } from "./AdminQuotationEditor";
import { computeStage, type PipelineStage } from "@/lib/quotationPipeline";
import { PipelineStageGrid } from "@/components/overview/PipelineStageGrid";
import { FulfillmentSplitCard } from "@/components/overview/FulfillmentSplitCard";
import { TrendsRow } from "@/components/overview/TrendsRow";
import { HighlightCards, type UpcomingDelivery, type AwaitingPricing } from "@/components/overview/HighlightCards";
import { GroupedStatsSections, type StatCard, type StatGroup } from "@/components/overview/GroupedStatsSections";

const QUOTATION_STATUSES = ["drafted", "finalized", "delivered", "rejected"] as const;

const AdminOverview = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    products: 0, categories: 0, lowStock: 0,
    quotations: 0, drafts: 0, myTasks: 0, workers: 0,
    openServices: 0, openComplaints: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [upcoming, setUpcoming] = useState<UpcomingDelivery[]>([]);
  // Split the old "OPS: In-Progress" list — measurement-task drafts (true
  // "needs pricing") vs actual Stage-3 OPS quotations (finalized, no jobs yet).
  const [needsPricing, setNeedsPricing] = useState<AwaitingPricing[]>([]);
  const [opsStage3, setOpsStage3] = useState<AwaitingPricing[]>([]);
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

      // Office staff: two distinct lists previously crammed into one card.
      //  • Drafts needing pricing — measurement-task drafts that hit
      //    "Submit for pricing review" (status='drafted', submitted_for_pricing_at).
      //  • Stage 3 (OPS) — finalized quotations that haven't moved to
      //    Production yet. Counted accurately via pipelineCounts[3];
      //    here we just list the most recent finalized rows for the card.
      if (isOfficeStaff) {
        const [{ data: pricingRows }, { data: opsRows }] = await Promise.all([
          supabase
            .from("quotations")
            .select("id, quotation_id, party_name, party_place, party_phone, created_at, created_by")
            .is("deleted_at", null)
            .eq("status", "drafted")
            .not("submitted_for_pricing_at", "is", null)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("quotations")
            .select("id, quotation_id, party_name, party_place, party_phone, created_at, created_by")
            .is("deleted_at", null)
            .eq("status", "finalized")
            .order("updated_at", { ascending: false })
            .limit(10),
        ]);
        setNeedsPricing((pricingRows ?? []) as AwaitingPricing[]);
        setOpsStage3((opsRows ?? []) as AwaitingPricing[]);
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

  const salesCards: StatCard[] = [
    isMeasurementStaff && { label: "My pending tasks", value: stats.myTasks, icon: Clock, to: "/admin/measurement-tasks" },
    isOfficeStaff && { label: "Quotations", value: stats.quotations, icon: FileText, to: "/admin/quotations" },
    isOfficeStaff && { label: "Stage 1 · Client Hub", value: pipelineCounts[1], icon: Ruler, to: "/admin/quotations?status=stage1" },
    isOfficeStaff && { label: "Stage 3 · OPS", value: pipelineCounts[3], icon: FileText, to: "/admin/quotations?status=stage3" },
    isOfficeStaff && { label: "Stage 4 · Production", value: pipelineCounts[4], icon: HardHat, to: "/admin/quotations?status=stage4" },
    isOfficeStaff && { label: "Stage 5 · Warehouse", value: pipelineCounts[5], icon: Warehouse, to: "/admin/quotations?status=stage5" },
    isOfficeStaff && { label: "Partially Ready", value: fulfillment.quotsMixed, icon: Layers, to: "/admin/quotations" },
    isOfficeStaff && { label: "Open services", value: stats.openServices, icon: Wrench, to: "/admin/services?tab=service" },
    isOfficeStaff && { label: "Open complaints", value: stats.openComplaints, icon: AlertTriangle, to: "/admin/services?tab=complaint" },
    isAdmin && { label: "Production Unit", value: stats.workers, icon: HardHat, to: "/admin/workers" },
  ].filter(Boolean) as StatCard[];

  const logisticsCards: StatCard[] = isOfficeStaff
    ? [
        { label: "Stage 6 · Out for Delivery", value: pipelineCounts[6], icon: Truck, to: "/admin/quotations?status=stage6" },
        { label: "Logistics Mapping", value: pipelineCounts[6], icon: Map, to: "/admin/logistics" },
        // Trips / Route Manager — these are management screens, not metrics.
        // value=null renders an "Open" link button instead of a fake "0".
        { label: "Trips", value: null, icon: Truck, to: "/admin/trips" },
        ...(isAdmin ? [{ label: "Route Manager", value: null, icon: Route, to: "/admin/routes" }] : []),
      ]
    : [];

  const inventoryCards: StatCard[] = isAdmin
    ? [
        { label: "Products", value: stats.products, icon: Package, to: "/admin/products" },
        { label: "Categories", value: stats.categories, icon: FolderTree, to: "/admin/categories" },
        { label: "Low stock (≤5)", value: stats.lowStock, icon: AlertTriangle, to: "/admin/products" },
      ]
    : [];

  const groups: StatGroup[] = ([
    {
      key: "sales",
      title: "Sales & Services",
      subtitle: "6-stage pipeline counts, services and complaints",
      icon: ShoppingBag,
      accent: "emerald" as const,
      cards: salesCards,
    },
    {
      key: "logistics",
      title: "Logistics & Fleet",
      subtitle: "Stage 6 dispatch — Out for Delivery, trips and routes",
      icon: Truck,
      accent: "sky" as const,
      cards: logisticsCards,
    },
    {
      key: "inventory",
      title: "Inventory & Catalog",
      subtitle: "Products and categories",
      icon: Boxes,
      accent: "orange" as const,
      cards: inventoryCards,
    },
  ] satisfies StatGroup[]).filter((g) => g.cards.length > 0);

  return (
    <AdminShell>
      <div className="mb-6 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {isMeasurementStaff && !isOfficeStaff ? "Your assigned measurement tasks." : "Quick snapshot of your business."}
        </p>
      </div>

      {/* 2-Day Delivery Reminder — prominent banner so deliveries within
          the next 48 hours never get missed. Click jumps to the filtered list. */}
      {(isAdmin || isOfficeStaff) && upcoming.length > 0 && (
        <Link
          to="/admin/quotations?status=stage6"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-500/15 to-amber-500/5 p-4 shadow-sm transition-smooth hover:shadow-product"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
              <CalendarClock className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <p className="font-display text-base font-semibold text-amber-900 dark:text-amber-200">
                {upcoming.length} {upcoming.length === 1 ? "delivery" : "deliveries"} due within 2 days
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                {upcoming.slice(0, 3).map((u) => u.party_name).join(", ")}
                {upcoming.length > 3 ? ` +${upcoming.length - 3} more` : ""} — tap to review
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </Link>
      )}

      {/* Top Highlight Grids: Upcoming Deliveries + Drafts needing pricing + Stage 3 OPS */}
      {(isAdmin || isOfficeStaff || isMeasurementStaff) && (
        <HighlightCards
          upcoming={upcoming}
          needsPricing={needsPricing}
          opsStage3={opsStage3}
          stage3Count={pipelineCounts[3]}
          isOfficeStaff={isOfficeStaff}
        />
      )}

      {/* 6-Stage Pipeline: Client Hub → Dimensions → OPS → Production → Warehouse → Logistics */}
      {(isAdmin || isOfficeStaff) && <PipelineStageGrid pipelineCounts={pipelineCounts} />}

      {/* Trend sparklines — quotations & deliveries over the last N days */}
      {(isAdmin || isOfficeStaff) && (
        <TrendsRow trends={trends} trendDays={trendDays} setTrendDays={setTrendDays} />
      )}

      {/* Fulfillment Split — Ready Stock vs Custom Production (per item routing) */}
      {(isAdmin || isOfficeStaff) && <FulfillmentSplitCard fulfillment={fulfillment} />}

      <GroupedStatsSections groups={groups} />

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
