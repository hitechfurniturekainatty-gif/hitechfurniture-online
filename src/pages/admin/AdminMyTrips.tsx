import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, MessageCircle, Check, MapPin, Truck, FileText, Wallet, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { LeafletMap, coloredIcon } from "@/components/logistics/LeafletMap";
import { Marker, Popup } from "react-leaflet";
import { RoutePolyline } from "@/components/logistics/RoutePolyline";
import { HUB, tripStatusLabel, tripStatusVariant, type RouteWithWaypoints } from "@/lib/logistics";
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/brand";

type Trip = {
  id: string;
  route_id: string | null;
  trip_date: string;
  status: string;
  notes: string | null;
};
type TripQ = { id: string; trip_id: string; quotation_id: string; stop_order: number; delivered_at: string | null };
type Q = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  party_phone: string | null;
  party_address: string | null;
  delivery_place: string | null;
  total: number;
  advance_amount: number | null;
};
type QItem = { id: string; quotation_id: string; description: string; quantity: number };

const AdminMyTrips = () => {
  const { user, isDelivery, isOfficeStaff, isAdmin } = useAuth();
  // Drivers-only mode: hide pricing internals (subtotal, GST, unit prices).
  // Office/admin still see everything when they open this page.
  const driverOnly = isDelivery && !isOfficeStaff && !isAdmin;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripQs, setTripQs] = useState<TripQ[]>([]);
  const [quotes, setQuotes] = useState<Q[]>([]);
  const [items, setItems] = useState<QItem[]>([]);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrip, setActiveTrip] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const tripsQuery = isOfficeStaff
      ? supabase.from("trips").select("*").order("trip_date", { ascending: false }).limit(50)
      : supabase.from("trips").select("*").eq("assigned_driver_id", user.id).order("trip_date", { ascending: false });
    const [{ data: t }, { data: r }, { data: w }] = await Promise.all([
      tripsQuery,
      supabase.from("delivery_routes").select("*"),
      supabase.from("route_waypoints").select("*").order("display_order"),
    ]);
    setTrips((t ?? []) as Trip[]);
    setRoutes(((r ?? []) as any[]).map((row) => ({
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
    })));

    const tripIds = (t ?? []).map((x: any) => x.id);
    if (tripIds.length) {
      const { data: tq } = await supabase
        .from("trip_quotations")
        .select("*")
        .in("trip_id", tripIds)
        .order("stop_order");
      const qids = ((tq ?? []) as TripQ[]).map((x) => x.quotation_id);
      setTripQs((tq ?? []) as TripQ[]);
      if (qids.length) {
        const { data: qs } = await supabase
          .from("quotations")
          .select("id, quotation_id, party_name, party_place, party_phone, party_address, delivery_place, total, advance_amount")
          .in("id", qids);
        setQuotes((qs ?? []) as Q[]);
        const { data: its } = await supabase
          .from("quotation_items")
          .select("id, quotation_id, description, quantity")
          .in("quotation_id", qids)
          .order("display_order");
        setItems((its ?? []) as QItem[]);
      } else {
        setQuotes([]);
        setItems([]);
      }
    } else {
      setTripQs([]);
      setQuotes([]);
      setItems([]);
    }
    if (!activeTrip && t && t.length) setActiveTrip((t[0] as any).id);
    setLoading(false);
  };

  useEffect(() => {
    if (user && (isDelivery || isOfficeStaff)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isDelivery, isOfficeStaff]);

  const markDelivered = async (stop: TripQ) => {
    const { error } = await supabase
      .from("trip_quotations")
      .update({ delivered_at: new Date().toISOString() })
      .eq("id", stop.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    // Bump the quotation itself to 'delivered' so the pipeline + admin
    // dashboard reflect completion immediately.
    await supabase.from("quotations").update({ status: "delivered" }).eq("id", stop.quotation_id);
    toast({ title: "Marked delivered" });
    // If all stops on this trip are delivered → completed; else in_transit.
    const tripStops = tripQs.filter((x) => x.trip_id === stop.trip_id);
    const allDelivered = tripStops.every((x) => x.id === stop.id || x.delivered_at);
    const newStatus = allDelivered ? "completed" : "in_transit";
    await supabase.from("trips").update({ status: newStatus }).eq("id", stop.trip_id);
    load();
  };

  const trip = trips.find((t) => t.id === activeTrip) ?? trips[0] ?? null;
  const route = trip ? routes.find((r) => r.id === trip.route_id) : null;
  const stops = useMemo(
    () =>
      trip
        ? tripQs
            .filter((x) => x.trip_id === trip.id)
            .map((x) => ({ ...x, q: quotes.find((q) => q.id === x.quotation_id) }))
        : [],
    [trip, tripQs, quotes]
  );

  if (!isDelivery && !isOfficeStaff) {
    return (
      <AdminShell>
        <p className="text-muted-foreground">Delivery team or office staff access required.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4">
        <h1 className="font-display text-2xl sm:text-3xl">My Trips</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Trips assigned to you, starting from the Hub.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : trips.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No trips assigned yet.</p>
      ) : (
        <div className="space-y-4">
          {/* Trip selector tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {trips.map((t) => {
              const r = routes.find((x) => x.id === t.route_id);
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTrip(t.id)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    activeTrip === t.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5" />
                    <span className="font-medium">{r?.name || "Trip"}</span>
                    <Badge variant={tripStatusVariant(t.status)} className="text-[10px]">{tripStatusLabel(t.status)}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t.trip_date}</p>
                </button>
              );
            })}
          </div>

          {trip && (
            <>
              <LeafletMap
                height={360}
                fitBounds={
                  route
                    ? ([
                        [HUB.lat, HUB.lng],
                        ...route.waypoints.map((w) => [w.lat, w.lng] as [number, number]),
                        [route.destination_lat, route.destination_lng] as [number, number],
                      ])
                    : undefined
                }
              >
                {route && (
                  <>
                    <RoutePolyline
                      stops={[
                        { lat: HUB.lat, lng: HUB.lng },
                        ...route.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
                        { lat: route.destination_lat, lng: route.destination_lng },
                      ]}
                      color={route.color}
                      weight={6}
                    />
                    {route.waypoints.map((w, i) => (
                      <Marker key={`wp-${i}`} position={[w.lat, w.lng]} icon={coloredIcon(route.color, String(i + 1))}>
                        <Popup>{w.name}</Popup>
                      </Marker>
                    ))}
                    <Marker position={[route.destination_lat, route.destination_lng]} icon={coloredIcon(route.color, "✓")}>
                      <Popup>{route.destination_name}</Popup>
                    </Marker>
                  </>
                )}
              </LeafletMap>

              {trip.notes && (
                <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">{trip.notes}</p>
              )}

              <div className="space-y-2">
                <h2 className="font-display text-lg">Stops ({stops.length})</h2>
                {stops.map((s, i) => {
                  const q = s.q;
                  const total = Number(q?.total ?? 0);
                  const advance = Number(q?.advance_amount ?? 0);
                  const balance = Math.max(total - advance, 0);
                  const stopItems = q ? items.filter((it) => it.quotation_id === q.id) : [];
                  const expanded = !!openItems[s.id];
                  const address = q?.party_address || q?.delivery_place || q?.party_place || "";
                  const mapsUrl = address
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                    : null;
                  return (
                    <Card key={s.id}>
                      <CardContent className="flex flex-col gap-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                            {i + 1}
                          </span>
                          <span className="font-mono text-xs font-semibold">{q?.quotation_id}</span>
                          {s.delivered_at && <Badge variant="default" className="text-[10px]">Delivered</Badge>}
                        </div>
                        <p className="text-base font-semibold leading-tight">{q?.party_name}</p>

                        {/* Address — tap opens Google Maps */}
                        {address && (
                          <a
                            href={mapsUrl ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start gap-1.5 rounded-md border border-border bg-muted/40 p-2 text-sm leading-snug active:bg-muted"
                          >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span className="flex-1">{address}</span>
                          </a>
                        )}

                        {/* Balance Amount — only label shown, no breakdown */}
                        <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            <Wallet className="h-3.5 w-3.5" /> Balance to collect
                          </span>
                          <span className="font-display text-xl font-semibold text-emerald-700 dark:text-emerald-300">
                            {formatINR(balance)}
                          </span>
                        </div>

                        {/* Items list (description + qty only — no prices) */}
                        {stopItems.length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setOpenItems((m) => ({ ...m, [s.id]: !m[s.id] }))}
                              className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm active:bg-muted"
                            >
                              <span className="flex items-center gap-1.5">
                                <Package className="h-4 w-4" /> {stopItems.length} item{stopItems.length === 1 ? "" : "s"}
                              </span>
                              <span className="text-xs text-muted-foreground">{expanded ? "Hide" : "View"}</span>
                            </button>
                            {expanded && (
                              <ul className="mt-2 space-y-1 rounded-md border border-border bg-muted/30 p-2 text-sm">
                                {stopItems.map((it) => (
                                  <li key={it.id} className="flex items-start justify-between gap-2">
                                    <span className="flex-1 leading-snug">{it.description}</span>
                                    <span className="shrink-0 font-mono text-xs text-muted-foreground">× {Number(it.quantity)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {q?.party_phone && (
                            <>
                              <Button asChild size="sm" variant="outline" className="flex-1 min-w-[6.5rem]">
                                <a href={`tel:${q.party_phone}`}><Phone className="mr-1.5 h-4 w-4" /> Call</a>
                              </Button>
                              <Button asChild size="sm" variant="outline" className="flex-1 min-w-[6.5rem]">
                                <a href={`https://wa.me/${q.party_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                                  <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                                </a>
                              </Button>
                            </>
                          )}
                          {!driverOnly && q && (
                            <Button asChild size="sm" variant="secondary">
                              <Link to={`/delivery-note/${q.id}`}>
                                <FileText className="mr-1.5 h-4 w-4" /> Delivery slip
                              </Link>
                            </Button>
                          )}
                        </div>

                        {!s.delivered_at && (
                          <Button size="lg" onClick={() => markDelivered(s)} className="w-full">
                            <Check className="mr-1.5 h-4 w-4" /> Mark as Delivered
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </AdminShell>
  );
};

export default AdminMyTrips;