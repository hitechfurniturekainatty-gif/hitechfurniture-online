import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Truck, Navigation2, Route as RouteIcon, Sparkles, Warehouse as WarehouseIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { LeafletMap, coloredIcon } from "@/components/logistics/LeafletMap";
import { Marker, Popup } from "react-leaflet";
import { RoutePolyline } from "@/components/logistics/RoutePolyline";
import { HUB, type RouteWithWaypoints } from "@/lib/logistics";
import { formatINR } from "@/lib/brand";

type PendingQ = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  delivery_route_id: string | null;
  delivery_place: string | null;
  status: string;
  total: number;
};

const AdminLogistics = () => {
  const { isOfficeStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [pending, setPending] = useState<PendingQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedRoute, setHighlightedRoute] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: w }, { data: q }, { data: tq }] = await Promise.all([
      supabase.from("delivery_routes").select("*").eq("is_active", true).order("name"),
      supabase.from("route_waypoints").select("*").order("display_order"),
      supabase
        .from("quotations")
        .select("id, quotation_id, party_name, party_place, party_phone, delivery_route_id, delivery_place, status, total, expected_delivery_date")
        // Finalized orders (advance received OR manually finalized) with a
        // delivery date set are ready to schedule.
        .eq("status", "finalized")
        .not("expected_delivery_date", "is", null),
      supabase
        .from("trip_quotations")
        .select("quotation_id, delivered_at, trip_id, trips!inner(status)"),
    ]);
    const merged: RouteWithWaypoints[] = (r ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      destination_name: row.destination_name,
      destination_lat: Number(row.destination_lat),
      destination_lng: Number(row.destination_lng),
      color: row.color,
      is_active: row.is_active,
      waypoints: ((w ?? []) as any[])
        .filter((x) => x.route_id === row.id)
        .map((x) => ({ id: x.id, name: x.name, lat: Number(x.lat), lng: Number(x.lng), display_order: x.display_order })),
    }));
    setRoutes(merged);
    // Filter out quotations that are on a delivered trip
    const deliveredQids = new Set(
      ((tq ?? []) as any[])
        .filter((x) => x.trips?.status === "delivered" || x.delivered_at)
        .map((x) => x.quotation_id)
    );
    setPending(((q ?? []) as PendingQ[]).filter((x) => !deliveredQids.has(x.id)));
    setLoading(false);
  };

  useEffect(() => {
    if (isOfficeStaff) load();
  }, [isOfficeStaff]);

  const grouped = useMemo(() => {
    const map = new Map<string | "untagged", PendingQ[]>();
    for (const p of pending) {
      const key = p.delivery_route_id ?? "untagged";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [pending]);

  const visibleRoutes = highlightedRoute ? routes.filter((r) => r.id === highlightedRoute) : routes;

  const suggestTrip = () => {
    // Pick route: highlighted if any, else the one with most pending deliveries
    let targetRouteId = highlightedRoute;
    if (!targetRouteId) {
      let best: { id: string; count: number } | null = null;
      for (const r of routes) {
        const c = (grouped.get(r.id) ?? []).length;
        if (c > 0 && (!best || c > best.count)) best = { id: r.id, count: c };
      }
      targetRouteId = best?.id ?? null;
    }
    if (!targetRouteId) {
      toast({ title: "Nothing to suggest", description: "No pending deliveries on any route.", variant: "destructive" });
      return;
    }
    const items = grouped.get(targetRouteId) ?? [];
    if (items.length === 0) {
      toast({ title: "No pending deliveries on this route", variant: "destructive" });
      return;
    }
    // Sort by descending order value so high-value drops are prioritised
    const ordered = [...items].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
    const qids = ordered.map((x) => x.id).join(",");
    navigate(`/admin/trips?new=1&route=${targetRouteId}&qs=${qids}`);
  };

  if (!isOfficeStaff) {
    return (
      <AdminShell>
        <p className="text-muted-foreground">Office staff or admin access required.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Logistics Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Pending deliveries from <span className="font-medium text-foreground">{HUB.name}, {HUB.place}</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={suggestTrip} variant="default">
            <Sparkles className="mr-2 h-4 w-4" /> Suggest trip
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/trips"><Truck className="mr-2 h-4 w-4" /> Trips</Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to="/admin/routes"><RouteIcon className="mr-2 h-4 w-4" /> Manage routes</Link>
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Sidebar: route load summary */}
          <div className="space-y-2">
            <button
              onClick={() => setHighlightedRoute(null)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                highlightedRoute === null ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
              }`}
            >
              <span className="font-medium">All routes</span>
              <span className="ml-2 text-xs text-muted-foreground">({pending.length} pending)</span>
            </button>
            {routes.map((r) => {
              const items = grouped.get(r.id) ?? [];
              const totalValue = items.reduce((s, x) => s + (Number(x.total) || 0), 0);
              return (
                <button
                  key={r.id}
                  onClick={() => setHighlightedRoute(r.id === highlightedRoute ? null : r.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    highlightedRoute === r.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
                      <span className="truncate font-medium">{r.name}</span>
                    </div>
                    <Badge variant={items.length > 0 ? "default" : "outline"} className="shrink-0">
                      {items.length}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {items.length > 0 ? `${formatINR(totalValue)} pending` : "No pending deliveries"}
                  </p>
                </button>
              );
            })}
            {grouped.has("untagged") && (
              <div className="rounded-lg border border-dashed border-accent bg-accent/10 px-3 py-2 text-xs">
                <p className="font-medium">Untagged: {(grouped.get("untagged") ?? []).length}</p>
                <p className="text-[11px] text-muted-foreground">Open these quotations to set a delivery route.</p>
              </div>
            )}
            <Button onClick={() => navigate("/admin/trips?new=1")} className="mt-3 w-full">
              <Truck className="mr-2 h-4 w-4" /> Plan a trip
            </Button>
          </div>

          {/* Map */}
          <div className="space-y-3">
            <LeafletMap
              height={520}
              fitBounds={
                highlightedRoute
                  ? (() => {
                      const r = routes.find((x) => x.id === highlightedRoute);
                      if (!r) return [[HUB.lat, HUB.lng]];
                      return [
                        [HUB.lat, HUB.lng],
                        ...r.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
                        [r.destination_lat, r.destination_lng] as [number, number],
                      ];
                    })()
                  : undefined
              }
            >
              {visibleRoutes.map((r) => {
                const stops = [
                  { lat: HUB.lat, lng: HUB.lng },
                  ...r.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
                  { lat: r.destination_lat, lng: r.destination_lng },
                ];
                const items = grouped.get(r.id) ?? [];
                return (
                  <div key={r.id}>
                    <RoutePolyline stops={stops} color={r.color} weight={highlightedRoute === r.id ? 6 : 4} />
                    {r.waypoints.map((w, i) => (
                      <Marker key={`${r.id}-w${i}`} position={[w.lat, w.lng]} icon={coloredIcon(r.color, String(i + 1))}>
                        <Popup>{w.name} ({r.name})</Popup>
                      </Marker>
                    ))}
                    <Marker
                      position={[r.destination_lat, r.destination_lng]}
                      icon={coloredIcon(r.color, items.length ? String(items.length) : "✓")}
                    >
                      <Popup>
                        <strong>{r.destination_name}</strong>
                        <br />
                        {items.length} pending deliveries
                        {items.slice(0, 5).map((it) => (
                          <div key={it.id} className="mt-1 text-xs">
                            • {it.quotation_id} — {it.party_name}
                          </div>
                        ))}
                      </Popup>
                    </Marker>
                  </div>
                );
              })}
            </LeafletMap>

            {/* Pending list for the highlighted route (or all) */}
            <div className="grid gap-2">
              {(highlightedRoute ? grouped.get(highlightedRoute) ?? [] : pending).map((p) => {
                const r = routes.find((x) => x.id === p.delivery_route_id);
                return (
                  <Card key={p.id}>
                    <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold">{p.quotation_id}</span>
                          <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                          {r && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
                              {r.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{p.party_name} · {p.delivery_place || p.party_place}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold">{formatINR(p.total)}</span>
                        <Button asChild size="sm" variant="ghost" title="Open this order in the Warehouse view">
                          <Link to={`/admin/warehouse#q-${p.id}`}>
                            <WarehouseIcon className="mr-1 h-3.5 w-3.5" />Warehouse
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/quotations/${p.id}`}>Open</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {pending.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  No pending deliveries. Quotations marked Accepted or Completed will appear here.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminLogistics;