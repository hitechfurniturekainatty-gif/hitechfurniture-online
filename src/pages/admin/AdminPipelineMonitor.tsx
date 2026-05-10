import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminOnly } from "@/components/admin/AdminOnly";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { computeStage, ALL_STAGES, STAGE_DEFS, stageToneClasses, type PipelineStage } from "@/lib/quotationPipeline";
import { PipelineSteps } from "@/components/admin/PipelineSteps";
import { formatINR } from "@/lib/brand";

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
};

type Job = { quotation_id: string | null; status: string };
type TripQ = { quotation_id: string; trip: { status: string } | null };

const AdminPipelineMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<(Q & { stage: PipelineStage; stageInfo: ReturnType<typeof computeStage> })[]>([]);
  const [active, setActive] = useState<PipelineStage | "all">("all");

  const load = async () => {
    setLoading(true);
    const [qRes, jRes, tqRes] = await Promise.all([
      supabase
        .from("quotations")
        .select("id, quotation_id, party_name, party_place, status, total, advance_amount, submitted_for_pricing_at, is_direct_order, source_task_id")
        .is("deleted_at", null)
        .eq("document_type", "quotation")
        .order("created_at", { ascending: false }),
      supabase
        .from("job_work_orders")
        .select("quotation_id, status")
        .is("deleted_at", null),
      supabase
        .from("trip_quotations")
        .select("quotation_id, delivered_at, trips:trip_id(status)") as any,
    ]);

    const jobs = ((jRes.data ?? []) as Job[]);
    const tripsByQ: Record<string, { has: boolean; completed: boolean }> = {};
    ((tqRes.data ?? []) as any[]).forEach((tq) => {
      const qid = tq.quotation_id as string;
      const tStatus = tq.trips?.status as string | undefined;
      const cur = tripsByQ[qid] ?? { has: false, completed: false };
      cur.has = true;
      if (tStatus === "completed" || tq.delivered_at) cur.completed = true;
      tripsByQ[qid] = cur;
    });

    const jobsByQ: Record<string, { total: number; done: number }> = {};
    jobs.forEach((j) => {
      if (!j.quotation_id) return;
      const cur = jobsByQ[j.quotation_id] ?? { total: 0, done: 0 };
      cur.total += 1;
      if (j.status === "completed" || j.status === "done") cur.done += 1;
      jobsByQ[j.quotation_id] = cur;
    });

    const built = ((qRes.data ?? []) as Q[]).map((q) => {
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
        has_trip: t?.has ?? false,
        trip_completed: t?.completed ?? false,
      });
      return { ...q, stage: info.stage, stageInfo: info };
    });
    setRows(built);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<PipelineStage, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    rows.forEach((r) => { c[r.stage] += 1; });
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (active === "all" ? rows : rows.filter((r) => r.stage === active)),
    [rows, active],
  );

  return (
    <AdminOnly>
      <AdminShell>
        <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Workflow Pipeline</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Live status of every quotation across the 6 workflow stages.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="mr-2 h-4 w-4" /> Refresh</>}
          </Button>
        </div>

        {/* Stage summary cards — click to filter */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => setActive("all")}
            className={`rounded-xl border bg-card p-3 text-left transition-smooth hover:shadow-product ${active === "all" ? "border-primary ring-2 ring-primary/30" : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All</p>
            <p className="font-display text-3xl font-semibold text-foreground">{rows.length}</p>
          </button>
          {ALL_STAGES.map((s) => {
            const def = STAGE_DEFS[s];
            const isActive = active === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setActive(s)}
                className={`rounded-xl border p-3 text-left transition-smooth hover:shadow-product ${stageToneClasses(def.tone)} ${isActive ? "ring-2 ring-primary/40" : ""}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Stage {s}</p>
                <p className="font-display text-3xl font-semibold">{counts[s]}</p>
                <p className="mt-0.5 truncate text-xs font-medium">{def.label}</p>
                <p className="text-[10px] opacity-70">With: {def.owner}</p>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No quotations in this stage.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((q) => (
              <Card key={q.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{q.party_name} <span className="text-muted-foreground">· {q.party_place}</span></CardTitle>
                      <p className="truncate font-mono text-xs text-muted-foreground">{q.quotation_id}</p>
                    </div>
                    <Badge variant="outline" className={stageToneClasses(q.stageInfo.tone)}>
                      {q.stageInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <PipelineSteps stage={q.stage} size="md" showLabels />
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      With: <span className="font-semibold text-foreground">{q.stageInfo.owner}</span>
                      {q.is_direct_order && <span className="ml-2 rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">Direct order</span>}
                    </span>
                    <span className="font-display text-base font-semibold text-foreground">{formatINR(q.total)}</span>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to={`/admin/quotations/${q.id}`}>Open <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AdminShell>
    </AdminOnly>
  );
};

export default AdminPipelineMonitor;