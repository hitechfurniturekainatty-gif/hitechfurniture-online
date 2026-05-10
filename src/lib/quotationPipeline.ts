// Visual workflow pipeline for quotations.
// Maps the raw DB state (status, advance, submitted_for_pricing, jobs, trips,
// is_direct_order) into a single 1-5 stage so the UI can show a progress bar
// and "Current owner" label without re-deriving the rules in each component.

import { normalizeStatus } from "@/pages/admin/AdminQuotationEditor";

export type PipelineInput = {
  status: string;
  advance_amount?: number | null;
  submitted_for_pricing_at?: string | null;
  is_direct_order?: boolean | null;
  source_task_id?: string | null;
  // Aggregated job state for this quotation (optional — compute once and pass).
  jobs_total?: number;
  jobs_completed?: number;
  // Warehouse stage of jobs: how many are sitting in / past warehouse.
  jobs_in_warehouse?: number;       // any of (in_warehouse, ready_to_pack, ready_for_dispatch)
  jobs_dispatched?: number;          // warehouse_status = 'dispatched'
  // Aggregated delivery trip state.
  has_trip?: boolean;
  trip_completed?: boolean;
};

// 6-stage admin blueprint:
// 1 Client Hub  2 Dimensions  3 OPS  4 Production  5 Warehouse  6 Logistics
export type PipelineStage = 1 | 2 | 3 | 4 | 5 | 6;

export type StageInfo = {
  stage: PipelineStage;
  key: "client_hub" | "dimensions" | "ops" | "production" | "warehouse" | "logistics";
  label: string;
  owner: string;
  tone: "rose" | "amber" | "sky" | "violet" | "indigo" | "emerald";
};

export const STAGE_DEFS: Record<PipelineStage, Omit<StageInfo, "stage">> = {
  1: { key: "client_hub", label: "Client Hub",  owner: "Sales / Admin",   tone: "rose"    },
  2: { key: "dimensions", label: "Dimensions",  owner: "Measurement Team", tone: "amber"  },
  3: { key: "ops",        label: "OPS",         owner: "Office Staff",    tone: "sky"     },
  4: { key: "production", label: "Production",  owner: "Production Unit", tone: "violet"  },
  5: { key: "warehouse",  label: "Warehouse",   owner: "Warehouse Team",  tone: "indigo"  },
  6: { key: "logistics",  label: "Logistics",   owner: "Delivery Team",   tone: "emerald" },
};

export const ALL_STAGES: PipelineStage[] = [1, 2, 3, 4, 5, 6];

export const computeStage = (q: PipelineInput): StageInfo => {
  const s = normalizeStatus(q.status);

  // Logistics: out for delivery / delivered, OR has any dispatched job.
  if (s === "delivered") return { stage: 6, ...STAGE_DEFS[6] };
  if (q.has_trip) return { stage: 6, ...STAGE_DEFS[6] };
  if ((q.jobs_dispatched ?? 0) > 0) return { stage: 6, ...STAGE_DEFS[6] };

  // Warehouse: at least one finished job is sitting in / moving through warehouse.
  if ((q.jobs_in_warehouse ?? 0) > 0) return { stage: 5, ...STAGE_DEFS[5] };

  // Direct shop-stock orders skip measurement + pricing → straight to warehouse/logistics.
  if (q.is_direct_order) {
    if (q.jobs_total && q.jobs_total > 0 && (q.jobs_completed ?? 0) < q.jobs_total) {
      return { stage: 4, ...STAGE_DEFS[4] };
    }
    return { stage: 5, ...STAGE_DEFS[5] };
  }

  // Production: has jobs assigned (including completed but not yet warehoused).
  if (q.jobs_total && q.jobs_total > 0) return { stage: 4, ...STAGE_DEFS[4] };

  // OPS: drafted from measurement OR finalized but no jobs yet.
  if (s === "drafted") return { stage: 3, ...STAGE_DEFS[3] };
  const advance = Number(q.advance_amount ?? 0);
  if (s === "finalized" || advance > 0) return { stage: 3, ...STAGE_DEFS[3] };

  // Dimensions: came from a measurement task and not yet submitted.
  if (q.source_task_id && !q.submitted_for_pricing_at) {
    return { stage: 2, ...STAGE_DEFS[2] };
  }

  // Default — sitting in Client Hub.
  return { stage: 1, ...STAGE_DEFS[1] };
};

export const stageToneClasses = (tone: StageInfo["tone"]) => {
  switch (tone) {
    case "rose":    return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    case "amber":   return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "sky":     return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "violet":  return "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "indigo":  return "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
    case "emerald": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
};