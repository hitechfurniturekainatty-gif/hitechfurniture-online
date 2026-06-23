import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, ClipboardCheck } from "lucide-react";

type Location = { id: string; building: string; floor: string; section: string | null };
type Row = {
  variantStockId: string;
  variantId: string;
  productId: string;
  label: string;
  variantName: string;
  systemQty: number;
  counted: string;
};

const locLabel = (l: Location) => [l.building, l.floor, l.section].filter(Boolean).join(" / ");

const AdminInventoryStockTake = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("product_locations").select("id, building, floor, section")
      .eq("is_active", true).order("display_order")
      .then(({ data }) => setLocations((data ?? []) as Location[]));
  }, []);

  const loadLocation = async (locId: string) => {
    setLocationId(locId);
    setReviewing(false);
    if (!locId) { setRows([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("product_variant_stock")
      .select("id, variant_id, quantity, product_variants(id, color_name, product_id, products(product_name, product_code))")
      .eq("location_id", locId);
    const mapped: Row[] = ((data ?? []) as any[]).map((r) => ({
      variantStockId: r.id,
      variantId: r.variant_id,
      productId: r.product_variants?.product_id,
      label: `${r.product_variants?.products?.product_code ?? ""} — ${r.product_variants?.products?.product_name ?? ""}`,
      variantName: r.product_variants?.color_name ?? "",
      systemQty: r.quantity,
      counted: "",
    }));
    setRows(mapped.sort((a, b) => a.label.localeCompare(b.label)));
    setLoading(false);
  };

  const variances = useMemo(
    () => rows
      .map((r) => ({ ...r, diff: r.counted === "" ? null : parseInt(r.counted, 10) - r.systemQty }))
      .filter((r) => r.diff !== null && !Number.isNaN(r.diff!) && r.diff !== 0),
    [rows],
  );

  const submit = async () => {
    setSubmitting(true);
    const locName = locLabel(locations.find((l) => l.id === locationId)!);
    for (const v of variances) {
      await supabase.from("stock_movements").insert({
        product_id: v.productId,
        change_qty: v.diff!,
        reason: "stock_take_adjustment",
        note: `Stock-take at ${locName} · variant ${v.variantName} · counted ${v.counted} vs system ${v.systemQty}`,
        resulting_stock: 0,
      } as any);
      await supabase.from("product_variant_stock")
        .update({ quantity: parseInt(v.counted, 10) })
        .eq("id", v.variantStockId);
    }
    toast({ title: `Posted ${variances.length} adjustment${variances.length === 1 ? "" : "s"}` });
    setSubmitting(false);
    setReviewing(false);
    loadLocation(locationId);
  };

  return (
    <OfficeStaffOnly>
      <AdminShell>
        <div className="container-page space-y-4 py-6">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl">Stock-take / Cycle Count</h1>
          </div>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="max-w-md space-y-1">
                <Label>Location *</Label>
                <Select value={locationId} onValueChange={loadLocation}>
                  <SelectTrigger><SelectValue placeholder="Pick a location to count…" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{locLabel(l)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {!loading && locationId && rows.length === 0 && (
                <p className="text-sm text-muted-foreground">No variant stock tracked at this location yet.</p>
              )}
            </CardContent>
          </Card>

          {!reviewing && rows.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product / Variant</TableHead>
                      <TableHead className="w-32 text-right">System qty</TableHead>
                      <TableHead className="w-32 text-right">Counted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.variantStockId}>
                        <TableCell>
                          <div className="font-medium">{r.label}</div>
                          <div className="text-xs text-muted-foreground">{r.variantName}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.systemQty}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className="ml-auto h-8 w-24 text-right"
                            value={r.counted}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((rs) => rs.map((x) => x.variantStockId === r.variantStockId ? { ...x, counted: val } : x));
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between gap-3 border-t p-3">
                  <p className="text-sm text-muted-foreground">
                    {variances.length} variance{variances.length === 1 ? "" : "s"} pending
                  </p>
                  <Button onClick={() => setReviewing(true)} disabled={variances.length === 0}>
                    Review variances
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {reviewing && (
            <Card>
              <CardContent className="p-0">
                <div className="border-b p-3 font-medium">Confirm {variances.length} adjustment{variances.length === 1 ? "" : "s"}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product / Variant</TableHead>
                      <TableHead className="text-right">System</TableHead>
                      <TableHead className="text-right">Counted</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variances.map((v) => (
                      <TableRow key={v.variantStockId}>
                        <TableCell>{v.label} <span className="text-muted-foreground">· {v.variantName}</span></TableCell>
                        <TableCell className="text-right tabular-nums">{v.systemQty}</TableCell>
                        <TableCell className="text-right tabular-nums">{v.counted}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={v.diff! > 0 ? "default" : "destructive"}>
                            {v.diff! > 0 ? `+${v.diff}` : v.diff}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end gap-2 border-t p-3">
                  <Button variant="outline" onClick={() => setReviewing(false)}>Back</Button>
                  <Button onClick={submit} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm & post
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminShell>
    </OfficeStaffOnly>
  );
};

export default AdminInventoryStockTake;