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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Plus, Save, Trash2, Package, Search, Minus, ChevronUp, ChevronDown } from "lucide-react";
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
  main_image_url?: string | null;
};
type ProductOption = {
  id: string;
  product_name: string;
  product_code: string;
  product_code_lower?: string;
  stock_quantity: number;
  stock_status: string;
  main_category_id?: string;
  main_image_url?: string | null;
  mrp?: number;
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
  // Catalog browser dialog
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogMainId, setCatalogMainId] = useState<string>("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [b1, b2, b3, b4, b5] = await Promise.all([
      (supabase as any).from("product_bundles").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("bundle_items").select("*").eq("bundle_id", id).order("display_order"),
      supabase.from("products")
        .select("id, product_name, product_code, stock_quantity, stock_status, main_category_id, mrp")
        .eq("is_published", true).is("deleted_at", null)
        .order("product_name").limit(500),
      supabase.from("main_categories").select("id, name").is("deleted_at", null).order("display_order"),
      supabase.from("sub_categories").select("id, main_category_id, name").is("deleted_at", null).order("display_order"),
    ]);
    setB(b1.data as BundleRow | null);
    // Pull main image (first product_image) for each product in a follow-up call
    const prodList = (b3.data ?? []) as ProductOption[];
    let imgMap = new Map<string, string>();
    if (prodList.length) {
      const { data: imgs } = await supabase
        .from("product_images")
        .select("product_id, image_url, display_order")
        .in("product_id", prodList.map((p) => p.id))
        .order("display_order");
      ((imgs ?? []) as any[]).forEach((img) => {
        if (!imgMap.has(img.product_id)) imgMap.set(img.product_id, img.image_url);
      });
    }
    setProducts(prodList.map((p) => ({ ...p, main_image_url: imgMap.get(p.id) ?? null })));
    setMainCats((b4.data ?? []) as any);
    setSubCats((b5.data ?? []) as any);
    // Join product info into items
    const lookup = new Map<string, ProductOption>(prodList.map((p) => [p.id, { ...p, main_image_url: imgMap.get(p.id) ?? null }]));
    setItems(((b2.data ?? []) as LinkedItem[]).map((it) => ({
      ...it,
      product_name: lookup.get(it.product_id)?.product_name,
      product_code: lookup.get(it.product_id)?.product_code,
      stock_quantity: lookup.get(it.product_id)?.stock_quantity,
      stock_status: lookup.get(it.product_id)?.stock_status,
      main_image_url: lookup.get(it.product_id)?.main_image_url ?? null,
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

  const openCatalogPicker = () => {
    setCatalogSearch("");
    setCatalogMainId("");
    setPicked({});
    setCatalogOpen(true);
  };

  const togglePick = (productId: string, checked: boolean) => {
    setPicked((prev) => {
      const next = { ...prev };
      if (checked) next[productId] = next[productId] ?? 1;
      else delete next[productId];
      return next;
    });
  };

  const setPickQty = (productId: string, qty: number) => {
    setPicked((prev) => ({ ...prev, [productId]: Math.max(1, qty || 1) }));
  };

  const confirmAddSelected = async () => {
    if (!id) return;
    const entries = Object.entries(picked).filter(([pid]) => !items.some((it) => it.product_id === pid));
    if (entries.length === 0) {
      toast({ title: "Nothing new to add" });
      return;
    }
    setBulkSaving(true);
    const rows = entries.map(([pid, qty], i) => ({
      bundle_id: id,
      product_id: pid,
      quantity: qty,
      display_order: items.length + i,
    }));
    const { error } = await (supabase as any).from("bundle_items").insert(rows);
    setBulkSaving(false);
    if (error) {
      toast({ title: "Add failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Added ${entries.length} item(s)` });
    setCatalogOpen(false);
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

  const moveLinked = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    await Promise.all([
      (supabase as any).from("bundle_items").update({ display_order: j }).eq("id", a.id),
      (supabase as any).from("bundle_items").update({ display_order: idx }).eq("id", b.id),
    ]);
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

            <Button type="button" variant="default" className="w-full" onClick={openCatalogPicker}>
              <Plus className="mr-1.5 h-4 w-4" /> Add items from catalog
            </Button>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                No items linked yet. Click <span className="font-semibold">"Add items from catalog"</span> above to start.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, idx) => {
                  const oos = (it.stock_status === "out_of_stock") || ((it.stock_quantity ?? 0) < it.quantity);
                  return (
                    <div key={it.id} className="flex items-center gap-3 rounded-lg border bg-background p-2">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
                        {it.main_image_url ? (
                          <img src={it.main_image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{it.product_name ?? it.product_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.product_code} · <span className={oos ? "text-destructive font-medium" : ""}>{it.stock_quantity ?? 0} in stock</span>
                        </p>
                        {oos && <Badge variant="destructive" className="mt-1 text-[10px]">Low stock</Badge>}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => moveLinked(idx, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === items.length - 1} onClick={() => moveLinked(idx, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                      </div>
                      <div className="flex items-center rounded-md border">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-r-none" onClick={() => updateQty(it.id, it.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                        <Input
                          type="number" min={1}
                          className="h-8 w-12 rounded-none border-x text-center [&::-webkit-inner-spin-button]:appearance-none"
                          value={it.quantity}
                          onChange={(e) => updateQty(it.id, Math.max(1, Number(e.target.value) || 1))}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-l-none" onClick={() => updateQty(it.id, it.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeLinked(it.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Catalog browser dialog */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-3xl sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle>Add items from catalog</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4 py-3 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder="Search by name or code…" className="pl-9" />
              </div>
              <select
                value={catalogMainId}
                onChange={(e) => setCatalogMainId(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">All categories</option>
                {mainCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const q = catalogSearch.toLowerCase();
                const list = products.filter((p) => {
                  if (items.some((it) => it.product_id === p.id)) return false;
                  if (catalogMainId && p.main_category_id !== catalogMainId) return false;
                  if (!q) return true;
                  return p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q);
                });
                if (list.length === 0) {
                  return <p className="py-10 text-center text-sm text-muted-foreground">No products match.</p>;
                }
                return (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((p) => {
                      const isPicked = picked[p.id] !== undefined;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-2 rounded-md border p-2 transition-colors ${isPicked ? "border-primary bg-primary/5" : "bg-card"}`}
                        >
                          <Checkbox
                            checked={isPicked}
                            onCheckedChange={(v) => togglePick(p.id, !!v)}
                          />
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                            {p.main_image_url ? (
                              <img src={p.main_image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-muted-foreground"><Package className="h-4 w-4" /></div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.product_name}</p>
                            <p className="text-xs text-muted-foreground">{p.product_code} · {p.stock_quantity} in stock</p>
                          </div>
                          {isPicked && (
                            <div className="flex items-center rounded-md border">
                              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-r-none" onClick={() => setPickQty(p.id, (picked[p.id] ?? 1) - 1)}><Minus className="h-3 w-3" /></Button>
                              <Input
                                type="number" min={1}
                                className="h-7 w-10 rounded-none border-x text-center text-xs"
                                value={picked[p.id] ?? 1}
                                onChange={(e) => setPickQty(p.id, Number(e.target.value) || 1)}
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-l-none" onClick={() => setPickQty(p.id, (picked[p.id] ?? 1) + 1)}><Plus className="h-3 w-3" /></Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:px-6">
            <Button variant="outline" onClick={() => setCatalogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={confirmAddSelected} disabled={Object.keys(picked).length === 0 || bulkSaving} className="w-full sm:w-auto">
              {bulkSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Add {Object.keys(picked).length || ""} selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
};

export default AdminBundleEditor;