import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ClipboardList, Ruler, HardHat, ArrowRight } from "lucide-react";
import { KpiCard } from "@/components/overview/KpiCard";
import { AnomalyBadges, type Anomaly } from "@/components/overview/AnomalyBadge";
import { StageDistributionBarChart } from "@/components/overview/charts/StageDistributionBarChart";
import { computeStage, type PipelineStage } from "@/lib/quotationPipeline";
import { jobStatusLabel, jobStatusTone, isJobFinished } from "./AdminWorkerDetail";

// Production only cares about the in-house build stages — Client Hub (1)
// and Logistics (6) are handled by other teams.
const PRODUCTION_STAGES: PipelineStage[] = [2, 3, 4, 5];

type UpdateRow = {
  id: string;
  job_id: string;
  status: string;
  note: string | null;
  created_at: string;
  worker_name: string;
  quotation_code: string;
  daysInStage: number;
};

const startOfWeek = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
};

const AdminProductionAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [jobsInQueue, setJobsInQueue] = useState(0);
  const [tasksCompletedThisWeek, setTasksCompletedThisWeek] = useState(0);
  const [activeWorkers, setActiveWorkers] = useState(0);
  const [stageCounts, setStageCounts] = useState<Record<number, number>>({});
  const [updateRows, setUpdateRows] = useState<UpdateRow[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const load = async () => {
    setLoading(true);
    const weekStart = startOfWeek();

    const [
      { data: quotRows },
      { data: jobRows },
      { data: tqRows },
      { data: itemRows },
      { data: taskRows },
      { count: activeWorkerCount },
      { data: updateRowsRaw },
      { data: workerRows },
    ] = await Promise.all([
      supabase
        .from("quotations")
        .select("id, status, advance_amount, submitted_for_pricing_at, is_direct_order, source_task_id")
        .is("deleted_at", null)
        .eq("document_type", "quotation"),
      supabase.from("job_work_orders").select("id, quotation_id, status, status_updated_at, worker_id, warehouse_status").is("deleted_at", null),
      supabase.from("trip_quotations").select("quotation_id, delivered_at, trips:trip_id(status)") as any,
      supabase.from("quotation_items").select("quotation_id, fulfillment_route") as any,
      supabase.from("measurement_tasks").select("status, completed_at, created_at"),
      supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("worker_status_updates").select("id, job_id, worker_id, status, note, created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("workers").select("id, name"),
    ]);

    // ---- Same job/trip/item aggregation computeStage() needs everywhere
    // else in the app (AdminOverview, AdminPipelineMonitor, Office dash). ----
    const jobsByQ: Record<string, { total: number; done: number; warehouse: number; dispatched: number }> = {};
    (jobRows ?? []).forEach((j: any) => {
      if (!j.quotation_id) return;
      const cur = jobsByQ[j.quotation_id] ?? { total: 0, done: 0, warehouse: 0, dispatched: 0 };
      cur.total += 1;
      if (isJobFinished(j.status)) cur.done += 1;
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
    const stageByQuotation: Record<string, PipelineStage> = {};
    (quotRows ?? []).forEach((q: any) => {
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
      stageByQuotation[q.id] = info.stage;
    });

    // ---- Jobs by stage (Dimensions/OPS/Production/Warehouse-handoff) ----
    const jobRowsList = (jobRows ?? []) as { id: string; quotation_id: string | null; status: string; status_updated_at: string | null }[];
    const counts: Record<number, number> = {};
    jobRowsList.forEach((j) => {
      const stage = j.quotation_id ? stageByQuotation[j.quotation_id] : undefined;
      if (stage && PRODUCTION_STAGES.includes(stage)) counts[stage] = (counts[stage] ?? 0) + 1;
    });
    setStageCounts(counts);

    // ---- Anomaly: stage bottleneck — one stage holding a disproportionate
    // share of jobs (>60% of the tracked total, with enough jobs to matter). ----
    const trackedTotal = PRODUCTION_STAGES.reduce((s, st) => s + (counts[st] ?? 0), 0);
    const nextAnomalies: Anomaly[] = [];
    if (trackedTotal >= 3) {
      const [worstStage, worstCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
      if (worstStage && worstCount / trackedTotal > 0.6) {
        const stageLabel = { 2: "Dimensions", 3: "OPS", 4: "Production", 5: "Warehouse-handoff" }[Number(worstStage)] ?? `Stage ${worstStage}`;
        nextAnomalies.push({
          key: "stage-bottleneck",
          severity: "warning",
          message: `Bottleneck: ${worstCount}/${trackedTotal} jobs stuck at ${stageLabel}`,
        });
      }
    }
    setAnomalies(nextAnomalies);

    // ---- KPIs ----
    setJobsInQueue(jobRowsList.filter((j) => !isJobFinished(j.status)).length);
    setActiveWorkers(activeWorkerCount ?? 0);
    setTasksCompletedThisWeek(
      (taskRows ?? []).filter((t: any) => t.status === "completed" && new Date(t.completed_at ?? t.created_at) >= weekStart).length,
    );

    // ---- Worker status updates table, flagged if job >5 days in same stage ----
    const workerNameById = new Map((workerRows ?? []).map((w: any) => [w.id, w.name as string]));
    const jobById = new Map(jobRowsList.map((j) => [j.id, j]));
    const quotCodeById = new Map<string, string>();
    if ((updateRowsRaw ?? []).length) {
      const qids = Array.from(new Set((updateRowsRaw ?? []).map((u: any) => jobById.get(u.job_id)?.quotation_id).filter(Boolean)));
      if (qids.length) {
        const { data: qCodes } = await supabase.from("quotations").select("id, quotation_id").in("id", qids as string[]);
        (qCodes ?? []).forEach((q: any) => quotCodeById.set(q.id, q.quotation_id));
      }
    }
    const fiveDaysAgo = Date.now() - 5 * 86400_000;
    setUpdateRows(
      (updateRowsRaw ?? []).map((u: any) => {
        const job = jobById.get(u.job_id);
        const daysInStage = job?.status_updated_at ? Math.floor((Date.now() - new Date(job.status_updated_at).getTime()) / 86400_000) : 0;
        return {
          id: u.id,
          job_id: u.job_id,
          status: u.status,
          note: u.note,
          created_at: u.created_at,
          worker_name: workerNameById.get(u.worker_id) ?? "—",
          quotation_code: (job?.quotation_id && quotCodeById.get(job.quotation_id)) ?? "—",
          daysInStage: job?.status_updated_at && new Date(job.status_updated_at).getTime() < fiveDaysAgo ? daysInStage : 0,
        };
      }),
    );

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <OfficeStaffOnly>
      <AdminShell>
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Production Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">Job queue, worker activity and stage load — live from Supabase.</p>
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
              <KpiCard label="Jobs in queue" value={String(jobsInQueue)} icon={ClipboardList} to="/admin/production" />
              <KpiCard label="Measurement tasks done this week" value={String(tasksCompletedThisWeek)} icon={Ruler} to="/admin/measurement-tasks" />
              <KpiCard label="Active workers" value={String(activeWorkers)} icon={HardHat} to="/admin/workers" />
            </div>

            <div className="mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base sm:text-lg">Jobs by Stage</CardTitle>
                  <p className="text-xs text-muted-foreground">Dimensions → OPS → Production → Warehouse-handoff</p>
                </CardHeader>
                <CardContent><StageDistributionBarChart stages={PRODUCTION_STAGES} counts={stageCounts} /></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="font-display text-lg">Worker Status Updates</CardTitle>
                <Button asChild variant="ghost" size="sm"><Link to="/admin/staff-monitor">Staff monitor <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
              </CardHeader>
              <CardContent>
                {updateRows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No worker updates yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-left">Worker</th>
                          <th className="px-2 py-2 text-left">Job</th>
                          <th className="px-2 py-2 text-left">Status</th>
                          <th className="px-2 py-2 text-left">Note</th>
                          <th className="px-2 py-2 text-right">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {updateRows.map((u) => (
                          <tr key={u.id} className={`border-t border-border/60 ${u.daysInStage > 5 ? "bg-rose-500/5" : ""}`}>
                            <td className="px-2 py-2 font-medium">{u.worker_name}</td>
                            <td className="px-2 py-2">
                              <Link to={`/admin/workers`} className="font-mono text-xs hover:text-primary">{u.quotation_code}</Link>
                              {u.daysInStage > 5 && (
                                <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{u.daysInStage}d in same stage</p>
                              )}
                            </td>
                            <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${jobStatusTone(u.status) === "default" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{jobStatusLabel(u.status)}</span></td>
                            <td className="max-w-[220px] truncate px-2 py-2 text-muted-foreground">{u.note ?? "—"}</td>
                            <td className="px-2 py-2 text-right text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
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
      </AdminShell>
    </OfficeStaffOnly>
  );
};

export default AdminProductionAnalyticsDashboard;
