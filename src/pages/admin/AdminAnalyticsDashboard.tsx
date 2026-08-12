import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, IndianRupee, FileClock, PackageX, HardHat, ArrowRight } from "lucide-react";
import { formatINR, formatINRNumber } from "@/lib/brand";
import { KpiCard } from "@/components/overview/KpiCard";
import { AnomalyBadges, type Anomaly } from "@/components/overview/AnomalyBadge";
import { RevenueTrendChart, type MonthRevenue } from "@/components/overview/charts/RevenueTrendChart";
import { PipelineStageMonthlyBarChart, type MonthlyStageRow } from "@/components/overview/charts/PipelineStageMonthlyBarChart";
import { StatusDonut, type DonutSlice } from "@/components/overview/charts/StatusDonut";
import { computeStage, stageToneHex, ALL_STAGES, STAGE_DEFS, type PipelineStage } from "@/lib/quotationPipeline";
import { statusLabel } from "./AdminQuotationEditor";
import { isJobFinished, jobStatusLabel, jobStatusHex } from "./AdminWorkerDetail";

// Revenue counts finalized-or-further quotations (drafts and rejections
// aren't real sales yet).
const REVENUE_EXCLUDED_STATUSES = new Set(["drafted", "rejected"]);
// Fixed order + color for quotation status, reused everywhere a status
// donut appears — never cycled, never color-only.
const STATUS_COLORS: Record<string, string> = {
  drafted: "#64748b",
  finalized: "#0ea5e9",
  delivered: "#10b981",
  rejected: "#f43f5e",
};
const STATUS_ORDER = ["drafted", "finalized", "delivered", "rejected"];

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

type TopProduct = { product_id: string; name: string; code: string; units: number; revenue: number };

const AdminAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [revenueDeltaPercent, setRevenueDeltaPercent] = useState<number | null>(null);
  const [pendingQuotations, setPendingQuotations] = useState(0);
  const [skusTracked, setSkusTracked] = useState(0);
  const [lowStockSkus, setLowStockSkus] = useState(0);
  const [ordersInProduction, setOrdersInProduction] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState<MonthRevenue[]>([]);
  const [stageMonthly, setStageMonthly] = useState<MonthlyStageRow[]>([]);
  const [statusDonut, setStatusDonut] = useState<DonutSlice[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [pendingByStage, setPendingByStage] = useState<DonutSlice[]>([]);
  const [productionByStatus, setProductionByStatus] = useState<DonutSlice[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      { data: quotRows },
      { count: variantStockCount },
      { data: jobRows },
      { data: pnRows },
      { data: itemRows },
      { data: statusHistRows },
      { data: tqRows },
      { data: stageItemRows },
    ] = await Promise.all([
      supabase
        .from("quotations")
        .select("id, status, total, created_at, advance_amount, submitted_for_pricing_at, is_direct_order, source_task_id")
        .is("deleted_at", null)
        .gte("created_at", sixMonthsAgo.toISOString()),
      supabase.from("product_variant_stock").select("id", { count: "exact", head: true }),
      supabase.from("job_work_orders").select("status, quotation_id, warehouse_status").is("deleted_at", null),
      supabase
        .from("pipeline_notifications")
        .select("stage, created_at")
        .gte("created_at", sixMonthsAgo.toISOString()),
      // quotation_items has the actual sales data (qty x price). The old
      // spec pointed at product_price_history for "top products by sales",
      // but that table only tracks cost/selling-price *changes* over time —
      // no quantity, no link to what actually sold. quotation_items is the
      // real sales ledger.
      supabase.from("quotation_items").select("product_id, quantity, amount").not("product_id", "is", null),
      supabase.from("quotation_status_history").select("quotation_id, status, changed_at").order("changed_at", { ascending: false }),
      // Trip + item data (below) is only for the "pending quotations by
      // stage" breakdown chart — mirrors the same computeStage() aggregation
      // Office/Production already use, added fresh here since Admin's own
      // quotation_items query above deliberately excludes custom (no
      // product_id) items and can't double as stage input.
      supabase.from("trip_quotations").select("quotation_id, delivered_at, trips:trip_id(status)") as any,
      supabase.from("quotation_items").select("quotation_id, fulfillment_route") as any,
    ]);

    // ---- Same job/trip/item aggregation computeStage() needs, as used
    // throughout the rest of the admin app (AdminOverview, AdminPipelineMonitor,
    // Office/Production dashboards) — powers the "pending quotations by
    // stage" breakdown below. ----
    const jobsByQ: Record<string, { total: number; done: number; warehouse: number; dispatched: number }> = {};
    (jobRows ?? []).forEach((j: any) => {
      if (!j.quotation_id) return;
      const cur = jobsByQ[j.quotation_id] ?? { total: 0, done: 0, warehouse: 0, dispatched: 0 };
      cur.total += 1;
      if (j.status === "ready" || j.status === "delivered") cur.done += 1;
      if (j.warehouse_status === "in_warehouse" || j.warehouse_status === "ready_to_pack" || j.warehouse_status === "ready_for_dispatch") cur.warehouse += 1;
      if (j.warehouse_status === "dispatched") cur.dispatched += 1;
      jobsByQ[j.quotation_id] = cur;
    });
    const tripsByQ: Record<string, { has: boolean; completed: boolean }> = {};
    (tqRows ?? []).forEach((tq: any) => {
      const cur = tripsByQ[tq.quotation_id] ?? { has: false, completed: false };
      cur.has = true;
      if (tq.trips?.status === "delivered" || tq.delivered_at) cur.completed = true;
      tripsByQ[tq.quotation_id] = cur;
    });
    const itemsByQ: Record<string, { total: number; ready: number; custom: number }> = {};
    (stageItemRows ?? []).forEach((it: any) => {
      const qid = it.quotation_id as string;
      if (!qid) return;
      const cur = itemsByQ[qid] ?? { total: 0, ready: 0, custom: 0 };
      cur.total += 1;
      if (it.fulfillment_route === "custom") cur.custom += 1;
      else cur.ready += 1;
      itemsByQ[qid] = cur;
    });
    const staged = ((quotRows ?? []) as any[]).map((q) => {
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
      return { ...q, stage: info.stage as PipelineStage };
    });

    // ---- Revenue this month / last month ----
    const thisMonthKey = monthKey(now);
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = monthKey(lastMonthDate);
    const revenueByMonth: Record<string, number> = {};
    (quotRows ?? []).forEach((q: any) => {
      if (REVENUE_EXCLUDED_STATUSES.has(q.status)) return;
      const k = monthKey(new Date(q.created_at));
      revenueByMonth[k] = (revenueByMonth[k] ?? 0) + (Number(q.total) || 0);
    });
    const thisMonthRevenue = revenueByMonth[thisMonthKey] ?? 0;
    const lastMonthRevenue = revenueByMonth[lastMonthKey] ?? 0;
    setRevenueThisMonth(thisMonthRevenue);
    setRevenueDeltaPercent(lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : null);

    // 6-month trend, oldest -> newest, always showing every month even if 0.
    const trend: MonthRevenue[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({ month: monthLabel(d), revenue: revenueByMonth[monthKey(d)] ?? 0 });
    }
    setRevenueTrend(trend);
    const trendLastMonthValue = trend[trend.length - 1]?.revenue ?? 0;
    if (trendLastMonthValue !== thisMonthRevenue) {
      console.warn(`AdminAnalyticsDashboard: revenue KPI (${thisMonthRevenue}) != trend chart's last point (${trendLastMonthValue})`);
    }

    // ---- Pending quotations: anything not yet delivered or rejected ----
    const pendingQ = staged.filter((q) => q.status !== "delivered" && q.status !== "rejected");
    setPendingQuotations(pendingQ.length);

    // ---- Pending quotations by stage — reuses the `staged` aggregation
    // above, no extra query beyond the trip/item fetches. ----
    const pendingStageCounts: Record<number, number> = {};
    pendingQ.forEach((q) => { pendingStageCounts[q.stage] = (pendingStageCounts[q.stage] ?? 0) + 1; });
    setPendingByStage(
      Object.entries(pendingStageCounts).map(([stage, count]) => ({
        name: STAGE_DEFS[Number(stage) as PipelineStage].label,
        value: count,
        color: stageToneHex(STAGE_DEFS[Number(stage) as PipelineStage].tone),
      })),
    );

    // ---- Order status donut (all quotations in the fetched window) ----
    const statusCounts: Record<string, number> = {};
    (quotRows ?? []).forEach((q: any) => { statusCounts[q.status] = (statusCounts[q.status] ?? 0) + 1; });
    const donutData = STATUS_ORDER.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => ({
      name: statusLabel(s),
      value: statusCounts[s],
      color: STATUS_COLORS[s],
    }));
    setStatusDonut(donutData);
    const donutSum = donutData.reduce((s, d) => s + d.value, 0);
    const activeTotal = (quotRows ?? []).length;
    if (donutSum !== activeTotal) {
      console.warn(`AdminAnalyticsDashboard: order-status donut sum (${donutSum}) != quotation count (${activeTotal})`);
    }

    // ---- Stock (product_variant_stock is currently unpopulated storewide —
    // report that honestly instead of a fabricated "0 low stock" claim).
    // No breakdown chart here: with tracking empty there are no categories
    // to split by yet, so a chart would just be a styled zero. ----
    setSkusTracked(variantStockCount ?? 0);
    setLowStockSkus(0);

    // ---- Orders in production ----
    const openJobRows = (jobRows ?? []).filter((j: any) => !isJobFinished(j.status));
    setOrdersInProduction(openJobRows.length);

    // ---- Orders in production, by job status — reuses the same jobRows
    // fetch above, no extra query. ----
    const jobStatusCounts: Record<string, number> = {};
    openJobRows.forEach((j: any) => { jobStatusCounts[j.status] = (jobStatusCounts[j.status] ?? 0) + 1; });
    setProductionByStatus(
      Object.entries(jobStatusCounts).map(([status, count]) => ({
        name: jobStatusLabel(status),
        value: count,
        color: jobStatusHex(status),
      })),
    );

    // ---- Pipeline stage activity per month (pipeline_notifications) ----
    const stageByMonth: Record<string, Record<number, number>> = {};
    (pnRows ?? []).forEach((r: any) => {
      if (!r.stage) return;
      const k = monthKey(new Date(r.created_at));
      stageByMonth[k] = stageByMonth[k] ?? {};
      stageByMonth[k][r.stage] = (stageByMonth[k][r.stage] ?? 0) + 1;
    });
    const stageRows: MonthlyStageRow[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const row: MonthlyStageRow = { month: monthLabel(d) };
      ALL_STAGES.forEach((s) => { row[`stage${s}`] = stageByMonth[monthKey(d)]?.[s] ?? 0; });
      stageRows.push(row);
    }
    setStageMonthly(stageRows);

    // ---- Top 10 products by sales (quotation_items, cost_price never selected) ----
    const byProduct: Record<string, { units: number; revenue: number }> = {};
    (itemRows ?? []).forEach((it: any) => {
      const cur = byProduct[it.product_id] ?? { units: 0, revenue: 0 };
      cur.units += Number(it.quantity) || 0;
      cur.revenue += Number(it.amount) || 0;
      byProduct[it.product_id] = cur;
    });
    const topIds = Object.entries(byProduct).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).map(([id]) => id);
    let top: TopProduct[] = [];
    if (topIds.length) {
      const { data: prodRows } = await (supabase as any)
        .from("products_safe_search")
        .select("id, product_name, product_code")
        .in("id", topIds);
      const byId = new Map((prodRows ?? []).map((p: any) => [p.id, p]));
      top = topIds
        .map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          return { product_id: id, name: p.product_name, code: p.product_code, units: byProduct[id].units, revenue: byProduct[id].revenue };
        })
        .filter(Boolean) as TopProduct[];
    }
    setTopProducts(top);

    // ---- Anomalies ----
    const nextAnomalies: Anomaly[] = [];
    if (revenueDeltaPercentIsDrop(lastMonthRevenue, thisMonthRevenue)) {
      nextAnomalies.push({
        key: "revenue-drop",
        severity: "critical",
        message: `Revenue down ${Math.abs(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(0)}% vs last month`,
      });
    }
    const activeQuotationIds = new Set(
      (quotRows ?? []).filter((q: any) => q.status !== "delivered" && q.status !== "rejected").map((q: any) => q.id),
    );
    const latestChangeByQuotation = new Map<string, string>();
    (statusHistRows ?? []).forEach((r: any) => {
      if (!latestChangeByQuotation.has(r.quotation_id)) latestChangeByQuotation.set(r.quotation_id, r.changed_at);
    });
    const sevenDaysAgo = Date.now() - 7 * 86400_000;
    let stuckCount = 0;
    activeQuotationIds.forEach((id) => {
      const latest = latestChangeByQuotation.get(id as string);
      if (latest && new Date(latest).getTime() < sevenDaysAgo) stuckCount++;
    });
    if (stuckCount > 0) {
      nextAnomalies.push({
        key: "stuck-stage",
        severity: "warning",
        message: `${stuckCount} quotation${stuckCount === 1 ? "" : "s"} stuck >7 days in the same stage`,
        to: "/admin/pipeline",
      });
    }
    setAnomalies(nextAnomalies);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl sm:text-2xl">Admin Analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Revenue, pipeline activity and anomalies — live from Supabase.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Refresh</>}
        </Button>
      </div>

      {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <AnomalyBadges anomalies={anomalies} />

            {/* KPI row */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                label="Revenue this month"
                value={formatINR(revenueThisMonth)}
                icon={IndianRupee}
                deltaPercent={revenueDeltaPercent}
                deltaCaption={revenueDeltaPercent === null ? "No revenue last month to compare" : "vs last month"}
              />
              <KpiCard label="Pending quotations" value={String(pendingQuotations)} icon={FileClock} to="/admin/quotations" />
              <KpiCard
                label="Low-stock SKUs"
                value={String(lowStockSkus)}
                icon={PackageX}
                sub={skusTracked === 0 ? "Stock tracking not yet populated" : `${skusTracked} SKUs tracked`}
              />
              <KpiCard label="Orders in production" value={String(ordersInProduction)} icon={HardHat} to="/admin/production" />
            </div>

            {/* Breakdown donuts — pending quotations by pipeline stage, and
                orders in production by job status */}
            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base sm:text-lg">Pending Quotations by Stage</CardTitle>
                  <p className="text-xs text-muted-foreground">Not yet delivered or rejected</p>
                </CardHeader>
                <CardContent>
                  {pendingQuotations === 0 ? (
                    <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">No pending quotations</div>
                  ) : (
                    <StatusDonut data={pendingByStage} />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base sm:text-lg">Orders in Production by Status</CardTitle>
                  <p className="text-xs text-muted-foreground">Open job work orders, by current stage</p>
                </CardHeader>
                <CardContent>
                  {ordersInProduction === 0 ? (
                    <div className="flex h-36 items-center justify-center text-xs text-muted-foreground">No open production jobs</div>
                  ) : (
                    <StatusDonut data={productionByStatus} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Chart grid */}
            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base sm:text-lg">Revenue Trend</CardTitle>
                  <p className="text-xs text-muted-foreground">Finalized+ quotations, by month · last 6 months</p>
                </CardHeader>
                <CardContent><RevenueTrendChart data={revenueTrend} /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base sm:text-lg">Order Status Split</CardTitle>
                  <p className="text-xs text-muted-foreground">All quotations in the last 6 months</p>
                </CardHeader>
                <CardContent><StatusDonut data={statusDonut} /></CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base sm:text-lg">Pipeline Stage Activity</CardTitle>
                  <p className="text-xs text-muted-foreground">Stage-entry notifications per month, by stage · last 6 months</p>
                </CardHeader>
                <CardContent><PipelineStageMonthlyBarChart data={stageMonthly} /></CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="font-display text-lg">Top 10 Products by Sales</CardTitle>
                <Button asChild variant="ghost" size="sm"><Link to="/admin/products">All products <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No product-linked sales yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-left">#</th>
                          <th className="px-2 py-2 text-left">Product</th>
                          <th className="px-2 py-2 text-right">Units sold</th>
                          <th className="px-2 py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topProducts.map((p, i) => (
                          <tr key={p.product_id} className="border-t border-border/60">
                            <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-2 py-2">
                              <Link to={`/product/${p.product_id}`} className="font-medium hover:text-primary" target="_blank" rel="noreferrer">
                                {p.name}
                              </Link>
                              <p className="font-mono text-[11px] text-muted-foreground">{p.code}</p>
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">{formatINRNumber(p.units)}</td>
                            <td className="px-2 py-2 text-right font-mono font-semibold text-primary">{formatINR(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
    </section>
  );
};

const revenueDeltaPercentIsDrop = (lastMonth: number, thisMonth: number) =>
  lastMonth > 0 && ((thisMonth - lastMonth) / lastMonth) * 100 <= -20;

export default AdminAnalyticsDashboard;
