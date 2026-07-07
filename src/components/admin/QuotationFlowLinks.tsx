import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HardHat, Truck, Warehouse, ArrowRight } from "lucide-react";
import { jobStatusLabel, isJobFinished } from "@/pages/admin/AdminWorkerDetail";
import { tripStatusLabel } from "@/lib/logistics";

type JobRow = { id: string; status: string; warehouse_status: string | null; worker_id: string | null; worker_name?: string };

// Read-only "what's happening downstream" strip for the quotation editor —
// jumps straight to the worker handling production and the trip handling
// delivery, so staff don't have to hunt through Workers/Trips to find the
// row that matches this quotation. Fetches independently of the editor's
// own load/autosave state (never touches it) — this is purely a fan-out
// of live status, not something the editor needs to save.
export const QuotationFlowLinks = ({ quotationId }: { quotationId: string }) => {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [tripStatus, setTripStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const [{ data: jobRows }, { data: tripRows }] = await Promise.all([
        supabase
          .from("job_work_orders")
          .select("id, status, warehouse_status, worker_id")
          .eq("quotation_id", quotationId)
          .is("deleted_at", null),
        supabase
          .from("trip_quotations")
          .select("trips:trip_id(status)")
          .eq("quotation_id", quotationId) as any,
      ]);
      const jList = (jobRows ?? []) as JobRow[];
      const workerIds = Array.from(new Set(jList.map((j) => j.worker_id).filter(Boolean))) as string[];
      if (workerIds.length) {
        const { data: workers } = await supabase.from("workers").select("id, name").in("id", workerIds);
        const nameById = new Map((workers ?? []).map((w: any) => [w.id, w.name as string]));
        jList.forEach((j) => { if (j.worker_id) j.worker_name = nameById.get(j.worker_id); });
      }
      const trip = ((tripRows ?? []) as any[])[0]?.trips ?? null;
      if (!cancelled) {
        setJobs(jList);
        setTripStatus(trip?.status ?? null);
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [quotationId]);

  if (loading || (jobs.length === 0 && !tripStatus)) return null;

  const inWarehouse = jobs.some((j) =>
    j.warehouse_status === "in_warehouse" || j.warehouse_status === "ready_to_pack" || j.warehouse_status === "ready_for_dispatch"
  );
  const workerIds = new Set(jobs.map((j) => j.worker_id).filter(Boolean));
  const singleWorkerId = jobs.length > 0 && workerIds.size === 1 ? jobs[0].worker_id : null;
  const openJobs = jobs.filter((j) => !isJobFinished(j.status)).length;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {jobs.length > 0 && (
        <Link
          to={singleWorkerId ? `/admin/workers/${singleWorkerId}` : "/admin/workers"}
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 font-medium text-violet-700 transition-smooth hover:shadow-sm dark:text-violet-300"
        >
          <HardHat className="h-3 w-3" />
          Production: {jobs.length === 1 ? jobStatusLabel(jobs[0].status) : `${openJobs}/${jobs.length} open`}
          {jobs.length === 1 && jobs[0].worker_name ? ` · ${jobs[0].worker_name}` : ""}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
      {inWarehouse && (
        <Link
          to="/admin/warehouse"
          className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 font-medium text-indigo-700 transition-smooth hover:shadow-sm dark:text-indigo-300"
        >
          <Warehouse className="h-3 w-3" /> In warehouse <ArrowRight className="h-3 w-3" />
        </Link>
      )}
      {tripStatus && (
        <Link
          to="/admin/trips"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 transition-smooth hover:shadow-sm dark:text-emerald-300"
        >
          <Truck className="h-3 w-3" /> Delivery: {tripStatusLabel(tripStatus)} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
};
