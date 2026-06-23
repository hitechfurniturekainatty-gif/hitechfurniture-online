import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone, MessageCircle, Check, MapPin, Truck, FileText, IndianRupee, Eye, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { LeafletMap, coloredIcon } from "@/components/logistics/LeafletMap";
import { Marker, Popup } from "react-leaflet";
import { RoutePolyline } from "@/components/logistics/RoutePolyline";
import { HUB, tripStatusLabel, tripStatusVariant, type RouteWithWaypoints } from "@/lib/logistics";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/brand";
import { firstUrl } from "@/lib/firstUrl";

type Trip = {
  id: string;
  route_id: string | null;
  trip_date: string;
  status: string;
  notes: string | null;
};
type TripQ = { id: string; trip_id: string; quotation_id: string; stop_order: number; delivered_at: string | null };
type Q = {
  id: string; quotation_id: string; party_name: string; party_place: string;
  party_phone: string | null; party_address: string | null; delivery_place: string | null;
  total: number; advance_amount: number | null; show_price_to_delivery: boolean;
};
type QExt = Q & { expected_delivery_date: string | null };

type PricingItem = {
  id: string; description: string; quantity: number;
  unit_price: number; amount: number;
};

// Item details visible to the delivery team (no prices). Used to render the
// load-checklist under each stop so the driver can verify what's going out.
type DeliveryItem = {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  measurement: string | null;
  item_image_url: string | null;
  sketch_url: string | null;
};

const AdminMyTrips = () => {
  const { user, isDelivery, isOfficeStaff } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripQs, setTripQs] = useState<TripQ[]>([]);
  const [quotes, setQuotes] = useState<Q[]>([]);
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrip, setActiveTrip] = useState<string | null>(null);
  const [pricingFor, setPricingFor] = useState<Q | null>(null);
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [savingToggleId, setSavingToggleId] = useState<string | null>(null);

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
          .select("id, quotation_id, party_name, party_place, party_phone, party_address, delivery_place, expected_delivery_date, total, advance_amount, show_price_to_delivery")
          .in("id", qids);
        setQuotes((qs ?? []) as Q[]);
        const { data: itemRows } = await supabase
          .from("quotation_items")
          .select("id, quotation_id, description, quantity, measurement, item_image_url, sketch_url")
          .in("quotation_id", qids)
          .order("display_order", { ascending: true });
        setDeliveryItems((itemRows ?? []) as DeliveryItem[]);
      } else {
        setQuotes([]);
        setDeliveryItems([]);
      }
    } else {
      setTripQs([]);
      setQuotes([]);
      setDeliveryItems([]);
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
    toast({ title: "Marked delivered" });
    // If all stops on this trip are delivered, mark trip delivered. Else, mark in_transit.
    const tripStops = tripQs.filter((x) => x.trip_id === stop.trip_id);
    const allDelivered = tripStops.every((x) => x.id === stop.id || x.delivered_at);
    const newStatus = allDelivered ? "delivered" : "in_transit";
    await supabase.from("trips").update({ status: newStatus }).eq("id", stop.trip_id);
    load();
  };

  // Admin/OPS only — flip the per-quotation price visibility for the delivery team.
  // Delivery role itself is blocked at the RLS layer (quotations_update policy).
  const togglePriceVisibility = async (q: Q, next: boolean) => {
    setSavingToggleId(q.id);
    const { error } = await supabase
      .from("quotations")
      .update({ show_price_to_delivery: next })
      .eq("id", q.id);
    setSavingToggleId(null);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    setQuotes((prev) => prev.map((row) => (row.id === q.id ? { ...row, show_price_to_delivery: next } : row)));
    toast({ title: next ? "Pricing visible to delivery" : "Pricing hidden from delivery" });
  };

  const openPricing = async (q: Q) => {
    setPricingFor(q);
    setPricingItems([]);
    setPricingLoading(true);
    const { data, error } = await supabase
      .from("quotation_items")
      .select("id, description, quantity, unit_price, amount")
      .eq("quotation_id", q.id)
      .order("display_order", { ascending: true });
    setPricingLoading(false);
    if (error) {
      toast({ title: "Couldn't load pricing", description: error.message, variant: "destructive" });
      return;
    }
    setPricingItems((data ?? []) as PricingItem[]);
  };

  // "Collect from Customer" amount per spec: balance = total − advance
  // (full total when no advance has been recorded).
  const balanceToCollect = (q: Q | undefined) => {
    if (!q) return 0;
    const adv = Number(q.advance_amount ?? 0);
    return Math.max(Number(q.total ?? 0) - adv, 0);
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
                {stops.map((s, i) => (
                  <Card key={s.id}>
                    <CardContent className="flex flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                          {i + 1}
                        </span>
                        <span className="font-mono text-xs font-semibold">{s.q?.quotation_id}</span>
                        {s.delivered_at && <Badge variant="default" className="text-[10px]">Delivered</Badge>}
                      </div>
                      <p className="text-sm font-medium">{s.q?.party_name}</p>
                      <p className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        {s.q?.party_address || s.q?.delivery_place || s.q?.party_place}
                      </p>

                      {/* Payment breakdown — always visible to the driver so they can
                          verify Total / Advance received / Balance with the customer
                          on the doorstep. Not gated behind show_price_to_delivery. */}
                      {s.q && (
                        <div className="rounded-lg border-2 border-emerald-500/50 bg-emerald-500/10 px-3 py-2">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-emerald-900/80 dark:text-emerald-200/80">Total (incl. GST)</span>
                            <span className="font-semibold text-emerald-900 dark:text-emerald-100">{formatINR(Number(s.q.total ?? 0))}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-emerald-900/80 dark:text-emerald-200/80">Advance received</span>
                            <span className="font-semibold text-emerald-900 dark:text-emerald-100">{formatINR(Number(s.q.advance_amount ?? 0))}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 border-t border-emerald-500/40 pt-1.5">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Balance to Collect
                              </p>
                              <p className="font-display text-xl font-bold text-emerald-800 dark:text-emerald-200">
                                {formatINR(balanceToCollect(s.q))}
                              </p>
                            </div>
                            <IndianRupee className="h-6 w-6 text-emerald-600/70 dark:text-emerald-400/70" />
                          </div>
                        </div>
                      )}

                      {/* Admin / OPS toggle to allow driver to open the per-line-item
                          pricing dialog. The three-line summary above is always shown
                          regardless of this flag. */}
                      {s.q && isOfficeStaff && (
                        <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold">Show Item-wise Pricing to Driver</p>
                            <p className="text-[11px] text-muted-foreground">
                              {s.q.show_price_to_delivery
                                ? "Driver can open ‘View Full Pricing’ for the line-item breakdown."
                                : "Hidden — driver still sees Total / Advance / Balance, just not per-item rates."}
                            </p>
                          </div>
                          <Switch
                            checked={s.q.show_price_to_delivery}
                            onCheckedChange={(v) => s.q && togglePriceVisibility(s.q, v)}
                            disabled={savingToggleId === s.q.id}
                            aria-label="Show price to delivery team"
                          />
                        </div>
                      )}

                      {/* Lock indicator for delivery role when item-wise pricing is hidden. */}
                      {s.q && isDelivery && !s.q.show_price_to_delivery && (
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Lock className="h-3 w-3" /> Item-wise pricing hidden by office.
                        </p>
                      )}

                      {/* Load checklist — what the driver is actually delivering.
                          No prices, just photo + description + qty + measurement so
                          items can be physically verified against the truck. */}
                      {s.q && (() => {
                        const items = deliveryItems.filter((it) => it.quotation_id === s.q!.id);
                        if (items.length === 0) return null;
                        return (
                          <div className="rounded-md border border-border bg-muted/20 p-2">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Items to deliver ({items.length})
                            </p>
                            <ul className="space-y-1.5">
                              {items.map((it) => {
                                const thumb = firstUrl(it.item_image_url) ?? firstUrl(it.sketch_url);
                                return (
                                  <li key={it.id} className="flex items-start gap-2 rounded border border-border/50 bg-background p-1.5">
                                    {thumb ? (
                                      <img
                                        src={thumb}
                                        alt={it.description}
                                        loading="lazy"
                                        className="h-12 w-12 shrink-0 rounded object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                                        No photo
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium leading-tight">{it.description}</p>
                                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        Qty: <span className="font-semibold text-foreground">{it.quantity}</span>
                                        {it.measurement && (
                                          <> · {it.measurement}</>
                                        )}
                                      </p>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })()}

                      <div className="flex flex-wrap gap-2">
                        {s.q?.party_phone && (
                          <>
                            <Button asChild size="sm" variant="outline">
                              <a href={`tel:${s.q.party_phone}`}><Phone className="mr-1.5 h-3.5 w-3.5" /> Call</a>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                              <a href={`https://wa.me/${s.q.party_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                                <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                              </a>
                            </Button>
                          </>
                        )}
                        {s.q && (
                          <Button asChild size="sm" variant="secondary">
                            <Link to={`/delivery-note/${s.q.id}`}>
                              <FileText className="mr-1.5 h-3.5 w-3.5" /> Delivery slip
                            </Link>
                          </Button>
                        )}
                        {s.q && s.q.show_price_to_delivery && (
                          <Button size="sm" variant="outline" onClick={() => s.q && openPricing(s.q)}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View Full Pricing
                          </Button>
                        )}
                        {!s.delivered_at && (
                          <Button size="sm" onClick={() => markDelivered(s)} className="ml-auto">
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Mark delivered
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Item-wise price breakdown — only opens when admin has flipped the toggle. */}
      <Dialog open={!!pricingFor} onOpenChange={(o) => !o && setPricingFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Full Pricing — {pricingFor?.quotation_id}</DialogTitle>
          </DialogHeader>
          {pricingLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[50vh] space-y-1 overflow-y-auto rounded-md border border-border">
                {pricingItems.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{it.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {it.quantity} × {formatINR(Number(it.unit_price))}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-semibold">{formatINR(Number(it.amount))}</p>
                  </div>
                ))}
                {pricingItems.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">No line items.</p>
                )}
              </div>
              {pricingFor && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total (incl. GST)</span><span className="font-semibold">{formatINR(Number(pricingFor.total ?? 0))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Advance paid</span><span>{formatINR(Number(pricingFor.advance_amount ?? 0))}</span></div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1 text-emerald-700 dark:text-emerald-300">
                    <span className="font-semibold">Collect from Customer</span>
                    <span className="font-bold">{formatINR(balanceToCollect(pricingFor))}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminMyTrips;