import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Truck, Route as RouteIcon, Sparkles, Warehouse as WarehouseIcon, CalendarClock } from "lucide-react";
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
  commercial_status?: string | null;
  total: number;
  advance_amount: number;
  expected_delivery_date: string | null;
  ready: boolean;
  assignedTrip: boolean;
};

const dayKey = (iso: string | null) => iso ? new Date(`${iso}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
const dueLabel = (iso: string | null) => {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
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
    const [{ data: r }, { data: w }, { data: q }, { data: tq }, { data: wh }] = await Promise.all([
      supabase.from("delivery_routes").select("*").eq("is_active", true).order("name"),
      supabase.from("route_waypoints").select("*").order("display_order"),
      supabase
        .from("quotations")
        .select("id, quotation_id, party_name, party_place, party_phone, delivery_route_id, delivery_place, status, commercial_status, total, advance_amount, expected_delivery_date")
        .or("status.eq.finalized,commercial_status.eq.confirmed")
        .not("expected_delivery_date", "is", null),
      supabase
        .from("trip_quotations")
        .select("quotation_id, delivered_at, trip_id, trips!inner(status)"),
      (supabase as any)
        .from("warehouse_order_items")
        .select("quotation_id, warehouse_ready, delivered_at")
        .eq("order_confirmed", true),
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

    const deliveredQids = new Set<string>();
    const activeTripQids = new Set<string>();
    for (const x of (tq ?? []) as any[]) {
      if (x.trips?.status === "delivered" || x.delivered_at) deliveredQids.add(x.quotation_id);
      else if (["planned", "assigned", "in_progress", "dispatched"].includes(x.trips?.status)) activeTripQids.add(x.quotation_id);
    }

    const readiness = new Map<string, { total: number; ready: number }>();
    for (const x of (wh ?? []) as any[]) {
      if (x.delivered_at) continue;
      const cur = readiness.get(x.quotation_id) ?? { total: 0, ready: 0 };
      cur.total += 1;
      if (x.warehouse_ready) cur.ready += 1;
      readiness.set(x.quotation_id, cur);
    }

    const rows = ((q ?? []) as any[])
      .filter((x) => !deliveredQids.has(x.id))
      .map((x) => {
        const rr = readiness.get(x.id);
        return {
          ...x,
          advance_amount: Number(x.advance_amount ?? 0),
          total: Number(x.total ?? 0),
          ready: !!rr && rr.total > 0 && rr.ready === rr.total,
          assignedTrip: activeTripQids.has(x.id),
        } as PendingQ;
      });
    setPending(rows);
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
  const readyUnassigned = useMemo(() => pending.filter((p) => p.ready && !p.assignedTrip && !!p.delivery_route_id), [pending]);
  const dueSoonCount = useMemo(() => readyUnassigned.filter((p) => dayKey(p.expected_delivery_date) <= Date.now() + 86400000).length, [readyUnassigned]);

  const suggestTrip = () => {
    const eligible = pending.filter((p) => p.ready && !p.assignedTrip && !!p.delivery_route_id);
    if (!eligible.length) {
      toast({ title: "Nothing ready to suggest", description: "No warehouse-ready, unassigned deliveries are available.", variant: "destructive" });
      return;
    }

    let targetRouteId = highlightedRoute;
    if (targetRouteId && !eligible.some((x) => x.delivery_route_id === targetRouteId)) {
      toast({ title: "No trip-ready orders on this route", description: "Orders may still be in production/warehouse or already assigned.", variant: "destructive" });
      return;
    }

    if (!targetRouteId) {
      const routeScores = routes.map((r) => {
        const items = eligible.filter((x) => x.delivery_route_id === r.id);
        const overdue = items.filter((x) => dayKey(x.expected_delivery_date) < new Date().setHours(0, 0, 0, 0)).length;
        const dueTomorrow = items.filter((x) => dayKey(x.expected_delivery_date) <= Date.now() + 86400000).length;
        return { id: r.id, items, score: overdue * 1000 + dueTomorrow * 100 + items.length * 10 };
      }).filter((x) => x.items.length > 0).sort((a, b) => b.score - a.score);
      targetRouteId = routeScores[0]?.id ?? null;
    }

    if (!targetRouteId) return;
    const items = eligible
      .filter((x) => x.delivery_route_id === targetRouteId)
      .sort((a, b) => {
        const due = dayKey(a.expected_delivery_date) - dayKey(b.expected_delivery_date);
        if (due !== 0) return due;
        const balanceA = Math.max(a.total - a.advance_amount, 0);
        const balanceB = Math.max(b.total - b.advance_amount, 0);
        return balanceB - balanceA;
      });

    const batch = items.slice(0, 8);
    const qids = batch.map((x) => x.id).join(",");
    navigate(`/admin/trips?new=1&route=${targetRouteId}&qs=${qids}`);
    toast({ title: `Suggested ${batch.length} delivery${batch.length === 1 ? "" : "ies"}`, description: "Prioritised by delivery date, readiness and route." });
  };

  if (!isOfficeStaff) {
    return <AdminShell><p className="text-muted-foreground">Office staff or admin access required.</p></AdminShell>;
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Logistics Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Route planning from <span className="font-medium text-foreground">{HUB.name}, {HUB.place}</span> — only warehouse-ready orders are suggested.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={suggestTrip}><Sparkles className="mr-2 h-4 w-4" /> Smart suggest trip</Button>
          <Button asChild variant="outline"><Link to="/admin/trips"><Truck className="mr-2 h-4 w-4" /> Trips</Link></Button>
          {isAdmin && <Button asChild variant="outline"><Link to="/admin/routes"><RouteIcon className="mr-2 h-4 w-4" /> Manage routes</Link></Button>}
        </div>
      </div>

      {!loading && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pending Orders</p><p className="text-2xl font-bold">{pending.length}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Trip Ready</p><p className="text-2xl font-bold">{readyUnassigned.length}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Due / Overdue</p><p className="text-2xl font-bold">{dueSoonCount}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Already Assigned</p><p className="text-2xl font-bold">{pending.filter((p) => p.assignedTrip).length}</p></CardContent></Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            <button onClick={() => setHighlightedRoute(null)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${highlightedRoute === null ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"}`}>
              <span className="font-medium">All routes</span><span className="ml-2 text-xs text-muted-foreground">({pending.length} pending)</span>
            </button>
            {routes.map((r) => {
              const items = grouped.get(r.id) ?? [];
              const tripReady = items.filter((x) => x.ready && !x.assignedTrip).length;
              const totalValue = items.reduce((s, x) => s + x.total, 0);
              return (
                <button key={r.id} onClick={() => setHighlightedRoute(r.id === highlightedRoute ? null : r.id)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${highlightedRoute === r.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2"><span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} /><span className="truncate font-medium">{r.name}</span></div>
                    <Badge variant={tripReady > 0 ? "default" : "outline"}>{tripReady} ready</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{items.length ? `${items.length} pending · ${formatINR(totalValue)}` : "No pending deliveries"}</p>
                </button>
              );
            })}
            {grouped.has("untagged") && <div className="rounded-lg border border-dashed border-accent bg-accent/10 px-3 py-2 text-xs"><p className="font-medium">Untagged: {(grouped.get("untagged") ?? []).length}</p><p className="text-[11px] text-muted-foreground">Set a delivery route before trip planning.</p></div>}
            <Button onClick={() => navigate("/admin/trips?new=1")} className="mt-3 w-full"><Truck className="mr-2 h-4 w-4" /> Plan manually</Button>
          </div>

          <div className="space-y-3">
            <LeafletMap height={520} fitBounds={highlightedRoute ? (() => { const r = routes.find((x) => x.id === highlightedRoute); return r ? [[HUB.lat, HUB.lng], ...r.waypoints.map((w) => [w.lat, w.lng] as [number, number]), [r.destination_lat, r.destination_lng] as [number, number]] : [[HUB.lat, HUB.lng]]; })() : undefined}>
              {visibleRoutes.map((r) => {
                const stops = [{ lat: HUB.lat, lng: HUB.lng }, ...r.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })), { lat: r.destination_lat, lng: r.destination_lng }];
                const items = grouped.get(r.id) ?? [];
                return <div key={r.id}>
                  <RoutePolyline stops={stops} color={r.color} weight={highlightedRoute === r.id ? 6 : 4} />
                  {r.waypoints.map((w, i) => <Marker key={`${r.id}-w${i}`} position={[w.lat, w.lng]} icon={coloredIcon(r.color, String(i + 1))}><Popup>{w.name} ({r.name})</Popup></Marker>)}
                  <Marker position={[r.destination_lat, r.destination_lng]} icon={coloredIcon(r.color, items.length ? String(items.length) : "✓")}><Popup><strong>{r.destination_name}</strong><br />{items.length} pending deliveries{items.slice(0, 5).map((it) => <div key={it.id} className="mt-1 text-xs">• {it.quotation_id} — {it.party_name}</div>)}</Popup></Marker>
                </div>;
              })}
            </LeafletMap>

            <div className="grid gap-2">
              {(highlightedRoute ? grouped.get(highlightedRoute) ?? [] : pending)
                .slice()
                .sort((a, b) => dayKey(a.expected_delivery_date) - dayKey(b.expected_delivery_date))
                .map((p) => {
                  const r = routes.find((x) => x.id === p.delivery_route_id);
                  const balance = Math.max(p.total - p.advance_amount, 0);
                  const due = dueLabel(p.expected_delivery_date);
                  return <Card key={p.id}><CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{p.quotation_id}</span>
                        <Badge variant={p.ready ? "default" : "outline"} className="text-[10px]">{p.ready ? "Warehouse ready" : "Not ready"}</Badge>
                        {p.assignedTrip && <Badge variant="secondary" className="text-[10px]">Trip assigned</Badge>}
                        {due && <Badge variant={dayKey(p.expected_delivery_date) < new Date().setHours(0,0,0,0) ? "destructive" : "outline"} className="text-[10px]"><CalendarClock className="mr-1 h-3 w-3" />{due}</Badge>}
                        {r && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.name}</span>}
                      </div>
                      <p className="text-sm">{p.party_name} · {p.delivery_place || p.party_place}</p>
                      <p className="text-xs text-muted-foreground">Balance to collect: {formatINR(balance)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="ghost"><Link to={`/admin/warehouse#q-${p.id}`}><WarehouseIcon className="mr-1 h-3.5 w-3.5" />Warehouse</Link></Button>
                      <Button asChild size="sm" variant="outline"><Link to={`/admin/quotations/${p.id}`}>Open</Link></Button>
                    </div>
                  </CardContent></Card>;
                })}
              {pending.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No pending deliveries.</p>}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminLogistics;
