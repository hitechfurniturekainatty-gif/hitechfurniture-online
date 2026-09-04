import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/brand";
import { shareLiveLink } from "@/lib/shareLink";
import {
  CheckCircle2,
  Clock3,
  IndianRupee,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";

type WarehouseRow = {
  id: string;
  quotation_id: string;
  description: string;
  quantity: number;
  fulfillment_route: "ready_stock" | "custom" | null;
  item_image_url: string | null;
  catalog_image_url: string | null;
  measurement_image_url: string | null;
  item_notes: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  quotation_number: string;
  party_name: string;
  party_place: string | null;
  party_phone: string | null;
  party_address: string | null;
  delivery_place: string | null;
  delivery_route_id: string | null;
  expected_delivery_date: string | null;
  advance_amount: number;
  total: number;
  balance_to_collect: number;
  quotation_status: string;
  pipeline_stage: number | null;
  dispatch_vehicle: string | null;
  dispatch_vehicle_number: string | null;
  dispatch_driver_name: string | null;
  dispatch_driver_phone: string | null;
  commercial_status: string | null;
  order_confirmed: boolean;
  warehouse_ready: boolean;
  readiness_label: string;
};

type Vehicle = {
  id: string;
  vehicle_number: string;
  label: string | null;
  driver_user_id: string | null;
  is_active: boolean;
};

type Group = {
  quotationId: string;
  quotationNumber: string;
  partyName: string;
  partyPlace: string | null;
  partyPhone: string | null;
  partyAddress: string | null;
  deliveryPlace: string | null;
  routeId: string | null;
  routeName: string | null;
  expectedDeliveryDate: string | null;
  advanceAmount: number;
  total: number;
  balance: number;
  status: string;
  commercialStatus: string | null;
  dispatchVehicle: string | null;
  dispatchVehicleNumber: string | null;
  dispatchDriverName: string | null;
  dispatchDriverPhone: string | null;
  items: WarehouseRow[];
};

const itemImage = (row: WarehouseRow) =>
  row.item_image_url || row.catalog_image_url || row.measurement_image_url || null;

const vehicleDisplay = (kind?: string | null, number?: string | null) => {
  if (kind === "outside") return `Outside${number ? ` · ${number}` : ""}`;
  return number || "Own vehicle";
};

const AdminWarehouse = () => {
  const { isOfficeStaff, isWarehouse, isDelivery } = useAuth();
  const canAccess = isOfficeStaff || isWarehouse || isDelivery;
  const canDispatch = isOfficeStaff || isWarehouse;
  const canDeliver = isOfficeStaff || isDelivery;

  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [routeMap, setRouteMap] = useState<Record<string, string>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchGroup, setDispatchGroup] = useState<Group | null>(null);
  const [vehicleChoice, setVehicleChoice] = useState("");
  const [outsideNumber, setOutsideNumber] = useState("");
  const [outsideDriver, setOutsideDriver] = useState("");
  const [outsidePhone, setOutsidePhone] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!canAccess) return;
    setLoading(true);
    const [{ data, error }, routeRes, vehicleRes] = await Promise.all([
      supabase
        .from("warehouse_order_items" as any)
        .select("*")
        .eq("order_confirmed", true)
        .is("delivered_at", null)
        .limit(1000),
      supabase.from("delivery_routes").select("id,name").eq("is_active", true).is("deleted_at", null),
      supabase
        .from("delivery_vehicles")
        .select("id,vehicle_number,label,driver_user_id,is_active")
        .eq("is_active", true)
        .order("display_order"),
    ]);

    if (error) {
      toast({ title: "Warehouse load failed", description: error.message, variant: "destructive" });
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(((data ?? []) as unknown as WarehouseRow[]));
    setRouteMap(Object.fromEntries(((routeRes.data ?? []) as any[]).map((r) => [r.id, r.name])));
    setVehicles((vehicleRes.data ?? []) as Vehicle[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const groups = useMemo(() => {
    const byQuote = new Map<string, Group>();
    for (const r of rows) {
      const current = byQuote.get(r.quotation_id) ?? {
        quotationId: r.quotation_id,
        quotationNumber: r.quotation_number,
        partyName: r.party_name,
        partyPlace: r.party_place,
        partyPhone: r.party_phone,
        partyAddress: r.party_address,
        deliveryPlace: r.delivery_place,
        routeId: r.delivery_route_id,
        routeName: r.delivery_route_id ? routeMap[r.delivery_route_id] ?? null : null,
        expectedDeliveryDate: r.expected_delivery_date,
        advanceAmount: Number(r.advance_amount ?? 0),
        total: Number(r.total ?? 0),
        balance: Number(r.balance_to_collect ?? 0),
        status: r.quotation_status,
        commercialStatus: r.commercial_status,
        dispatchVehicle: r.dispatch_vehicle,
        dispatchVehicleNumber: r.dispatch_vehicle_number,
        dispatchDriverName: r.dispatch_driver_name,
        dispatchDriverPhone: r.dispatch_driver_phone,
        items: [],
      };
      current.items.push(r);
      byQuote.set(r.quotation_id, current);
    }
    return Array.from(byQuote.values());
  }, [rows, routeMap]);

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (routeFilter !== "all" && (g.routeId ?? "unassigned") !== routeFilter) return false;
      if (!needle) return true;
      return [g.quotationNumber, g.partyName, g.partyPlace, g.partyPhone, g.deliveryPlace, g.routeName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [groups, routeFilter, search]);

  const readyGroups = filteredGroups.filter((g) =>
    g.items.some((i) => i.warehouse_ready && !i.dispatched_at),
  );
  const transitGroups = filteredGroups.filter((g) =>
    g.items.some((i) => !!i.dispatched_at && !i.delivered_at),
  );

  const summary = useMemo(() => {
    const readyItems = rows.filter((r) => r.warehouse_ready && !r.dispatched_at).length;
    const customReady = rows.filter((r) => r.fulfillment_route === "custom" && r.warehouse_ready && !r.dispatched_at).length;
    const transitItems = rows.filter((r) => !!r.dispatched_at && !r.delivered_at).length;
    const readyOrderIds = new Set(rows.filter((r) => r.warehouse_ready && !r.dispatched_at).map((r) => r.quotation_id));
    const transitOrderIds = new Set(rows.filter((r) => !!r.dispatched_at && !r.delivered_at).map((r) => r.quotation_id));
    const balance = groups
      .filter((g) => readyOrderIds.has(g.quotationId) || transitOrderIds.has(g.quotationId))
      .reduce((sum, g) => sum + g.balance, 0);
    return { readyItems, customReady, transitItems, readyOrders: readyOrderIds.size, transitOrders: transitOrderIds.size, balance };
  }, [rows, groups]);

  const openDispatch = (group: Group) => {
    const allPendingReady = group.items.filter((i) => !i.dispatched_at && !i.delivered_at).every((i) => i.warehouse_ready);
    if (!allPendingReady) {
      toast({
        title: "Order not fully ready",
        description: "One or more custom items are still in Production. Complete the full order before dispatch.",
        variant: "destructive",
      });
      return;
    }
    setDispatchGroup(group);
    setVehicleChoice(vehicles[0]?.id ?? "outside");
    setOutsideNumber(group.dispatchVehicleNumber ?? "");
    setOutsideDriver(group.dispatchDriverName ?? "");
    setOutsidePhone(group.dispatchDriverPhone ?? "");
    setDispatchOpen(true);
  };

  const confirmDispatch = async () => {
    if (!dispatchGroup) return;
    const isOutside = vehicleChoice === "outside";
    const chosen = !isOutside ? vehicles.find((v) => v.id === vehicleChoice) : null;
    const pendingIds = dispatchGroup.items.filter((i) => !i.dispatched_at && !i.delivered_at && i.warehouse_ready).map((i) => i.id);
    const now = new Date().toISOString();
    setSaving(true);

    const { error: qErr } = await supabase
      .from("quotations")
      .update({
        dispatch_vehicle: isOutside ? "outside" : "own",
        dispatch_vehicle_id: isOutside ? null : chosen?.id ?? null,
        dispatch_vehicle_number: isOutside ? (outsideNumber.trim() || null) : (chosen?.vehicle_number ?? null),
        dispatch_driver_id: isOutside ? null : chosen?.driver_user_id ?? null,
        dispatch_driver_name: isOutside ? (outsideDriver.trim() || null) : null,
        dispatch_driver_phone: isOutside ? (outsidePhone.trim() || null) : null,
        dispatched_at: now,
      } as any)
      .eq("id", dispatchGroup.quotationId);

    if (qErr) {
      setSaving(false);
      toast({ title: "Vehicle assignment failed", description: qErr.message, variant: "destructive" });
      return;
    }

    if (pendingIds.length) {
      const { error } = await supabase.from("quotation_items").update({ dispatched_at: now }).in("id", pendingIds);
      if (error) {
        setSaving(false);
        toast({ title: "Dispatch failed", description: error.message, variant: "destructive" });
        return;
      }
    }

    setSaving(false);
    setDispatchOpen(false);
    toast({ title: "Order dispatched", description: `${pendingIds.length} item(s) moved to Logistics.` });
    load();
  };

  const markDelivered = async (row: WarehouseRow) => {
    const { error } = await supabase
      .from("quotation_items")
      .update({ delivered_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Delivery update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item delivered" });
    load();
  };

  const renderGroup = (group: Group, mode: "ready" | "transit") => {
    const pendingItems = group.items.filter((i) => !i.delivered_at);
    const allReady = pendingItems.every((i) => i.warehouse_ready || !!i.dispatched_at);
    const readyCount = pendingItems.filter((i) => i.warehouse_ready || !!i.dispatched_at).length;
    const customPending = pendingItems.filter((i) => i.fulfillment_route === "custom" && !i.warehouse_ready && !i.dispatched_at).length;

    return (
      <Card key={`${mode}-${group.quotationId}`} id={`q-${group.quotationId}`} className="scroll-mt-24 overflow-hidden">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs font-semibold">{group.quotationNumber}</span>
                <Badge variant={allReady ? "secondary" : "outline"} className="text-[10px]">
                  {allReady ? "Full order ready" : `${readyCount}/${pendingItems.length} ready`}
                </Badge>
                {customPending > 0 && <Badge variant="outline" className="text-[10px]">{customPending} custom pending</Badge>}
              </div>
              <p className="mt-1 font-medium">{group.partyName}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{group.deliveryPlace || group.partyPlace || "No delivery place"}</span>
                {group.partyPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{group.partyPhone}</span>}
                <span>{group.routeName || "Route not assigned"}</span>
                {group.expectedDeliveryDate && <span>Due {new Date(group.expectedDeliveryDate).toLocaleDateString("en-IN")}</span>}
              </div>
              {group.partyAddress && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{group.partyAddress}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link to={`/admin/quotations/${group.quotationId}/preview`}>Open</Link>
              </Button>
              {mode === "ready" && canDispatch && (
                <Button size="sm" className="h-8" disabled={!allReady} onClick={() => openDispatch(group)}>
                  <Truck className="mr-1 h-3.5 w-3.5" /> Dispatch
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            {pendingItems.map((item) => {
              const img = itemImage(item);
              return (
                <div key={item.id} className="flex items-center gap-3 border-b p-2.5 last:border-b-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">No photo</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="min-w-0 truncate text-sm font-medium">{item.description}</p>
                      <Badge variant={item.fulfillment_route === "custom" ? "secondary" : "outline"} className="text-[9px]">
                        {item.fulfillment_route === "custom" ? "Custom" : "Ready Stock"}
                      </Badge>
                      <Badge variant={item.warehouse_ready || item.dispatched_at ? "default" : "outline"} className="text-[9px]">
                        {item.dispatched_at ? "In Transit" : item.readiness_label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Qty × {item.quantity}</p>
                    {item.item_notes && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.item_notes}</p>}
                  </div>
                  {mode === "transit" && canDeliver && !!item.dispatched_at && (
                    <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => markDelivered(item)}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Delivered
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {mode === "transit" && group.dispatchVehicle && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              <span><b>Vehicle:</b> {vehicleDisplay(group.dispatchVehicle, group.dispatchVehicleNumber)}</span>
              {group.dispatchDriverName && <span>· {group.dispatchDriverName}</span>}
              {group.dispatchDriverPhone && <span>· {group.dispatchDriverPhone}</span>}
              {(isOfficeStaff || isWarehouse) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7"
                  onClick={() => shareLiveLink({
                    kind: "quotation",
                    rowId: group.quotationId,
                    message: `Delivery note — ${group.partyName} (${group.deliveryPlace || group.partyPlace || ""})`,
                    phone: group.dispatchDriverPhone || null,
                    openWhatsApp: true,
                    path: "/s/d",
                  } as any)}
                >
                  <MessageCircle className="mr-1 h-3.5 w-3.5" /> Delivery note
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Balance to Collect</p>
              <p className="font-display text-xl font-bold text-emerald-800">{formatINR(group.balance)}</p>
              <p className="text-[10px] text-muted-foreground">Advance {formatINR(group.advanceAmount)}</p>
            </div>
            <IndianRupee className="h-5 w-5 text-emerald-600" />
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!canAccess) {
    return <AdminShell><p className="text-muted-foreground">Warehouse, delivery or office access required.</p></AdminShell>;
  }

  const defaultTab = isDelivery && !isOfficeStaff && !isWarehouse ? "transit" : "ready";
  const showReady = isOfficeStaff || isWarehouse;
  const routeOptions = Array.from(new Set(groups.map((g) => g.routeId).filter(Boolean) as string[]));

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Warehouse & Delivery Readiness</h1>
            <p className="mt-1 text-sm text-muted-foreground">Confirmed orders only. Ready-stock and production-complete custom items are consolidated quotation-wise.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1.5 h-4 w-4" />Refresh</Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Ready Orders</p><p className="text-2xl font-bold">{summary.readyOrders}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Ready Items</p><p className="text-2xl font-bold">{summary.readyItems}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Custom Ready</p><p className="text-2xl font-bold">{summary.customReady}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">In Transit</p><p className="text-2xl font-bold">{summary.transitOrders}</p><p className="text-[10px] text-muted-foreground">{summary.transitItems} items</p></CardContent></Card>
          <Card className="col-span-2 sm:col-span-1"><CardContent className="p-3"><p className="text-[10px] uppercase text-muted-foreground">Collection Pending</p><p className="text-lg font-bold">{formatINR(summary.balance)}</p></CardContent></Card>
        </div>

        <Card><CardContent className="flex flex-wrap gap-2 p-3">
          <div className="min-w-[220px] flex-1">
            <Label className="text-xs">Search</Label>
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, quotation, phone, place…" /></div>
          </div>
          <div className="min-w-[180px]">
            <Label className="text-xs">Route</Label>
            <Select value={routeFilter} onValueChange={setRouteFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routes</SelectItem>
                <SelectItem value="unassigned">Route not assigned</SelectItem>
                {routeOptions.map((id) => <SelectItem key={id} value={id}>{routeMap[id] ?? "Route"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent></Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs defaultValue={defaultTab}>
            <TabsList className={`grid w-full ${showReady ? "grid-cols-2" : "grid-cols-1"}`}>
              {showReady && <TabsTrigger value="ready"><PackageCheck className="mr-1.5 h-4 w-4" />Ready ({readyGroups.length})</TabsTrigger>}
              <TabsTrigger value="transit"><Truck className="mr-1.5 h-4 w-4" />In Transit ({transitGroups.length})</TabsTrigger>
            </TabsList>
            {showReady && <TabsContent value="ready" className="mt-4 space-y-3">
              {readyGroups.length ? readyGroups.map((g) => renderGroup(g, "ready")) : <p className="py-8 text-center text-sm text-muted-foreground">No confirmed orders ready for warehouse dispatch.</p>}
            </TabsContent>}
            <TabsContent value="transit" className="mt-4 space-y-3">
              {transitGroups.length ? transitGroups.map((g) => renderGroup(g, "transit")) : <p className="py-8 text-center text-sm text-muted-foreground">Nothing in transit.</p>}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign vehicle & dispatch</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">{dispatchGroup?.partyName}</p>
              <p className="text-xs text-muted-foreground">{dispatchGroup?.quotationNumber} · {dispatchGroup?.routeName || "No route"}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Vehicle</Label>
              <Select value={vehicleChoice} onValueChange={setVehicleChoice}>
                <SelectTrigger><SelectValue placeholder="Choose vehicle" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.vehicle_number}{v.label ? ` · ${v.label}` : ""}</SelectItem>)}
                  <SelectItem value="outside">Outside Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {vehicleChoice === "outside" && <div className="space-y-2">
              <div><Label>Vehicle number</Label><Input value={outsideNumber} onChange={(e) => setOutsideNumber(e.target.value)} placeholder="KL 12 AB 1234" /></div>
              <div><Label>Driver name</Label><Input value={outsideDriver} onChange={(e) => setOutsideDriver(e.target.value)} /></div>
              <div><Label>Driver phone</Label><Input inputMode="tel" value={outsidePhone} onChange={(e) => setOutsidePhone(e.target.value)} /></div>
            </div>}
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              Dispatch is enabled only when every pending item in the order is warehouse-ready.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmDispatch} disabled={saving}>{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Truck className="mr-1.5 h-4 w-4" />}Dispatch full order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminWarehouse;
