import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MousePointerClick, Eye, TrendingUp, Users, Globe, AlertTriangle } from "lucide-react";
import { KpiCard } from "@/components/overview/KpiCard";

type TopQuery = { query: string; clicks: number; impressions: number; position: number };

type Snapshot = {
  snapshot_date: string;
  source: "search_console" | "ga4" | "google_business_profile" | "pagespeed";
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  avg_position: number | null;
  sessions: number | null;
  users: number | null;
  page_views: number | null;
  top_queries: TopQuery[] | null;
  notes: string | null;
};

// SEO/AEO/GEO health — Search Console + GA4 data pulled via Windsor.ai
// connectors into seo_health_snapshots. NOTE: refresh is currently manual
// (ask Claude to pull a fresh snapshot) — a fully automated daily pull needs
// an n8n workflow with its own Google API credentials, which is a separate
// setup task, not yet built. This section is honest about that gap via the
// "as of" date rather than implying a live feed.
export const AdminSeoHealthDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [scSnapshot, setScSnapshot] = useState<Snapshot | null>(null);
  const [ga4Snapshot, setGa4Snapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("seo_health_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (!error && data) {
        setScSnapshot((data as Snapshot[]).find((r) => r.source === "search_console") ?? null);
        setGa4Snapshot((data as Snapshot[]).find((r) => r.source === "ga4") ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!scSnapshot && !ga4Snapshot) {
    return (
      <div>
        <h2 className="font-display text-xl text-foreground sm:text-2xl">SEO / AEO / GEO Health</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No snapshot yet. Ask Claude to pull the latest Search Console + GA4 data.
        </p>
      </div>
    );
  }

  const asOf = (scSnapshot ?? ga4Snapshot)?.snapshot_date;
  const topQueries = (scSnapshot?.top_queries ?? []).slice(0, 6);
  const zeroClickHighImpression = topQueries.filter((q) => q.clicks === 0 && q.impressions >= 8);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl text-foreground sm:text-2xl">SEO / AEO / GEO Health</h2>
        {asOf && (
          <p className="text-xs text-muted-foreground">
            As of {new Date(asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · last 28 days · manual refresh
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Search clicks"
          value={String(scSnapshot?.clicks ?? "—")}
          icon={MousePointerClick}
          sub="Google Search Console, 28d"
        />
        <KpiCard
          label="Impressions"
          value={String(scSnapshot?.impressions ?? "—")}
          icon={Eye}
          sub="Google Search Console, 28d"
        />
        <KpiCard
          label="Avg. position"
          value={scSnapshot?.avg_position != null ? scSnapshot.avg_position.toFixed(1) : "—"}
          icon={TrendingUp}
          sub="Across tracked queries"
        />
        <KpiCard
          label="Website sessions"
          value={String(ga4Snapshot?.sessions ?? "—")}
          icon={Users}
          sub={`${ga4Snapshot?.users ?? 0} users · GA4, 28d`}
        />
      </div>

      {topQueries.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4 text-primary" /> Top search queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Query</th>
                    <th className="py-2 pr-3 font-medium">Clicks</th>
                    <th className="py-2 pr-3 font-medium">Impressions</th>
                    <th className="py-2 font-medium">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueries.map((q) => (
                    <tr key={q.query} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pr-3 text-foreground">{q.query}</td>
                      <td className="py-2 pr-3">{q.clicks}</td>
                      <td className="py-2 pr-3">{q.impressions}</td>
                      <td className="py-2">{q.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {zeroClickHighImpression.length > 0 && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-foreground/80">
            {zeroClickHighImpression.length} quer{zeroClickHighImpression.length === 1 ? "y has" : "ies have"} decent
            impressions but 0 clicks (e.g. "{zeroClickHighImpression[0].query}" — {zeroClickHighImpression[0].impressions}{" "}
            impressions, position {zeroClickHighImpression[0].position.toFixed(1)}). Worth reviewing the page title/meta
            description for that ranking to improve click-through.
          </p>
        </div>
      )}

      {scSnapshot?.notes && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{scSnapshot.notes}</p>
      )}
    </div>
  );
};

export default AdminSeoHealthDashboard;
