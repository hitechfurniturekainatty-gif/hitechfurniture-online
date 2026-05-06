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
  // Aggregated delivery trip state.
  has_trip?: boolean;
  trip_completed?: boolean;
};

export type PipelineStage = 1 | 2 | 3 | 4 | 5;

export type StageInfo = {
  stage: PipelineStage;
  key: "pricing" | "sent" | "production" | "delivery" | "delivered";
  label: string;
  owner: string;
  tone: "amber" | "sky" | "violet" | "indigo" | "emerald";
};

export const STAGE_DEFS: Record<PipelineStage, Omit<StageInfo, "stage">> = {
  1: { key: "pricing",    label: "Waiting for Pricing", owner: "Office Staff",  tone: "amber"   },
  2: { key: "sent",       label: "Quotation Sent",      owner: "Customer",      tone: "sky"     },
  3: { key: "production", label: "Ready for Production", owner: "Workers",      tone: "violet"  },
  4: { key: "delivery",   label: "Ready for Delivery",  owner: "Delivery Team", tone: "indigo"  },
  5: { key: "delivered",  label: "Delivered",           owner: "Done",          tone: "emerald" },
};

export const ALL_STAGES: PipelineStage[] = [1, 2, 3, 4, 5];

export const computeStage = (q: PipelineInput): StageInfo => {
  const s = normalizeStatus(q.status);
  if (s === "delivered") return { stage: 5, ...STAGE_DEFS[5] };

  // Direct shop-stock orders skip measurement + pricing entirely.
  if (q.is_direct_order) {
    if (q.has_trip && q.trip_completed) return { stage: 5, ...STAGE_DEFS[5] };
    if (q.jobs_total && q.jobs_total > 0 && (q.jobs_completed ?? 0) < q.jobs_total) {
      return { stage: 3, ...STAGE_DEFS[3] };
    }
    return { stage: 4, ...STAGE_DEFS[4] };
  }

  if (s === "drafted") {
    // Submitted by measurement staff = waiting for office pricing.
    return { stage: 1, ...STAGE_DEFS[1] };
  }

  // Finalized lifecycle.
  const advance = Number(q.advance_amount ?? 0);
  if (advance <= 0) return { stage: 2, ...STAGE_DEFS[2] };

  // Has advance → production / delivery split.
  if (q.has_trip && q.trip_completed) return { stage: 5, ...STAGE_DEFS[5] };
  if (q.jobs_total && q.jobs_total > 0) {
    const done = q.jobs_completed ?? 0;
    if (done >= q.jobs_total) return { stage: 4, ...STAGE_DEFS[4] };
    return { stage: 3, ...STAGE_DEFS[3] };
  }
  // Advance taken but no jobs yet → still production setup phase.
  return { stage: 3, ...STAGE_DEFS[3] };
};

export const stageToneClasses = (tone: StageInfo["tone"]) => {
  switch (tone) {
    case "amber":   return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "sky":     return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "violet":  return "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "indigo":  return "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
    case "emerald": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
};