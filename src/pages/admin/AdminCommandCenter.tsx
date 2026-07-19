import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_STAGES, STAGE_DEFS, stageToneHex } from "@/lib/quotationPipeline";

/**
 * Command Center — single unified overview tab (no sub-tabs by design).
 *
 * Reads from `public.command_center_snapshot`, a security-invoker view
 * (no RLS bypass — returns only what the logged-in admin's own policies
 * already allow) that aggregates catalog, WhatsApp, pipeline, inventory
 * and operations signals into one row.
 *
 * Intentionally kept as ONE page instead of splitting into tabs: everything
 * important should be visible on load, with "Quick Links" at the bottom to
 * jump straight into the relevant admin section when action is needed.
 * When new agents/signals come online, add a column to the view and a
 * card here — do not add a new tab.
 */

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
  snapshot_generated_at: string;
};

const POLL_MS = 30_000;

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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </h2>
  );
}

function QuickLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: any;
}) {
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

const AdminCommandCenter = () => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("command_center_snapshot" as any)
      .select("*")
      .maybeSingle();
    if (error) {
      setError(error.message);
    } else {
      setSnapshot(data as unknown as Snapshot);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const stageCounts = snapshot?.pipeline_stage_counts ?? {};
  const maxStageCount = Math.max(1, ...ALL_STAGES.map((s) => stageCounts[String(s)] ?? 0));

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Business-nte ella key signals — catalog, WhatsApp, pipeline, inventory, operations — ഒറ്റ പേജിൽ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {snapshot && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(snapshot.snapshot_generated_at).toLocaleTimeString("en-IN")}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Snapshot load ചെയ്യാൻ പറ്റിയില്ല: {error}
        </div>
      )}

      {loading && !snapshot && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {snapshot && (
        <>
          {/* Needs attention — the things that actually need someone to act today */}
          <SectionHeading>Needs Attention</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Catalog — Pending Review"
              value={snapshot.catalog_pending_review}
              hint="Supervisor approval waiting"
              attention={snapshot.catalog_pending_review > 0}
              icon={PackageSearch}
              to="/admin/products/approval"
            />
            <StatCard
              label="Catalog — Missing Category"
              value={snapshot.catalog_missing_category}
              hint="main_category_id unset"
              attention={snapshot.catalog_missing_category > 0}
              icon={AlertTriangle}
              to="/admin/products/approval"
            />
            <StatCard
              label="Low Stock"
              value={snapshot.products_low_stock}
              hint="At or below reorder level"
              attention={snapshot.products_low_stock > 0}
              icon={AlertTriangle}
              to="/admin/inventory/reorder"
            />
            <StatCard
              label="Open Complaints"
              value={snapshot.complaints_open}
              hint="Customer service, unresolved"
              attention={snapshot.complaints_open > 0}
              icon={LifeBuoy}
              to="/admin/services"
            />
          </div>

          {/* Pipeline & quotations */}
          <SectionHeading>Pipeline &amp; Quotations</SectionHeading>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <StatCard
              label="Active Quotations"
              value={snapshot.quotations_active}
              hint="Not deleted"
              icon={FileText}
              to="/admin/quotations"
            />
            <StatCard
              label="Active Early-Stage Leads"
              value={snapshot.leads_active_stage_early}
              hint="Client Hub / Dimensions — last 7 days"
              icon={FileText}
              to="/admin/quotations?status=stage1&lead=consultation"
            />
            <StatCard
              label="Pipeline Events — 24h"
              value={snapshot.pipeline_events_24h}
              hint="All source types"
              icon={FileText}
            />
          </div>
          <Card className="mt-4">
            <CardContent className="p-5">
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Six-stage pipeline — Client Hub → Dimensions → OPS → Production → Warehouse → Logistics. Tap a stage
                to open it in Quotations.
              </p>
              <div className="space-y-1">
                {ALL_STAGES.map((stage) => {
                  const def = STAGE_DEFS[stage];
                  const count = stageCounts[String(stage)] ?? 0;
                  const pct = Math.round((count / maxStageCount) * 100);
                  return (
                    <Link
                      key={stage}
                      to={`/admin/quotations?status=stage${stage}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-smooth hover:bg-secondary/60"
                    >
                      <div className="w-28 shrink-0">
                        <div className="text-sm font-medium text-foreground">{def.label}</div>
                        <div className="text-[11px] text-muted-foreground">{def.owner}</div>
                      </div>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: stageToneHex(def.tone) }}
                        />
                      </div>
                      <div className="w-10 shrink-0 text-right text-sm font-semibold text-foreground">{count}</div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Operations & communications */}
          <SectionHeading>Operations &amp; Communications</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="WhatsApp — Last 24h"
              value={snapshot.whatsapp_messages_24h}
              hint="Inbound messages logged"
              icon={MessageCircle}
            />
            <StatCard
              label="Invoices Processed — 24h"
              value={snapshot.invoices_processed_24h}
              hint="Telegram intake pipeline"
              icon={PackageSearch}
            />
            <StatCard
              label="Measurement Tasks Pending"
              value={snapshot.measurement_tasks_pending}
              hint="pending / in_progress"
              icon={Ruler}
              to="/admin/measurement-tasks"
            />
            <StatCard
              label="Products — Real Photos Pending"
              value={snapshot.products_deleted_pending}
              hint="Soft-deleted, awaiting data entry"
              icon={ImageOff}
            />
          </div>

          {/* Quick links — jump straight to the relevant section instead of hunting the sidebar */}
          <SectionHeading>Quick Links</SectionHeading>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink to="/admin/quotations" label="Quotations" icon={FileText} />
            <QuickLink to="/admin/whatsapp" label="WhatsApp Inbox" icon={MessageCircle} />
            <QuickLink to="/admin/measurement-tasks" label="Measurement Tasks" icon={Ruler} />
            <QuickLink to="/admin/services" label="Service & Complaints" icon={LifeBuoy} />
            <QuickLink to="/admin/inventory/reorder" label="Reorder Report" icon={AlertTriangle} />
            <QuickLink to="/admin/products" label="Products" icon={PackageSearch} />
          </div>
        </>
      )}

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Read-only aggregation · security-invoker view (no RLS bypass) · extend{" "}
        <code>command_center_snapshot</code> with more columns as more agents come online — one page, no new tabs.
      </p>
    </AdminShell>
  );
};

export default AdminCommandCenter;
