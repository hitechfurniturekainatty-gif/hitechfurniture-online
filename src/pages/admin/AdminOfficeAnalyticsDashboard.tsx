import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Ruler, Clock, LifeBuoy, Paperclip, ArrowRight } from "lucide-react";
import { KpiCard } from "@/components/overview/KpiCard";
import { AnomalyBadges, type Anomaly } from "@/components/overview/AnomalyBadge";
import { DailyLineChart } from "@/components/overview/charts/DailyLineChart";
import { StatusDonut, type DonutSlice } from "@/components/overview/charts/StatusDonut";
import { computeStage, stageToneClasses, stageToneHex, STAGE_DEFS, type PipelineStage } from "@/lib/quotationPipeline";

type Q = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  status: string;
  total: number;
  advance_amount: number | null;
  submitted_for_pricing_at: string | null;
  is_direct_order: boolean | null;
  source_task_id: string | null;
  created_at: string;
};

type PendingRow = Q & { stage: PipelineStage; ageDays: number; noteCount: number };

const AdminOfficeAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stage1Count, setStage1Count] = useState(0);
  const [avgTimeInStageDays, setAvgTimeInStageDays] = useState<number | null>(null);
  const [unresolvedComplaints, setUnresolvedComplaints] = useState(0);
  const [enquiryTrend, setEnquiryTrend] = useState<number[]>([]);
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [pendingByStage, setPendingByStage] = useState<DonutSlice[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const load = async () => {
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const [
      { data: quotRows },
      { data: jobRows },
      { data: tqRows },
      { data: itemRows },
      { data: statusHistRows },
      { count: complaintsCount },
      { data: waRows },
      { data: followupRows },
    ] = await Promise.all([
      supabase
        .from("quotations")
        .select("id, quotation_id, party_name, party_place, status, total, advance_amount, submitted_for_pricing_at, is_direct_order, source_task_id, created_at")
        .is("deleted_at", null)
        .eq("document_type", "quotation")
        .order("created_at", { ascending: true }),
      supabase.from("job_work_orders").select("quotation_id, status, warehouse_status").is("deleted_at", null),
      supabase.from("trip_quotations").select("quotation_id, delivered_at, trips:trip_id(status)") as any,
      supabase.from("quotation_items").select("quotation_id, fulfillment_route") as any,
      supabase.from("quotation_status_history").select("quotation_id, status, changed_at").order("changed_at", { ascending: true }),
      supabase.from("customer_complaints").select("id", { count: "exact", head: true }).is("deleted_at", null).not("status", "in", "(resolved,cancelled)"),
      (supabase as any).from("whatsapp_inbound_log").select("phone, created_at").gte("created_at", thirtyDaysAgo.toISOString()),
      (supabase as any).from("whatsapp_followups_sent").select("phone, last_inbound_at, sent_at"),
    ]);

    // ---- Same job/trip/item aggregation computeStage() needs, as used
    // throughout the rest of the admin app (AdminOverview, AdminPipelineMonitor). ----
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
    (itemRows ?? []).forEach((it: any) => {
      const qid = it.quotation_id as string;
      if (!qid) return;
      const cur = itemsByQ[qid] ?? { total: 0, ready: 0, custom: 0 };
      cur.total += 1;
      if (it.fulfillment_route === "custom") cur.custom += 1;
      else cur.ready += 1;
      itemsByQ[qid] = cur;
    });

    const staged = ((quotRows ?? []) as Q[]).map((q) => {
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
      return { ...q, stage: info.stage };
    });

    setStage1Count(staged.filter((q) => q.stage === 1).length);

    // ---- Average time-in-stage: gap between consecutive status_history
    // rows for the same quotation is time spent in the earlier status. ----
    const byQuotation: Record<string, { status: string; changed_at: string }[]> = {};
    (statusHistRows ?? []).forEach((r: any) => {
      (byQuotation[r.quotation_id] ??= []).push({ status: r.status, changed_at: r.changed_at });
    });
    const gapsDays: number[] = [];
    Object.values(byQuotation).forEach((rows) => {
      for (let i = 0; i < rows.length - 1; i++) {
        const ms = new Date(rows[i + 1].changed_at).getTime() - new Date(rows[i].changed_at).getTime();
        if (ms > 0) gapsDays.push(ms / 86400_000);
      }
    });
    setAvgTimeInStageDays(gapsDays.length ? gapsDays.reduce((a, b) => a + b, 0) / gapsDays.length : null);

    setUnresolvedComplaints(complaintsCount ?? 0);

    // ---- WhatsApp enquiry volume, 30 days ----
    const dayBuckets = new Array(30).fill(0);
    (waRows ?? []).forEach((r: any) => {
      const d = new Date(r.created_at);
      d.setHours(0, 0, 0, 0);
      const i = Math.floor((d.getTime() - thirtyDaysAgo.getTime()) / 86400_000);
      if (i >= 0 && i < 30) dayBuckets[i]++;
    });
    setEnquiryTrend(dayBuckets);
    const trendSum = dayBuckets.reduce((a, b) => a + b, 0);
    if (trendSum !== (waRows ?? []).length) {
      console.warn(`AdminOfficeAnalyticsDashboard: enquiry trend sum (${trendSum}) != fetched row count (${(waRows ?? []).length})`);
    }

    // ---- Pending-action table (oldest first), with attached-notes count ----
    const pendingAll = staged
      .filter((q) => q.status !== "delivered" && q.status !== "rejected")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const pending = pendingAll.slice(0, 15);

    // ---- Pending quotations by stage — reuses the already-computed
    // `staged`/`pendingAll` data above, no extra query. Uncapped (unlike
    // the 15-row table) so the breakdown reflects the true total. ----
    const stageCounts: Record<number, number> = {};
    pendingAll.forEach((q) => { stageCounts[q.stage] = (stageCounts[q.stage] ?? 0) + 1; });
    setPendingByStage(
      Object.entries(stageCounts).map(([stage, count]) => ({
        name: STAGE_DEFS[Number(stage) as PipelineStage].label,
        value: count,
        color: stageToneHex(STAGE_DEFS[Number(stage) as PipelineStage].tone),
      })),
    );
    const noteCounts: Record<string, number> = {};
    if (pending.length) {
      const { data: notes } = await supabase
        .from("quotation_attached_notes")
        .select("quotation_id")
        .in("quotation_id", pending.map((q) => q.id));
      (notes ?? []).forEach((n: any) => { noteCounts[n.quotation_id] = (noteCounts[n.quotation_id] ?? 0) + 1; });
    }
    setPendingRows(
      pending.map((q) => ({
        ...q,
        ageDays: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 86400_000),
        noteCount: noteCounts[q.id] ?? 0,
      })),
    );

    // ---- Anomaly: enquiry unanswered >24h, cross-checked against
    // whatsapp_followups_sent (no followup row covering this inbound yet
    // means it genuinely slipped through, not just "already reminded"). ----
    const latestInboundByPhone: Record<string, string> = {};
    (waRows ?? []).forEach((r: any) => {
      if (!latestInboundByPhone[r.phone] || r.created_at > latestInboundByPhone[r.phone]) latestInboundByPhone[r.phone] = r.created_at;
    });
    const followupByPhone = new Map((followupRows ?? []).map((f: any) => [f.phone, f]));
    const twentyFourHoursAgo = Date.now() - 24 * 3600_000;
    let unanswered = 0;
    Object.entries(latestInboundByPhone).forEach(([phone, latestAt]) => {
      if (new Date(latestAt).getTime() > twentyFourHoursAgo) return;
      const f = followupByPhone.get(phone) as any;
      const alreadyFollowedUp = f && new Date(f.last_inbound_at).getTime() >= new Date(latestAt).getTime();
      if (!alreadyFollowedUp) unanswered++;
    });
    const nextAnomalies: Anomaly[] = [];
    if (unanswered > 0) {
      nextAnomalies.push({
        key: "wa-unanswered",
        severity: "critical",
        message: `${unanswered} WhatsApp enquir${unanswered === 1 ? "y" : "ies"} unanswered >24h`,
        to: "/admin/whatsapp",
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
          <h2 className="font-display text-xl sm:text-2xl">Office Analytics</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Client Hub intake, enquiries and service load — live from Supabase.</p>
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

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <KpiCard label="Open at Stage 1 · Client Hub" value={String(stage1Count)} icon={Ruler} to="/admin/quotations?status=stage1" />
              <KpiCard
                label="Avg time in a stage"
                value={avgTimeInStageDays === null ? "—" : `${avgTimeInStageDays.toFixed(1)}d`}
                icon={Clock}
                sub={avgTimeInStageDays === null ? "Not enough status history yet" : "Across all recorded stage transitions"}
              />
              <KpiCard label="Unresolved complaints" value={String(unresolvedComplaints)} icon={LifeBuoy} to="/admin/services?tab=complaint" />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base sm:text-lg">Pending Quotations by Stage</CardTitle>
                  <p className="text-xs text-muted-foreground">Everything not yet delivered or rejected</p>
                </CardHeader>
                <CardContent><StatusDonut data={pendingByStage} /></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base sm:text-lg">WhatsApp Enquiry Volume</CardTitle>
                  <p className="text-xs text-muted-foreground">Inbound messages per day · last 30 days</p>
                </CardHeader>
                <CardContent><DailyLineChart data={enquiryTrend} days={30} unitLabel="enquiry" /></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="font-display text-lg">Quotations Pending Action</CardTitle>
                <Button asChild variant="ghost" size="sm"><Link to="/admin/quotations">All quotations <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
              </CardHeader>
              <CardContent>
                {pendingRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nothing pending. 🌿</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-left">Party</th>
                          <th className="px-2 py-2 text-left">Stage</th>
                          <th className="px-2 py-2 text-right">Age</th>
                          <th className="px-2 py-2 text-left">Notes</th>
                          <th className="px-2 py-2 text-right">Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRows.map((q) => (
                          <tr key={q.id} className="border-t border-border/60">
                            <td className="px-2 py-2">
                              <p className="font-medium">{q.party_name}</p>
                              <p className="font-mono text-[11px] text-muted-foreground">{q.quotation_id} · {q.party_place}</p>
                            </td>
                            <td className="px-2 py-2">
                              <Badge variant="outline" className={stageToneClasses(STAGE_DEFS[q.stage].tone)}>
                                Stage {q.stage} · {STAGE_DEFS[q.stage].label}
                              </Badge>
                            </td>
                            <td className={`px-2 py-2 text-right tabular-nums ${q.ageDays > 7 ? "font-semibold text-rose-600 dark:text-rose-400" : ""}`}>
                              {q.ageDays}d
                            </td>
                            <td className="px-2 py-2">
                              {q.noteCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Paperclip className="h-3 w-3" /> {q.noteCount}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <Button asChild size="sm" variant="outline"><Link to={`/admin/quotations/${q.id}`}>Open</Link></Button>
                            </td>
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

export default AdminOfficeAnalyticsDashboard;
