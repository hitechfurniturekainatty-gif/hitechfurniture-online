import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SingleImagePicker } from "@/components/admin/SingleImagePicker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ArrowLeft, Loader2, Plus, Save, Trash2, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type BundleRow = {
  id: string;
  bundle_code: string;
  name: string;
  description: string | null;
  main_category_id: string;
  sub_category_id: string | null;
  main_image_url: string | null;
  mrp: number;
  offer_price: number | null;
  cost_price: number | null;
  available_colors: string[] | null;
  material: string | null;
  dimensions: string | null;
  is_featured: boolean;
  is_published: boolean;
  stock_status: string;
};
type LinkedItem = {
  id: string;
  product_id: string;
  quantity: number;
  display_order: number;
  // joined
  product_name?: string;
  product_code?: string;
  stock_quantity?: number;
  stock_status?: string;
};
type ProductOption = {
  id: string;
  product_name: string;
  product_code: string;
  stock_quantity: number;
  stock_status: string;
};

/**
 * Bundle editor — mirrors the product editor but for `product_bundles`.
 * Linked items are managed in a panel; stock is derived from those items
 * by a DB trigger so we just display it here.
 */
const AdminBundleEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [b, setB] = useState<BundleRow | null>(null);
  const [items, setItems] = useState<LinkedItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [mainCats, setMainCats] = useState<{ id: string; name: string }[]>([]);
  const [subCats, setSubCats] = useState<{ id: string; main_category_id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerProductId, setPickerProductId] = useState("");
  const [pickerQty, setPickerQty] = useState("1");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [b1, b2, b3, b4, b5] = await Promise.all([
      (supabase as any).from("product_bundles").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("bundle_items").select("*").eq("bundle_id", id).order("display_order"),
      supabase.from("products")
        .select("id, product_name, product_code, stock_quantity, stock_status")
        .eq("is_published", true).is("deleted_at", null)
        .order("product_name").limit(500),
      supabase.from("main_categories").select("id, name").is("deleted_at", null).order("display_order"),
      supabase.from("sub_categories").select("id, main_category_id, name").is("deleted_at", null).order("display_order"),
    ]);
    setB(b1.data as BundleRow | null);
    setProducts((b3.data ?? []) as ProductOption[]);
    setMainCats((b4.data ?? []) as any);
    setSubCats((b5.data ?? []) as any);
    // Join product info into items
    const lookup = new Map<string, ProductOption>((b3.data ?? []).map((p: any) => [p.id, p]));
    setItems(((b2.data ?? []) as LinkedItem[]).map((it) => ({
      ...it,
      product_name: lookup.get(it.product_id)?.product_name,
      product_code: lookup.get(it.product_id)?.product_code,
      stock_quantity: lookup.get(it.product_id)?.stock_quantity,
      stock_status: lookup.get(it.product_id)?.stock_status,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const save = async () => {
    if (!b || !id) return;
    setSaving(true);
    const { error } = await (supabase as any).from("product_bundles").update({
      bundle_code: b.bundle_code, name: b.name, description: b.description,
      main_category_id: b.main_category_id, sub_category_id: b.sub_category_id,
      main_image_url: b.main_image_url, mrp: b.mrp || 0, offer_price: b.offer_price,
      cost_price: b.cost_price, available_colors: b.available_colors ?? [],
      material: b.material, dimensions: b.dimensions,
      is_featured: b.is_featured, is_published: b.is_published,
    }).eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bundle saved" });
  };

  const addLinked = async () => {
    if (!pickerProductId || !id) return;
    const qty = Math.max(1, Number(pickerQty) || 1);
    if (items.some((it) => it.product_id === pickerProductId)) {
      toast({ title: "Already added", description: "Update the quantity instead.", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("bundle_items").insert({
      bundle_id: id, product_id: pickerProductId, quantity: qty, display_order: items.length,
    });
    if (error) { toast({ title: "Add failed", description: error.message, variant: "destructive" }); return; }
    setPickerProductId(""); setPickerQty("1");
    load();
  };

  const updateQty = async (rowId: string, qty: number) => {
    if (qty < 1) return;
    await (supabase as any).from("bundle_items").update({ quantity: qty }).eq("id", rowId);
    load();
  };

  const removeLinked = async (rowId: string) => {
    await (supabase as any).from("bundle_items").delete().eq("id", rowId);
    load();
  };

  const removeBundle = async () => {
    if (!id) return;
    if (!confirm("Move this bundle to trash?")) return;
    await (supabase as any).from("product_bundles")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    navigate("/admin/bundles");
  };

  const subOptions = useMemo(
    () => subCats.filter((s) => s.main_category_id === b?.main_category_id).map((s) => ({ value: s.id, label: s.name })),
    [subCats, b?.main_category_id],
  );

  if (loading || !b) {
    return <AdminShell><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div></AdminShell>;
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/bundles")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> All bundles
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={removeBundle}><Trash2 className="mr-1 h-4 w-4" /> Delete</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Main image + meta */}
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <h2 className="font-display text-lg">Bundle details</h2>
            <div>
              <Label>Main image</Label>
              <SingleImagePicker
                value={b.main_image_url}
                onChange={(url) => setB({ ...b, main_image_url: url })}
                bucket="product-images" folder="bundles"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Bundle code</Label>
                <Input value={b.bundle_code} onChange={(e) => setB({ ...b, bundle_code: e.target.value })} />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={b.description ?? ""} onChange={(e) => setB({ ...b, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Main category</Label>
                <SearchableSelect
                  value={b.main_category_id}
                  onChange={(v) => setB({ ...b, main_category_id: v, sub_category_id: null })}
                  options={mainCats.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
              <div>
                <Label>Sub-category</Label>
                <SearchableSelect
                  value={b.sub_category_id ?? ""}
                  onChange={(v) => setB({ ...b, sub_category_id: v || null })}
                  options={subOptions}
                  placeholder="(none)"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>MRP</Label>
                <Input type="number" value={b.mrp ?? 0} onChange={(e) => setB({ ...b, mrp: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Offer price</Label>
                <Input type="number" value={b.offer_price ?? ""} onChange={(e) => setB({ ...b, offer_price: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div>
                <Label>Cost (admin)</Label>
                <Input type="number" value={b.cost_price ?? ""} onChange={(e) => setB({ ...b, cost_price: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Material</Label>
                <Input value={b.material ?? ""} onChange={(e) => setB({ ...b, material: e.target.value })} />
              </div>
              <div>
                <Label>Dimensions</Label>
                <Input value={b.dimensions ?? ""} onChange={(e) => setB({ ...b, dimensions: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Colors (comma-separated)</Label>
              <Input
                value={(b.available_colors ?? []).join(", ")}
                onChange={(e) => setB({ ...b, available_colors: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={b.is_published} onCheckedChange={(v) => setB({ ...b, is_published: v })} />
                Published (visible on catalog)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={b.is_featured} onCheckedChange={(v) => setB({ ...b, is_featured: v })} />
                Featured
              </label>
              <Badge variant={b.stock_status === "out_of_stock" ? "destructive" : "outline"}>
                {b.stock_status === "out_of_stock" ? "Out of stock (auto)" : "In stock (auto)"}
              </Badge>
            </div>
          </div>

          {/* Linked items */}
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Linked items</h2>
              <Badge variant="outline">{items.length} items</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Add catalog products with quantities. When this bundle is delivered, these items' stock will be deducted automatically.
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <SearchableSelect
                  value={pickerProductId}
                  onChange={setPickerProductId}
                  options={products
                    .filter((p) => !items.some((it) => it.product_id === p.id))
                    .map((p) => ({ value: p.id, label: p.product_name, sub: `${p.product_code} · ${p.stock_quantity} in stock` }))}
                  placeholder="Pick a product…"
                />
              </div>
              <Input
                type="number" min={1} className="w-20"
                value={pickerQty} onChange={(e) => setPickerQty(e.target.value)}
              />
              <Button onClick={addLinked} disabled={!pickerProductId}><Plus className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No items linked yet.
                </div>
              ) : items.map((it) => {
                const oos = (it.stock_status === "out_of_stock") || ((it.stock_quantity ?? 0) < it.quantity);
                return (
                  <div key={it.id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.product_name ?? it.product_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.product_code} · {it.stock_quantity ?? 0} in stock
                      </p>
                    </div>
                    {oos && <Badge variant="destructive">Low</Badge>}
                    <Input
                      type="number" min={1} className="w-16"
                      value={it.quantity}
                      onChange={(e) => updateQty(it.id, Math.max(1, Number(e.target.value) || 1))}
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeLinked(it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminBundleEditor;