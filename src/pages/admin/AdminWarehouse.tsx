import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2, PackageCheck, Truck, CheckCircle2, RefreshCw, IndianRupee } from "lucide-react";
import { formatINR } from "@/lib/brand";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const vehicleDisplay = (kind?: string | null, number?: string | null) => {
  if (kind === "outside") return `Outside${number ? ` · ${number}` : ""}`;
  if (number) return number;
  return "—";
};

type Vehicle = {
  id: string;
  vehicle_number: string;
  label: string | null;
  driver_user_id: string | null;
  is_active: boolean;
};

// Quotation-grouped workspace for warehouse / dispatch / delivery staff.
// Only Ready-Stock items are shown (Custom items live in Production).
// Each quotation card shows the balance the driver must collect.
type Row = {
  id: string;
  description: string;
  quantity: number;
  fulfillment_route: "ready_stock" | "custom";
  dispatched_at: string | null;
  delivered_at: string | null;
  quotation_id: string;
  quotations: {
    id: string;
    quotation_id: string;
    party_name: string;
    party_place: string;
    status: string;
    advance_amount: number;
    total: number;
    pipeline_stage?: number | null;
    dispatch_vehicle?: string | null;
    dispatch_vehicle_number?: string | null;
    dispatch_driver_name?: string | null;
    dispatch_driver_phone?: string | null;
  } | null;
};

const AdminWarehouse = () => {
  const { isOfficeStaff, isWarehouse, isDelivery } = useAuth();
  const canAccess = isOfficeStaff || isWarehouse || isDelivery;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  // Dispatch-assignment dialog state
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchGroup, setDispatchGroup] = useState<{ q: Row["quotations"]; items: Row[] } | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // Either a vehicle row id, or the literal "outside"
  const [vehicleChoice, setVehicleChoice] = useState<string>("");
  const [outsideNumber, setOutsideNumber] = useState("");
  const [outsideDriver, setOutsideDriver] = useState("");
  const [outsidePhone, setOutsidePhone] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // Pull every item that is NOT delivered yet, on a non-deleted quotation
    // that has been at least finalized (advance recorded or status != drafted).
    const { data, error } = await supabase
      .from("quotation_items")
      .select(
        "id, description, quantity, fulfillment_route, dispatched_at, delivered_at, quotation_id, quotations!inner(id, quotation_id, party_name, party_place, status, advance_amount, total, pipeline_stage, deleted_at, dispatch_vehicle, dispatch_vehicle_number, dispatch_driver_name, dispatch_driver_phone)"
      )
      .is("delivered_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const filtered = ((data ?? []) as any[]).filter((r) => {
      const q = r.quotations;
      if (!q || q.deleted_at) return false;
      // Show anything that has moved past the Client Hub stage — finalized,
      // advance-paid, OR explicitly bumped into Production/Warehouse/Logistics
      // by the pipeline auto-advance triggers.
      if (Number(q.advance_amount) > 0) return true;
      if ((q.pipeline_stage ?? 1) >= 3) return true;
      return q.status !== "drafted";
    }) as Row[];
    setRows(filtered);
    setLoading(false);
  };

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess]);

  // Load the master vehicle list for the dispatch dialog
  useEffect(() => {
    if (!canAccess) return;
    supabase
      .from("delivery_vehicles")
      .select("id, vehicle_number, label, driver_user_id, is_active")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => setVehicles((data ?? []) as Vehicle[]));
  }, [canAccess]);

  const buckets = useMemo(() => {
    // Warehouse + Delivery should only ever see Ready-Stock items.
    // Custom items remain hidden in Production until that team moves them.
    const readyItems = rows.filter((r) => r.fulfillment_route === "ready_stock");
    const ready: Row[] = readyItems.filter((r) => !r.dispatched_at);
    const inTransit: Row[] = readyItems.filter((r) => !!r.dispatched_at);
    return { ready, inTransit };
  }, [rows]);

  // Group a flat list of items by their parent quotation so each card
  // represents one full order (per the "view in quotations wise" rule).
  const groupByQuotation = (list: Row[]) => {
    const map = new Map<string, { q: Row["quotations"]; items: Row[] }>();
    for (const r of list) {
      if (!r.quotations) continue;
      const key = r.quotations.id;
      const bucket = map.get(key) ?? { q: r.quotations, items: [] };
      bucket.items.push(r);
      map.set(key, bucket);
    }
    return Array.from(map.values());
  };

  const balanceFor = (q: Row["quotations"]) =>
    Math.max(Number(q?.total ?? 0) - Number(q?.advance_amount ?? 0), 0);

  const markDispatched = async (row: Row) => {
    const { error } = await supabase
      .from("quotation_items")
      .update({ dispatched_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    toast({ title: "Marked dispatched" });
    load();
  };

  // Dispatch every still-pending ready-stock item on a quotation in one tap.
  const openDispatchDialog = (group: { q: Row["quotations"]; items: Row[] }) => {
    setDispatchGroup(group);
    const preset = (group.q as any)?.dispatch_vehicle_id as string | undefined;
    setVehicleChoice(preset || (vehicles[0]?.id ?? "outside"));
    setOutsideNumber(group.q?.dispatch_vehicle_number || "");
    setOutsideDriver(group.q?.dispatch_driver_name || "");
    setOutsidePhone(group.q?.dispatch_driver_phone || "");
    setDispatchOpen(true);
  };

  const confirmDispatch = async () => {
    if (!dispatchGroup?.q) return;
    const isOutside = vehicleChoice === "outside";
    if (isOutside && !outsideNumber.trim()) {
      toast({ title: "Vehicle number required", variant: "destructive" });
      return;
    }
    const chosen = !isOutside ? vehicles.find((v) => v.id === vehicleChoice) : null;
    setSaving(true);
    const ids = dispatchGroup.items.filter((i) => !i.dispatched_at).map((i) => i.id);
    // 1) Save vehicle assignment on the quotation (must happen BEFORE stage advance,
    // because the dispatch trigger will bump pipeline_stage out of warehouse range).
    const { error: qErr } = await supabase
      .from("quotations")
      .update({
        dispatch_vehicle: isOutside ? "outside" : "own",
        dispatch_vehicle_id: isOutside ? null : chosen?.id ?? null,
        dispatch_vehicle_number: isOutside ? outsideNumber.trim() : (chosen?.vehicle_number ?? null),
        dispatch_driver_id: isOutside ? null : (chosen?.driver_user_id ?? null),
        dispatch_driver_name: isOutside ? (outsideDriver.trim() || null) : null,
        dispatch_driver_phone: isOutside ? (outsidePhone.trim() || null) : null,
        dispatched_at: new Date().toISOString(),
      })
      .eq("id", dispatchGroup.q.id);
    if (qErr) {
      setSaving(false);
      return toast({ title: "Couldn't save vehicle", description: qErr.message, variant: "destructive" });
    }
    // 2) Mark items dispatched (this triggers the move to Logistics stage)
    if (ids.length) {
      const { error } = await supabase
        .from("quotation_items")
        .update({ dispatched_at: new Date().toISOString() })
        .in("id", ids);
      if (error) {
        setSaving(false);
        return toast({ title: "Dispatch failed", description: error.message, variant: "destructive" });
      }
    }
    setSaving(false);
    setDispatchOpen(false);
    toast({
      title: `Dispatched via ${isOutside ? `Outside · ${outsideNumber}` : (chosen?.vehicle_number ?? "vehicle")}`,
    });
    load();
  };

  const markDelivered = async (row: Row) => {
    const { error } = await supabase
      .from("quotation_items")
      .update({ delivered_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    toast({ title: "Marked delivered" });
    load();
  };

  if (!canAccess) {
    return (
      <AdminShell>
        <p className="text-muted-foreground">Warehouse, office staff, delivery or admin access required.</p>
      </AdminShell>
    );
  }

  // Warehouse can dispatch. Delivery can mark delivered. Office can do both.
  const canDispatch = isOfficeStaff || isWarehouse;
  const canDeliver = isOfficeStaff || isDelivery;

  const renderGroup = (
    group: { q: Row["quotations"]; items: Row[] },
    action: "dispatch" | "deliver" | null,
  ) => (
    <Card key={group.q!.id}>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold">{group.q?.quotation_id}</span>
          <Badge variant="outline" className="text-[10px]">{group.q?.status}</Badge>
          <span className="text-xs text-muted-foreground">
            {group.q?.party_name} · {group.q?.party_place}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {action === "dispatch" && canDispatch && (
              <Button
                size="sm"
                variant="default"
                className="h-7"
                onClick={() => openDispatchDialog(group)}
              >
                <Truck className="mr-1 h-3.5 w-3.5" /> Dispatch
              </Button>
            )}
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Link to={`/admin/quotations/${group.q?.id}/preview`}>Open</Link>
          </Button>
          </div>
        </div>

        <ul className="divide-y divide-border rounded-md border border-border">
          {group.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{it.description}</span>
              <span className="shrink-0 text-muted-foreground">× {it.quantity}</span>
              {action === "deliver" && canDeliver && (
                <Button size="sm" variant="outline" className="h-7" onClick={() => markDelivered(it)}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Deliver
                </Button>
              )}
            </li>
          ))}
        </ul>

        {action === "deliver" && group.q?.dispatch_vehicle && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="font-semibold">Vehicle: </span>
            {vehicleDisplay(group.q.dispatch_vehicle, group.q.dispatch_vehicle_number)}
            {group.q.dispatch_driver_name && (
              <span> · Driver: {group.q.dispatch_driver_name}</span>
            )}
            {group.q.dispatch_driver_phone && (
              <span> · {group.q.dispatch_driver_phone}</span>
            )}
          </div>
        )}

        {/* Driver / warehouse balance display — no item prices, only advance + balance. */}
        <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-emerald-500/50 bg-emerald-500/10 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Balance to Collect
            </p>
            <p className="font-display text-lg font-bold text-emerald-800 dark:text-emerald-200">
              {formatINR(balanceFor(group.q))}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Advance received {formatINR(Number(group.q?.advance_amount ?? 0))}
            </p>
          </div>
          <IndianRupee className="h-5 w-5 text-emerald-600/70 dark:text-emerald-400/70" />
        </div>
      </CardContent>
    </Card>
  );

  const readyGroups = groupByQuotation(buckets.ready);
  const transitGroups = groupByQuotation(buckets.inTransit);

  // Delivery role lands on "In Transit" (their actual queue).
  const defaultTab = isDelivery && !isOfficeStaff && !isWarehouse ? "transit" : "ready";
  // Delivery-only users shouldn't even see the Ready (pick) queue.
  const showReadyTab = isOfficeStaff || isWarehouse;

  return (
    <AdminShell>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Warehouse</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quotation-wise picking. Only ready-stock items are shown. Custom items stay in Production.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList className={`grid w-full ${showReadyTab ? "grid-cols-2" : "grid-cols-1"}`}>
            {showReadyTab && (
              <TabsTrigger value="ready">
                <PackageCheck className="mr-1.5 h-4 w-4" /> Ready ({readyGroups.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="transit">
              <Truck className="mr-1.5 h-4 w-4" /> In Transit ({transitGroups.length})
            </TabsTrigger>
          </TabsList>
          {showReadyTab && (
            <TabsContent value="ready" className="mt-4 space-y-2">
              {readyGroups.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nothing waiting to be picked.</p>
              ) : (
                readyGroups.map((g) => renderGroup(g, "dispatch"))
              )}
            </TabsContent>
          )}
          <TabsContent value="transit" className="mt-4 space-y-2">
            {transitGroups.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing dispatched yet.</p>
            ) : (
              transitGroups.map((g) => renderGroup(g, "deliver"))
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign vehicle & dispatch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={vehicleChoice} onValueChange={(v) => setVehicleChoice(v)}>
              {vehicles.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <RadioGroupItem value={v.id} id={`v-${v.id}`} />
                  <Label htmlFor={`v-${v.id}`}>
                    <span className="font-mono">{v.vehicle_number}</span>
                    {v.label ? <span className="ml-2 text-xs text-muted-foreground">({v.label})</span> : null}
                    {!v.driver_user_id && (
                      <span className="ml-2 text-[10px] text-amber-600">no driver linked</span>
                    )}
                  </Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="outside" id="vo" />
                <Label htmlFor="vo">Outside vehicle</Label>
              </div>
            </RadioGroup>
            {vehicleChoice === "outside" && (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="vnum">Vehicle number *</Label>
                  <Input id="vnum" value={outsideNumber} onChange={(e) => setOutsideNumber(e.target.value)} placeholder="e.g. KL 12 AB 1234" />
                </div>
                <div>
                  <Label htmlFor="vdrv">Driver name</Label>
                  <Input id="vdrv" value={outsideDriver} onChange={(e) => setOutsideDriver(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="vphn">Driver phone</Label>
                  <Input id="vphn" value={outsidePhone} onChange={(e) => setOutsidePhone(e.target.value)} inputMode="tel" />
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Admin can link drivers to vehicles under <Link to="/admin/vehicles" className="underline">Vehicles</Link>.
              Outside vehicle dispatches stay visible to all delivery users.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmDispatch} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Truck className="mr-1.5 h-4 w-4" />}
              Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminWarehouse;