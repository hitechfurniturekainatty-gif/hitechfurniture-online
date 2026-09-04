import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  RefreshCw,
  PackageSearch,
  MessageCircle,
  Ruler,
  LifeBuoy,
  AlertTriangle,
  FileText,
  ImageOff,
  ArrowRight,
  Warehouse,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_STAGES, STAGE_DEFS, stageToneHex } from "@/lib/quotationPipeline";

type Snapshot = {
  catalog_pending_review: number;
  catalog_missing_category: number;
  invoices_processed_24h: number;
  whatsapp_messages_24h: number;
  pipeline_events_24h: number;
  leads_active_stage_early: number;
  quotations_active: number;
  pipeline_stage_counts: Record<string, number> | null;
  products_low_stock: number;
  products_deleted_pending: number;
  measurement_tasks_pending: number;
  complaints_open: number;
  quotations_dispatched_today?: number;
  dispatched_value_today?: string | number;
  warehouse_queue?: number;
  delivery_queue?: number;
  delivery_queue_unassigned?: number;
  snapshot_generated_at: string;
};

const POLL_MS = 30_000;

const emptyStageCounts = () => Object.fromEntries(ALL_STAGES.map((s) => [String(s), 0])) as Record<string, number>;

function StatCard({
  label,
  value,
  hint,
  attention,
  icon: Icon,
  to,
}: {
  label: string;
  value: number;
  hint: string;
  attention?: boolean;
  icon?: any;
  to?: string;
}) {
  const body = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && <Icon className={"h-4 w-4 " + (attention ? "text-amber-600" : "text-muted-foreground")} />}
      </div>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </CardContent>
  );
  const className =
    (attention ? "border-amber-300 bg-amber-50 " : "") + (to ? "transition-smooth hover:border-primary/50" : "");
  return to ? (
    <Link to={to}>
      <Card className={className}>{body}</Card>
    </Link>
  ) : (
    <Card className={className}>{body}</Card>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </h3>
  );
}

function QuickLink({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground/80 shadow-card-soft transition-smooth hover:border-primary/40 hover:text-primary"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </Link>
  );
}

export const CommandCenterPanel = () => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const loadFallback = useCallback(async (): Promise<Snapshot | null> => {
    try {
      const [qRes, pRes, mRes, cRes] = await Promise.all([
        supabase
          .from("quotations")
          .select("pipeline_stage, status, created_at")
          .is("deleted_at", null),
        supabase
          .from("products")
          .select("main_category_id, stock_quantity, reorder_level, deleted_at"),
        supabase
          .from("measurement_tasks")
          .select("status")
          .is("deleted_at", null),
        supabase
          .from("customer_complaints")
          .select("status")
          .is("deleted_at", null),
      ]);

      if (qRes.error || pRes.error || mRes.error || cRes.error) return null;

      const quotations = (qRes.data ?? []) as Array<{ pipeline_stage: number | null; status: string; created_at: string }>;
      const products = (pRes.data ?? []) as Array<{ main_category_id: string | null; stock_quantity: number | null; reorder_level: number | null; deleted_at: string | null }>;
      const measurements = (mRes.data ?? []) as Array<{ status: string }>;
      const complaints = (cRes.data ?? []) as Array<{ status: string }>;
      const stages = emptyStageCounts();
      quotations.forEach((q) => {
        const stage = Math.min(6, Math.max(1, Number(q.pipeline_stage ?? 1)));
        stages[String(stage)] = (stages[String(stage)] ?? 0) + 1;
      });
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      return {
        catalog_pending_review: 0,
        catalog_missing_category: products.filter((p) => !p.deleted_at && !p.main_category_id).length,
        invoices_processed_24h: 0,
        whatsapp_messages_24h: 0,
        pipeline_events_24h: 0,
        leads_active_stage_early: quotations.filter((q) => Number(q.pipeline_stage ?? 1) <= 2 && new Date(q.created_at).getTime() >= sevenDaysAgo).length,
        quotations_active: quotations.length,
        pipeline_stage_counts: stages,
        products_low_stock: products.filter((p) => !p.deleted_at && Number(p.stock_quantity ?? 0) <= Number(p.reorder_level ?? 5)).length,
        products_deleted_pending: products.filter((p) => !!p.deleted_at).length,
        measurement_tasks_pending: measurements.filter((m) => m.status === "pending" || m.status === "in_progress").length,
        complaints_open: complaints.filter((c) => !["resolved", "closed", "completed"].includes(c.status)).length,
        warehouse_queue: stages["5"] ?? 0,
        delivery_queue: stages["6"] ?? 0,
        delivery_queue_unassigned: 0,
        snapshot_generated_at: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: snapshotError } = await supabase
      .from("command_center_snapshot" as any)
      .select("*")
      .maybeSingle();

    if (!snapshotError && data) {
      setSnapshot(data as unknown as Snapshot);
      setError(null);
      setUsingFallback(false);
      setLoading(false);
      return;
    }

    const fallback = await loadFallback();
    if (fallback) {
      setSnapshot(fallback);
      setError(null);
      setUsingFallback(true);
    } else {
      setError(snapshotError?.message || "Unable to load business snapshot");
    }
    setLoading(false);
  }, [loadFallback]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const stageCounts = snapshot?.pipeline_stage_counts ?? {};
  const maxStageCount = Math.max(1, ...ALL_STAGES.map((s) => stageCounts[String(s)] ?? 0));

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl sm:text-2xl">Command Center</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalog, WhatsApp, pipeline, inventory, operations — ഒറ്റ നോട്ടത്തിൽ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {snapshot && (
            <span className="text-xs text-muted-foreground">
              {usingFallback ? "Live fallback · " : "Updated "}
              {new Date(snapshot.snapshot_generated_at).toLocaleTimeString("en-IN")}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Business snapshot load failed: {error}
        </div>
      )}

      {loading && !snapshot && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {snapshot && (
        <>
          <SubHeading>Needs Attention</SubHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Catalog — Pending Review" value={snapshot.catalog_pending_review} hint="Supervisor approval waiting" attention={snapshot.catalog_pending_review > 0} icon={PackageSearch} to="/admin/products/approval" />
            <StatCard label="Catalog — Missing Category" value={snapshot.catalog_missing_category} hint="Category must be assigned" attention={snapshot.catalog_missing_category > 0} icon={AlertTriangle} to="/admin/products/approval" />
            <StatCard label="Low Stock" value={snapshot.products_low_stock} hint="At or below reorder level" attention={snapshot.products_low_stock > 0} icon={AlertTriangle} to="/admin/inventory/reorder" />
            <StatCard label="Open Complaints" value={snapshot.complaints_open} hint="Customer service unresolved" attention={snapshot.complaints_open > 0} icon={LifeBuoy} to="/admin/services" />
          </div>

          <SubHeading>Pipeline &amp; Quotations</SubHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Quotations" value={snapshot.quotations_active} hint="Current quotation / order records" icon={FileText} to="/admin/quotations" />
            <StatCard label="Active Early-Stage Leads" value={snapshot.leads_active_stage_early} hint="Client Hub / Dimensions — recent" icon={FileText} to="/admin/quotations?status=stage1" />
            <StatCard label="Warehouse Queue" value={snapshot.warehouse_queue ?? (stageCounts["5"] ?? 0)} hint="Ready / waiting for dispatch" attention={(snapshot.warehouse_queue ?? 0) > 0} icon={Warehouse} to="/admin/warehouse" />
            <StatCard label="Delivery Queue" value={snapshot.delivery_queue ?? (stageCounts["6"] ?? 0)} hint="In logistics / delivery" attention={(snapshot.delivery_queue_unassigned ?? 0) > 0} icon={Truck} to="/admin/logistics" />
          </div>

          <Card className="mt-4">
            <CardContent className="p-5">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Six-stage pipeline — Client Hub → Dimensions → OPS → Production → Warehouse → Logistics. Tap a stage to open it in Quotations.
              </p>
              <div className="space-y-1">
                {ALL_STAGES.map((stage) => {
                  const def = STAGE_DEFS[stage];
                  const count = stageCounts[String(stage)] ?? 0;
                  const pct = Math.round((count / maxStageCount) * 100);
                  return (
                    <Link key={stage} to={`/admin/quotations?status=stage${stage}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-smooth hover:bg-secondary/60">
                      <div className="w-28 shrink-0">
                        <div className="text-sm font-medium text-foreground">{def.label}</div>
                        <div className="text-[11px] text-muted-foreground">{def.owner}</div>
                      </div>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: stageToneHex(def.tone) }} />
                      </div>
                      <div className="w-10 shrink-0 text-right text-sm font-semibold text-foreground">{count}</div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <SubHeading>Operations &amp; Communications</SubHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="WhatsApp — Last 24h" value={snapshot.whatsapp_messages_24h} hint="Inbound messages logged" icon={MessageCircle} />
            <StatCard label="Pipeline Events — 24h" value={snapshot.pipeline_events_24h} hint="Business workflow activity" icon={FileText} />
            <StatCard label="Measurement Tasks Pending" value={snapshot.measurement_tasks_pending} hint="Pending / in progress" attention={snapshot.measurement_tasks_pending > 0} icon={Ruler} to="/admin/measurement-tasks" />
            <StatCard label="Products — Data Cleanup" value={snapshot.products_deleted_pending} hint="Soft-deleted / pending cleanup" icon={ImageOff} />
          </div>

          <SubHeading>Quick Links</SubHeading>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink to="/admin/quotations" label="Quotations & Leads" icon={FileText} />
            <QuickLink to="/admin/measurement-tasks" label="Measurement Tasks" icon={Ruler} />
            <QuickLink to="/admin/production" label="Production Board" icon={PackageSearch} />
            <QuickLink to="/admin/warehouse" label="Warehouse" icon={Warehouse} />
            <QuickLink to="/admin/logistics" label="Logistics" icon={Truck} />
            <QuickLink to="/admin/inventory/reorder" label="Reorder Report" icon={AlertTriangle} />
          </div>
        </>
      )}
    </div>
  );
};

export default CommandCenterPanel;
