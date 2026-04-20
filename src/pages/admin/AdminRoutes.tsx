import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, MapPin, Save, ArrowUp, ArrowDown, Route as RouteIcon } from "lucide-react";
import { LeafletMap, coloredIcon } from "@/components/logistics/LeafletMap";
import { Marker, Popup } from "react-leaflet";
import { RoutePolyline } from "@/components/logistics/RoutePolyline";
import { HUB, ROUTE_COLOR_PALETTE, type RouteWithWaypoints } from "@/lib/logistics";

type DraftWaypoint = { id?: string; name: string; lat: number; lng: number; display_order: number };

type DraftRoute = {
  id: string;
  name: string;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  color: string;
  is_active: boolean;
  waypoints: DraftWaypoint[];
};

const blankRoute = (): DraftRoute => ({
  id: "",
  name: "",
  destination_name: "",
  destination_lat: HUB.lat + 0.1,
  destination_lng: HUB.lng + 0.1,
  color: ROUTE_COLOR_PALETTE[0],
  is_active: true,
  waypoints: [],
});

const AdminRoutes = () => {
  const { isAdmin, user } = useAuth();
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftRoute>(blankRoute());
  /** controls whether next map click drops destination or a waypoint */
  const [pickMode, setPickMode] = useState<"destination" | "waypoint">("destination");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: w }] = await Promise.all([
      supabase.from("delivery_routes").select("*").order("created_at", { ascending: false }),
      supabase.from("route_waypoints").select("*").order("display_order"),
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
        .map((x) => ({
          id: x.id,
          name: x.name,
          lat: Number(x.lat),
          lng: Number(x.lng),
          display_order: x.display_order,
        })),
    }));
    setRoutes(merged);
    setLoading(false);
  };
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const startNew = () => {
    setDraft({
      ...blankRoute(),
      color: ROUTE_COLOR_PALETTE[routes.length % ROUTE_COLOR_PALETTE.length],
    });
    setPickMode("destination");
    setOpen(true);
  };

  const startEdit = (r: RouteWithWaypoints) => {
    setDraft({
      id: r.id,
      name: r.name,
      destination_name: r.destination_name,
      destination_lat: r.destination_lat,
      destination_lng: r.destination_lng,
      color: r.color,
      is_active: r.is_active,
      waypoints: r.waypoints.map((w) => ({ id: w.id, name: w.name, lat: w.lat, lng: w.lng, display_order: w.display_order })),
    });
    setPickMode("waypoint");
    setOpen(true);
  };

  const handleMapClick = (latlng: [number, number]) => {
    if (pickMode === "destination") {
      setDraft((d) => ({ ...d, destination_lat: latlng[0], destination_lng: latlng[1] }));
      setPickMode("waypoint"); // next click adds a waypoint
    } else {
      setDraft((d) => ({
        ...d,
        waypoints: [
          ...d.waypoints,
          { name: `Stop ${d.waypoints.length + 1}`, lat: latlng[0], lng: latlng[1], display_order: d.waypoints.length },
        ],
      }));
    }
  };

  const moveWp = (idx: number, dir: -1 | 1) => {
    setDraft((d) => {
      const next = [...d.waypoints];
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= next.length) return d;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      next.forEach((w, i) => (w.display_order = i));
      return { ...d, waypoints: next };
    });
  };

  const removeWp = (idx: number) => {
    setDraft((d) => {
      const next = d.waypoints.filter((_, i) => i !== idx);
      next.forEach((w, i) => (w.display_order = i));
      return { ...d, waypoints: next };
    });
  };

  const renameWp = (idx: number, name: string) => {
    setDraft((d) => ({ ...d, waypoints: d.waypoints.map((w, i) => (i === idx ? { ...w, name } : w)) }));
  };

  const save = async () => {
    if (!draft.name.trim() || !draft.destination_name.trim()) {
      toast({ title: "Route name and destination name are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let routeId = draft.id;
      if (routeId) {
        const { error } = await supabase
          .from("delivery_routes")
          .update({
            name: draft.name.trim(),
            destination_name: draft.destination_name.trim(),
            destination_lat: draft.destination_lat,
            destination_lng: draft.destination_lng,
            color: draft.color,
            is_active: draft.is_active,
          })
          .eq("id", routeId);
        if (error) throw error;
        // Replace waypoints (simpler than diff)
        await supabase.from("route_waypoints").delete().eq("route_id", routeId);
      } else {
        const { data, error } = await supabase
          .from("delivery_routes")
          .insert({
            name: draft.name.trim(),
            destination_name: draft.destination_name.trim(),
            destination_lat: draft.destination_lat,
            destination_lng: draft.destination_lng,
            color: draft.color,
            is_active: draft.is_active,
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (error || !data) throw error;
        routeId = data.id;
      }
      if (draft.waypoints.length) {
        const { error: wErr } = await supabase.from("route_waypoints").insert(
          draft.waypoints.map((w, i) => ({
            route_id: routeId,
            name: w.name.trim() || `Stop ${i + 1}`,
            lat: w.lat,
            lng: w.lng,
            display_order: i,
          }))
        );
        if (wErr) throw wErr;
      }
      toast({ title: draft.id ? "Route updated" : "Route created" });
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: RouteWithWaypoints) => {
    if (!confirm(`Delete route "${r.name}"? Quotations tagged to it will become untagged.`)) return;
    const { error } = await supabase.from("delivery_routes").delete().eq("id", r.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Route deleted" });
      load();
    }
  };

  const draftStops = useMemo(
    () => [
      { lat: HUB.lat, lng: HUB.lng },
      ...draft.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
      { lat: draft.destination_lat, lng: draft.destination_lng },
    ],
    [draft.waypoints, draft.destination_lat, draft.destination_lng]
  );

  if (!isAdmin) {
    return (
      <AdminShell>
        <p className="text-muted-foreground">Only admins can manage delivery routes.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Route Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Hub: <span className="font-medium text-foreground">{HUB.name}, {HUB.place}</span>. Add destination + main stops by clicking on the map.
          </p>
        </div>
        <Button onClick={startNew} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> New route
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {routes.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-1 inline-block h-4 w-4 shrink-0 rounded-full" style={{ background: r.color }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{r.name}</p>
                      <Badge variant={r.is_active ? "default" : "outline"} className="shrink-0">
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hub → {r.waypoints.map((w) => w.name).join(" → ")}
                      {r.waypoints.length > 0 && " → "}
                      {r.destination_name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {routes.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No routes yet. Create one to start tagging quotations.</p>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle>{draft.id ? "Edit route" : "New delivery route"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Route name *</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Mananthavady Route" />
              </div>
              <div className="space-y-1.5">
                <Label>Final destination name *</Label>
                <Input value={draft.destination_name} onChange={(e) => setDraft({ ...draft, destination_name: e.target.value })} placeholder="e.g. Mananthavady" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm">Colour</Label>
              <div className="flex gap-1.5">
                {ROUTE_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, color: c })}
                    style={{ background: c }}
                    className={`h-6 w-6 rounded-full border-2 ${draft.color === c ? "border-foreground" : "border-transparent"}`}
                  />
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                <Label className="text-sm">Active</Label>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium">
                Click on the map to {pickMode === "destination" ? "set the destination pin" : "add a waypoint stop"}.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant={pickMode === "destination" ? "default" : "outline"} onClick={() => setPickMode("destination")}>
                  Set destination
                </Button>
                <Button size="sm" variant={pickMode === "waypoint" ? "default" : "outline"} onClick={() => setPickMode("waypoint")}>
                  Add waypoint
                </Button>
              </div>
            </div>

            <LeafletMap
              height={360}
              onMapClick={handleMapClick}
              fitBounds={draftStops.map((s) => [s.lat, s.lng]) as [number, number][]}
            >
              <RoutePolyline stops={draftStops} color={draft.color} />
              {draft.waypoints.map((w, i) => (
                <Marker key={`wp-${i}`} position={[w.lat, w.lng]} icon={coloredIcon(draft.color, String(i + 1))}>
                  <Popup>{w.name}</Popup>
                </Marker>
              ))}
              <Marker position={[draft.destination_lat, draft.destination_lng]} icon={coloredIcon(draft.color, "✓")}>
                <Popup>{draft.destination_name || "Destination"}</Popup>
              </Marker>
            </LeafletMap>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Waypoints (in order)</Label>
              {draft.waypoints.length === 0 && (
                <p className="text-xs text-muted-foreground">No waypoints yet. Click on the map after switching to "Add waypoint".</p>
              )}
              {draft.waypoints.map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: draft.color }}>
                    {i + 1}
                  </span>
                  <Input value={w.name} onChange={(e) => renameWp(i, e.target.value)} className="h-9" />
                  <Button size="icon" variant="ghost" onClick={() => moveWp(i, -1)} disabled={i === 0} className="h-8 w-8">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => moveWp(i, 1)} disabled={i === draft.waypoints.length - 1} className="h-8 w-8">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeWp(i)} className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminRoutes;