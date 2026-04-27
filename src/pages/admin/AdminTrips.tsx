import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Truck, Trash2, Save, Calendar, FileText } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { tripStatusLabel, tripStatusVariant, type RouteWithWaypoints } from "@/lib/logistics";
import { formatINR } from "@/lib/brand";

type Trip = {
  id: string;
  route_id: string | null;
  trip_date: string;
  status: string;
  assigned_driver_id: string | null;
  notes: string | null;
  created_at: string;
};
type Driver = { user_id: string; display_name: string | null; email: string | null };
type PendingQ = {
  id: string;
  quotation_id: string;
  party_name: string;
  party_place: string;
  delivery_route_id: string | null;
  delivery_place: string | null;
  total: number;
  status: string;
  expected_delivery_date: string | null;
};
type TripQ = { id: string; trip_id: string; quotation_id: string; stop_order: number; delivered_at: string | null };

const AdminTrips = () => {
  const { isOfficeStaff, isAdmin, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripQs, setTripQs] = useState<TripQ[]>([]);
  const [pending, setPending] = useState<PendingQ[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    route_id: "",
    trip_date: new Date().toISOString().slice(0, 10),
    assigned_driver_id: "",
    notes: "",
    selectedQs: [] as string[],
  });

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: w }, { data: t }, { data: tq }, { data: q }] = await Promise.all([
      supabase.from("delivery_routes").select("*").eq("is_active", true).order("name"),
      supabase.from("route_waypoints").select("*").order("display_order"),
      supabase.from("trips").select("*").is("deleted_at", null).order("trip_date", { ascending: false }),
      supabase.from("trip_quotations").select("*").order("stop_order"),
      supabase
        .from("quotations")
        .select("id, quotation_id, party_name, party_place, delivery_route_id, delivery_place, total, status, expected_delivery_date")
        // Only quotations the customer has accepted AND with a delivery date set
        // are ready to be grouped into a delivery trip.
        .eq("status", "accepted")
        .not("expected_delivery_date", "is", null)
        .order("expected_delivery_date", { ascending: true }),
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
    setTrips((t ?? []) as Trip[]);
    setTripQs((tq ?? []) as TripQ[]);
    setPending((q ?? []) as PendingQ[]);

    // Load drivers (delivery role) via the same edge function used by Staff page
    try {
      const { data: staff } = await supabase.functions.invoke("list-staff-users");
      const all = (staff?.users ?? []) as any[];
      setDrivers(all.filter((u) => u.role === "delivery").map((u) => ({
        user_id: u.user_id, display_name: u.display_name, email: u.email,
      })));
    } catch {
      setDrivers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOfficeStaff) load();
  }, [isOfficeStaff]);

  // Auto-open new trip dialog if ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") setOpen(true);
  }, [searchParams]);

  // Pre-fill from ?route=<id>&qs=<id,id,id> (from "Suggest trip" on Logistics)
  useEffect(() => {
    if (loading) return;
    const routeParam = searchParams.get("route");
    const qsParam = searchParams.get("qs");
    if (!routeParam && !qsParam) return;
    setDraft((d) => ({
      ...d,
      route_id: routeParam || d.route_id,
      selectedQs: qsParam ? qsParam.split(",").filter(Boolean) : d.selectedQs,
    }));
    setOpen(true);
  }, [loading, searchParams]);

  // Quotations not yet on a trip
  const assignedQids = useMemo(() => new Set(tripQs.map((x) => x.quotation_id)), [tripQs]);
  const unassigned = pending.filter((p) => !assignedQids.has(p.id));

  const filteredForRoute = useMemo(() => {
    let list = unassigned;
    if (draft.route_id) list = list.filter((p) => p.delivery_route_id === draft.route_id);
    if (draft.trip_date) {
      // Show quotations whose expected delivery is on or before the trip date,
      // so a Friday trip can carry overdue Wednesday/Thursday orders too.
      list = list.filter((p) => !p.expected_delivery_date || p.expected_delivery_date <= draft.trip_date);
    }
    return list;
  }, [draft.route_id, draft.trip_date, unassigned]);

  const startNew = () => {
    setDraft({
      route_id: "",
      trip_date: new Date().toISOString().slice(0, 10),
      assigned_driver_id: "",
      notes: "",
      selectedQs: [],
    });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.route_id) {
      toast({ title: "Pick a route", variant: "destructive" });
      return;
    }
    if (draft.selectedQs.length === 0) {
      toast({ title: "Select at least one quotation", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: trip, error: tErr } = await supabase
        .from("trips")
        .insert({
          route_id: draft.route_id,
          trip_date: draft.trip_date,
          assigned_driver_id: draft.assigned_driver_id || null,
          notes: draft.notes || null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (tErr || !trip) throw tErr;
      const rows = draft.selectedQs.map((qid, i) => ({
        trip_id: trip.id,
        quotation_id: qid,
        stop_order: i,
      }));
      const { error: qErr } = await supabase.from("trip_quotations").insert(rows);
      if (qErr) throw qErr;
      toast({ title: "Trip created", description: `${rows.length} stops scheduled.` });
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeTrip = async (t: Trip) => {
    if (!confirm(`Move the trip on ${t.trip_date} to Trash? You can restore it for 30 days.`)) return;
    const { softDelete } = await import("@/lib/softDelete");
    const { error } = await softDelete("trips", t.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      setTrips((prev) => prev.filter((x) => x.id !== t.id));
      setTripQs((prev) => prev.filter((x) => x.trip_id !== t.id));
      toast({ title: "Moved to Trash" });
      load();
    }
  };

  const tripStops = (t: Trip) =>
    tripQs
      .filter((x) => x.trip_id === t.id)
      .map((x) => ({ ...x, q: pending.find((p) => p.id === x.quotation_id) }));

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
          <h1 className="font-display text-2xl sm:text-3xl">Delivery Trips</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">Group accepted orders into trips and assign a driver.</p>
        </div>
        <Button onClick={startNew} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Plan a trip
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {trips.map((t) => {
            const stops = tripStops(t);
            const route = routes.find((r) => r.id === t.route_id);
            const driver = drivers.find((d) => d.user_id === t.assigned_driver_id);
            return (
              <Card key={t.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    {route && (
                      <span className="inline-flex items-center gap-1 font-medium">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ background: route.color }} />
                        {route.name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {t.trip_date}
                    </span>
                    <Badge variant={tripStatusVariant(t.status)}>{tripStatusLabel(t.status)}</Badge>
                    {driver && <span className="text-xs text-muted-foreground">Driver: {driver.display_name || driver.email}</span>}
                    {!driver && t.assigned_driver_id && <span className="text-xs text-muted-foreground">Driver assigned</span>}
                    {!t.assigned_driver_id && <span className="text-xs text-destructive">No driver</span>}
                    <div className="ml-auto flex gap-2">
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => removeTrip(t)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <ol className="space-y-1 pl-4 text-sm">
                    {stops.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                          {i + 1}
                        </span>
                        {s.q ? (
                          <Link to={`/admin/quotations/${s.q.id}`} className="hover:underline">
                            <span className="font-mono text-xs">{s.q.quotation_id}</span> — {s.q.party_name} ({s.q.delivery_place || s.q.party_place})
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Quotation removed</span>
                        )}
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          {s.q && (
                            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                              <Link to={`/delivery-note/${s.q.id}`}>
                                <FileText className="mr-1 h-3 w-3" /> Slip
                              </Link>
                            </Button>
                          )}
                          {s.delivered_at && <Badge variant="default" className="text-[10px]">Delivered</Badge>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            );
          })}
          {trips.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No trips planned yet.</p>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle>Plan a delivery trip</DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Route *</Label>
                <Select value={draft.route_id} onValueChange={(v) => setDraft({ ...draft, route_id: v, selectedQs: [] })}>
                  <SelectTrigger><SelectValue placeholder="Pick a route" /></SelectTrigger>
                  <SelectContent>
                    {routes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Trip date *</Label>
                <Input type="date" value={draft.trip_date} onChange={(e) => setDraft({ ...draft, trip_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Driver</Label>
                <Select value={draft.assigned_driver_id || "__none__"} onValueChange={(v) => setDraft({ ...draft, assigned_driver_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder={drivers.length ? "Pick a driver" : "No delivery accounts yet"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Unassigned —</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.user_id} value={d.user_id}>{d.display_name || d.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. Truck KL-12-AB-3456" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Pending quotations on this route ({filteredForRoute.length})
              </Label>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {filteredForRoute.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    {draft.route_id ? "No unassigned quotations on this route." : "Pick a route to see quotations."}
                  </p>
                )}
                {filteredForRoute.map((p, i) => {
                  const checked = draft.selectedQs.includes(p.id);
                  return (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-muted">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setDraft((d) => ({
                            ...d,
                            selectedQs: v
                              ? [...d.selectedQs, p.id]
                              : d.selectedQs.filter((x) => x !== p.id),
                          }));
                        }}
                      />
                      <span className="font-mono text-xs">{p.quotation_id}</span>
                      <span className="truncate">{p.party_name} ({p.delivery_place || p.party_place})</span>
                      <span className="ml-auto font-display text-xs">{formatINR(p.total)}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Stop order will follow your selection order.</p>
            </div>
          </div>
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Create trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminTrips;