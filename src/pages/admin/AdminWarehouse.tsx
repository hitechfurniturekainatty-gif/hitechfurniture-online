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
import { Loader2, PackageCheck, HardHat, Truck, CheckCircle2, RefreshCw } from "lucide-react";

// Hybrid order workspace for warehouse / dispatch staff.
// Splits every line item across three buckets so picking, production
// pressure, and in-transit deliveries are all visible at a glance.
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
  } | null;
};

const AdminWarehouse = () => {
  const { isOfficeStaff } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    setLoading(true);
    // Pull every item that is NOT delivered yet, on a non-deleted quotation
    // that has been at least finalized (advance recorded or status != drafted).
    const { data, error } = await supabase
      .from("quotation_items")
      .select(
        "id, description, quantity, fulfillment_route, dispatched_at, delivered_at, quotation_id, quotations!inner(id, quotation_id, party_name, party_place, status, advance_amount, deleted_at)"
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
      // Only show items on quotations that are at least finalized OR have advance.
      return q.status !== "drafted" || Number(q.advance_amount) > 0;
    }) as Row[];
    setRows(filtered);
    setLoading(false);
  };

  useEffect(() => {
    if (isOfficeStaff) load();
  }, [isOfficeStaff]);

  const buckets = useMemo(() => {
    const ready: Row[] = [];
    const production: Row[] = [];
    const inTransit: Row[] = [];
    for (const r of rows) {
      if (r.dispatched_at) inTransit.push(r);
      else if (r.fulfillment_route === "custom") production.push(r);
      else ready.push(r);
    }
    return { ready, production, inTransit };
  }, [rows]);

  const markDispatched = async (row: Row) => {
    const { error } = await supabase
      .from("quotation_items")
      .update({ dispatched_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    toast({ title: "Marked dispatched" });
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

  if (!isOfficeStaff) {
    return (
      <AdminShell>
        <p className="text-muted-foreground">Office staff or admin access required.</p>
      </AdminShell>
    );
  }

  const renderRow = (r: Row, action: "dispatch" | "deliver" | null) => (
    <Card key={r.id}>
      <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold">{r.quotations?.quotation_id}</span>
            <Badge variant="outline" className="text-[10px]">{r.quotations?.status}</Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                r.fulfillment_route === "custom"
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {r.fulfillment_route === "custom" ? "Custom" : "Ready Stock"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {r.quotations?.party_name} · {r.quotations?.party_place}
            </span>
          </div>
          <p className="mt-1 text-sm">
            {r.description} <span className="text-muted-foreground">× {r.quantity}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {action === "dispatch" && (
            <Button size="sm" variant="outline" onClick={() => markDispatched(r)}>
              <Truck className="mr-1 h-3.5 w-3.5" /> Dispatch
            </Button>
          )}
          {action === "deliver" && (
            <Button size="sm" variant="outline" onClick={() => markDelivered(r)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Deliver
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link to={`/admin/quotations/${r.quotations?.id}`}>Open</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminShell>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Warehouse</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hybrid order tracking — Ready Stock is picked here, Custom items wait on Production.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="ready">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ready">
              <PackageCheck className="mr-1.5 h-4 w-4" /> Ready ({buckets.ready.length})
            </TabsTrigger>
            <TabsTrigger value="production">
              <HardHat className="mr-1.5 h-4 w-4" /> Pending Production ({buckets.production.length})
            </TabsTrigger>
            <TabsTrigger value="transit">
              <Truck className="mr-1.5 h-4 w-4" /> In Transit ({buckets.inTransit.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ready" className="mt-4 space-y-2">
            {buckets.ready.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing waiting to be picked.</p>
            ) : (
              buckets.ready.map((r) => renderRow(r, "dispatch"))
            )}
          </TabsContent>
          <TabsContent value="production" className="mt-4 space-y-2">
            {buckets.production.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No custom items in production queue.</p>
            ) : (
              buckets.production.map((r) => renderRow(r, null))
            )}
          </TabsContent>
          <TabsContent value="transit" className="mt-4 space-y-2">
            {buckets.inTransit.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing dispatched yet.</p>
            ) : (
              buckets.inTransit.map((r) => renderRow(r, "deliver"))
            )}
          </TabsContent>
        </Tabs>
      )}
    </AdminShell>
  );
};

export default AdminWarehouse;