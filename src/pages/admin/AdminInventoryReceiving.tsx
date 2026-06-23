import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { OfficeStaffOnly } from "@/components/admin/OfficeStaffOnly";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, PackagePlus } from "lucide-react";

type Product = { id: string; product_name: string; product_code: string; stock_quantity: number };
type Variant = { id: string; product_id: string; color_name: string };
type Location = { id: string; building: string; floor: string; section: string | null };

const locLabel = (l: Location) =>
  [l.building, l.floor, l.section].filter(Boolean).join(" / ");

const AdminInventoryReceiving = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState<string>("none");
  const [locationId, setLocationId] = useState<string>("none");
  const [qty, setQty] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, v, l] = await Promise.all([
        supabase.from("products").select("id, product_name, product_code, stock_quantity").is("deleted_at", null).order("product_name"),
        supabase.from("product_variants").select("id, product_id, color_name").order("color_name"),
        supabase.from("product_locations").select("id, building, floor, section").eq("is_active", true).order("display_order"),
      ]);
      setProducts((p.data ?? []) as Product[]);
      setVariants((v.data ?? []) as Variant[]);
      setLocations((l.data ?? []) as Location[]);
      setLoading(false);
    })();
  }, []);

  const productVariants = useMemo(
    () => variants.filter((v) => v.product_id === productId),
    [variants, productId],
  );

  const submit = async () => {
    const n = parseInt(qty, 10);
    if (!productId) return toast({ title: "Pick a product", variant: "destructive" });
    if (!n || n <= 0) return toast({ title: "Quantity must be > 0", variant: "destructive" });
    setSubmitting(true);
    const noteParts = [
      supplierRef ? `Supplier: ${supplierRef}` : null,
      locationId !== "none" ? `Location: ${locLabel(locations.find((l) => l.id === locationId)!)}` : null,
      variantId !== "none" ? `Variant: ${variants.find((v) => v.id === variantId)?.color_name}` : null,
      note || null,
    ].filter(Boolean).join(" · ");
    const { error } = await supabase.from("stock_movements").insert({
      product_id: productId,
      change_qty: n,
      reason: "inbound_receive",
      note: noteParts || null,
      resulting_stock: 0, // overridden by trigger
    } as any);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }
    // Bump per-variant per-location quantity when both are selected.
    if (variantId !== "none" && locationId !== "none") {
      const { data: existing } = await supabase
        .from("product_variant_stock")
        .select("id, quantity")
        .eq("variant_id", variantId)
        .eq("location_id", locationId)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("product_variant_stock")
          .update({ quantity: (existing.quantity || 0) + n })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("product_variant_stock")
          .insert({ variant_id: variantId, location_id: locationId, quantity: n } as any);
      }
    }
    toast({ title: `Received ${n} units` });
    setQty(""); setSupplierRef(""); setNote("");
    // Refresh product stock display
    const { data } = await supabase
      .from("products").select("id, product_name, product_code, stock_quantity")
      .is("deleted_at", null).order("product_name");
    setProducts((data ?? []) as Product[]);
    setSubmitting(false);
  };

  return (
    <OfficeStaffOnly>
      <AdminShell>
        <div className="container-page max-w-2xl space-y-4 py-6">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl">Inbound Receiving</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Record new stock arrivals. This adds a stock movement and bumps on-hand quantity.
          </p>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="space-y-1">
                  <Label>Product *</Label>
                  <Select value={productId} onValueChange={(v) => { setProductId(v); setVariantId("none"); }}>
                    <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.product_code} — {p.product_name} (on {p.stock_quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {productVariants.length > 0 && (
                  <div className="space-y-1">
                    <Label>Variant (optional)</Label>
                    <Select value={variantId} onValueChange={setVariantId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Any / Not tracked —</SelectItem>
                        {productVariants.map((v) => (
                          <SelectItem key={v.id} value={v.id}>{v.color_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Location (optional)</Label>
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Unassigned —</SelectItem>
                      {locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{locLabel(l)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Quantity received *</Label>
                    <Input type="number" inputMode="numeric" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Supplier ref</Label>
                    <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} placeholder="GRN / Invoice #" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Note</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional comment" />
                </div>
                <Button onClick={submit} disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record receipt
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminShell>
    </OfficeStaffOnly>
  );
};

export default AdminInventoryReceiving;