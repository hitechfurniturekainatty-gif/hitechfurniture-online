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
import { toast } from "@/hooks/use-toast";
import { ArrowRightLeft, Loader2 } from "lucide-react";

type Product = { id: string; product_name: string; product_code: string };
type Variant = { id: string; product_id: string; color_name: string };
type Location = { id: string; building: string; floor: string; section: string | null };
type Movement = {
  id: string;
  product_id: string;
  change_qty: number;
  reason: string;
  note: string | null;
  created_at: string;
};

const locLabel = (l: Location) => [l.building, l.floor, l.section].filter(Boolean).join(" / ");

const AdminInventoryTransfers = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);

  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("none");
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [qty, setQty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [p, v, l, m] = await Promise.all([
      supabase.from("products").select("id, product_name, product_code").is("deleted_at", null).order("product_name"),
      supabase.from("product_variants").select("id, product_id, color_name").order("color_name"),
      supabase.from("product_locations").select("id, building, floor, section").eq("is_active", true).order("display_order"),
      supabase.from("stock_movements")
        .select("id, product_id, change_qty, reason, note, created_at")
        .like("reason", "transfer%")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setVariants((v.data ?? []) as Variant[]);
    setLocations((l.data ?? []) as Location[]);
    setHistory((m.data ?? []) as Movement[]);
  };
  useEffect(() => { load(); }, []);

  const productVariants = useMemo(() => variants.filter((v) => v.product_id === productId), [variants, productId]);
  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const submit = async () => {
    const n = parseInt(qty, 10);
    if (!productId) return toast({ title: "Pick a product", variant: "destructive" });
    if (!fromLoc || !toLoc) return toast({ title: "Pick from & to locations", variant: "destructive" });
    if (fromLoc === toLoc) return toast({ title: "From and To must differ", variant: "destructive" });
    if (!n || n <= 0) return toast({ title: "Quantity must be > 0", variant: "destructive" });
    setSubmitting(true);

    const fromLabel = locLabel(locations.find((l) => l.id === fromLoc)!);
    const toLabel = locLabel(locations.find((l) => l.id === toLoc)!);
    const variantLabel = variantId !== "none"
      ? ` · variant ${variants.find((v) => v.id === variantId)?.color_name}` : "";
    const noteBase = `${fromLabel} → ${toLabel}${variantLabel}`;

    // Two balanced movements — net zero at product level, location ledger captures the move.
    const { error: e1 } = await supabase.from("stock_movements").insert({
      product_id: productId, change_qty: -n, reason: "transfer_out", note: noteBase, resulting_stock: 0,
    } as any);
    if (e1) { toast({ title: e1.message, variant: "destructive" }); setSubmitting(false); return; }
    const { error: e2 } = await supabase.from("stock_movements").insert({
      product_id: productId, change_qty: n, reason: "transfer_in", note: noteBase, resulting_stock: 0,
    } as any);
    if (e2) { toast({ title: e2.message, variant: "destructive" }); setSubmitting(false); return; }

    // Variant/location stock split
    if (variantId !== "none") {
      const upsertDelta = async (locId: string, delta: number) => {
        const { data: ex } = await supabase
          .from("product_variant_stock")
          .select("id, quantity")
          .eq("variant_id", variantId).eq("location_id", locId).maybeSingle();
        if (ex) {
          await supabase.from("product_variant_stock")
            .update({ quantity: Math.max(0, (ex.quantity || 0) + delta) })
            .eq("id", ex.id);
        } else if (delta > 0) {
          await supabase.from("product_variant_stock")
            .insert({ variant_id: variantId, location_id: locId, quantity: delta } as any);
        }
      };
      await upsertDelta(fromLoc, -n);
      await upsertDelta(toLoc, n);
    }

    toast({ title: `Transferred ${n} units` });
    setQty("");
    load();
    setSubmitting(false);
  };

  return (
    <OfficeStaffOnly>
      <AdminShell>
        <div className="container-page space-y-4 py-6">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl">Stock Transfers</h1>
          </div>

          <Card>
            <CardContent className="grid gap-4 p-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Product *</Label>
                <Select value={productId} onValueChange={(v) => { setProductId(v); setVariantId("none"); }}>
                  <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.product_code} — {p.product_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Variant</Label>
                <Select value={variantId} onValueChange={setVariantId} disabled={productVariants.length === 0}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Any / Not tracked —</SelectItem>
                    {productVariants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.color_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>From location *</Label>
                <Select value={fromLoc} onValueChange={setFromLoc}>
                  <SelectTrigger><SelectValue placeholder="Source…" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{locLabel(l)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>To location *</Label>
                <Select value={toLoc} onValueChange={setToLoc}>
                  <SelectTrigger><SelectValue placeholder="Destination…" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{locLabel(l)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantity *</Label>
                <Input type="number" inputMode="numeric" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={submit} disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Transfer stock
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b p-3 font-medium">Recent transfers</div>
              {history.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No transfers yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Route</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-xs">{new Date(m.created_at).toLocaleString()}</TableCell>
                        <TableCell>{productById[m.product_id]?.product_name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{Math.abs(m.change_qty)}</TableCell>
                        <TableCell className="text-xs">{m.reason}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminShell>
    </OfficeStaffOnly>
  );
};

export default AdminInventoryTransfers;