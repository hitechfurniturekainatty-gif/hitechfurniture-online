import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Command Center — Phase 1 of the Agentic Automation dashboard.
 *
 * Reads from `public.command_center_snapshot`, a security-invoker view
 * (no RLS bypass — returns only what the logged-in admin's own policies
 * already allow) that aggregates:
 *   - Catalog Automation Agent: pending review / missing category counts
 *   - WhatsApp Agent: inbound message volume, last 24h
 *   - Pipeline: recent activity + active early-stage leads
 *
 * This is intentionally a polling dashboard, not push-based: the source
 * is a VIEW (computed on read), and Supabase Realtime only streams
 * changes on physical tables. When more agents come online, extend the
 * view with more columns — this page just renders whatever the view returns.
 */

type Snapshot = {
  catalog_pending_review: number;
  catalog_missing_category: number;
  whatsapp_messages_24h: number;
  pipeline_events_24h: number;
  leads_active_stage_early: number;
  snapshot_generated_at: string;
};

const POLL_MS = 30_000;

function StatCard({
  label,
  value,
  hint,
  attention,
}: {
  label: string;
  value: number;
  hint: string;
  attention?: boolean;
}) {
  return (
    <Card className={attention ? "border-amber-300 bg-amber-50" : ""}>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
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

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Catalog, WhatsApp, ഒപ്പം pipeline status — ഒറ്റ നോട്ടത്തിൽ.
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Catalog — Pending Review"
            value={snapshot.catalog_pending_review}
            hint="Supervisor approval waiting"
            attention={snapshot.catalog_pending_review > 0}
          />
          <StatCard
            label="Catalog — Missing Category"
            value={snapshot.catalog_missing_category}
            hint="main_category_id unset"
            attention={snapshot.catalog_missing_category > 0}
          />
          <StatCard
            label="WhatsApp — Last 24h"
            value={snapshot.whatsapp_messages_24h}
            hint="Inbound messages logged"
          />
          <StatCard
            label="Pipeline Events — 24h"
            value={snapshot.pipeline_events_24h}
            hint="All source types"
          />
          <StatCard
            label="Active Early-Stage Leads"
            value={snapshot.leads_active_stage_early}
            hint="Client Hub / Dimensions — last 7 days"
          />
        </div>
      )}

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Phase 1 · read-only aggregation · security-invoker view (no RLS bypass) ·
        extend <code>command_center_snapshot</code> as more agents come online.
      </p>
    </AdminShell>
  );
};

export default AdminCommandCenter;
