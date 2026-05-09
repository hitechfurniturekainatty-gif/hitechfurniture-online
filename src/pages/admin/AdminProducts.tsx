import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { ImageUploader, type UploadedImage } from "@/components/admin/ImageUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Search, Trash2, Boxes, Tag, Printer, AlertTriangle, X, MapPin, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/brand";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";
import { AutoSuggestInput, type Suggestion } from "@/components/admin/AutoSuggestInput";
import { StockMovementDialog } from "@/components/admin/StockMovementDialog";
import { PriceLabelPrintDialog, type LabelProduct } from "@/components/admin/PriceLabelPrintDialog";
import { LocationsDialog } from "@/components/admin/LocationsDialog";
import { CatalogPinDialog } from "@/components/admin/CatalogPinDialog";
import { ProductVariantsEditor, type VariantDraft } from "@/components/admin/ProductVariantsEditor";
import { titleCaseTrim, toTitleCase } from "@/lib/textCase";

type MainCat = { id: string; name: string };
type SubCat = { id: string; main_category_id: string; name: string };
type Location = {
  id: string;
  building: string;
  floor: string;
  section: string | null;
  display_order: number;
  is_active: boolean;
};
type Product = {
  id: string;
  product_name: string;
  product_code: string;
  description: string | null;
  cost_price: number | null;
  mrp: number;
  offer_price: number | null;
  available_colors: string[] | null;
  material: string | null;
  dimensions: string | null;
  stock_quantity: number;
  reorder_level: number;
  is_featured: boolean;
  is_published: boolean;
  main_category_id: string;
  sub_category_id: string | null;
  location_id: string | null;
  stock_status: "in_stock" | "out_of_stock";
  product_images: { id: string; image_url: string; display_order: number }[];
  deleted_at?: string | null;
};

type FormState = {
  product_name: string;
  product_code: string;
  description: string;
  cost_price: string;
  mrp: string;
  offer_price: string;
  available_colors: string;
  material: string;
  dimensions: string;
  stock_quantity: string;
  reorder_level: string;
  is_featured: boolean;
  is_published: boolean;
  main_category_id: string;
  sub_category_id: string;
  location_id: string;
  stock_status: "in_stock" | "out_of_stock";
  images: UploadedImage[];
  variants: VariantDraft[];
};

const emptyForm: FormState = {
  product_name: "", product_code: "", description: "",
  cost_price: "", mrp: "", offer_price: "",
  available_colors: "", material: "", dimensions: "",
  stock_quantity: "0",
  reorder_level: "5",
  is_featured: false, is_published: true,
  main_category_id: "", sub_category_id: "",
  location_id: "",
  stock_status: "in_stock",
  images: [],
  variants: [],
};

const AdminProducts = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsDialogOpen, setLocationsDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("*, product_images(id, image_url, display_order)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    // Defensive: filter out anything with a deleted_at timestamp at the
    // client level too, so a stale cache or replication lag can never
    // inflate the catalog count.
    const safe = ((data ?? []) as Product[]).filter((p) => !p.deleted_at);
    setProducts(safe);
  };

  useEffect(() => {
    load();
    supabase.from("main_categories").select("id, name").order("display_order").then(({ data }) => setMainCats((data ?? []) as MainCat[]));
    supabase.from("sub_categories").select("id, main_category_id, name").order("display_order").then(({ data }) => setSubCats((data ?? []) as SubCat[]));
    loadLocations();
  }, []);

  const loadLocations = async () => {
    const { data } = await supabase
      .from("product_locations")
      .select("*")
      .order("display_order");
    setLocations((data ?? []) as Location[]);
  };

  const filtered = useMemo(() => {
    let list = products;
    if (showLowStockOnly) {
      list = list.filter((p) => p.stock_quantity <= (p.reorder_level ?? 5));
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((p) => p.product_name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q));
  }, [products, search, showLowStockOnly]);

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock_quantity <= (p.reorder_level ?? 5)).length,
    [products],
  );
  const selectedProducts = useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected],
  );

  const subsForForm = subCats.filter((s) => s.main_category_id === form.main_category_id);

  // Derive Building / Floor / Section from the selected location_id
  const selectedLocation = locations.find((l) => l.id === form.location_id) || null;
  const formBuilding = selectedLocation?.building ?? "";
  const formFloor = selectedLocation?.floor ?? "";
  const buildingOptions = useMemo(
    () => Array.from(new Set(locations.filter((l) => l.is_active).map((l) => l.building))),
    [locations],
  );
  const floorOptions = useMemo(
    () => Array.from(new Set(locations.filter((l) => l.is_active && l.building === formBuilding).map((l) => l.floor))),
    [locations, formBuilding],
  );
  const sectionOptions = useMemo(
    () => locations.filter((l) => l.is_active && l.building === formBuilding && l.floor === formFloor),
    [locations, formBuilding, formFloor],
  );

  const pickBuilding = (b: string) => {
    // Pick the first matching location for this building (any floor) so the
    // floor dropdown becomes meaningful but location_id is still set.
    const first = locations.find((l) => l.is_active && l.building === b);
    setForm({ ...form, location_id: first?.id ?? "" });
  };
  const pickFloor = (f: string) => {
    const first = locations.find((l) => l.is_active && l.building === formBuilding && l.floor === f);
    setForm({ ...form, location_id: first?.id ?? "" });
  };
  const pickSection = (id: string) => {
    setForm({ ...form, location_id: id });
  };

  const [newSection, setNewSection] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const addInlineSection = async () => {
    const name = newSection.trim();
    if (!name || !formBuilding || !formFloor) {
      return toast({ title: "Pick Building & Floor first", variant: "destructive" });
    }
    setAddingSection(true);
    const { data, error } = await supabase
      .from("product_locations")
      .insert({
        building: formBuilding,
        floor: formFloor,
        section: name,
        display_order: (locations[locations.length - 1]?.display_order ?? 0) + 10,
      })
      .select("*")
      .single();
    setAddingSection(false);
    if (error || !data) return toast({ title: "Failed", description: error?.message, variant: "destructive" });
    setNewSection("");
    await loadLocations();
    setForm((f) => ({ ...f, location_id: (data as Location).id }));
    toast({ title: "Section added" });
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = async (p: Product) => {
    setEditing(p);
    setForm({
      product_name: p.product_name,
      product_code: p.product_code,
      description: p.description ?? "",
      cost_price: p.cost_price?.toString() ?? "",
      mrp: p.mrp.toString(),
      offer_price: p.offer_price?.toString() ?? "",
      available_colors: (p.available_colors ?? []).join(", "),
      material: p.material ?? "",
      dimensions: p.dimensions ?? "",
      stock_quantity: p.stock_quantity.toString(),
      reorder_level: (p.reorder_level ?? 5).toString(),
      is_featured: p.is_featured,
      is_published: p.is_published,
      main_category_id: p.main_category_id,
      sub_category_id: p.sub_category_id ?? "",
      location_id: p.location_id ?? "",
      stock_status: p.stock_status ?? "in_stock",
      images: p.product_images
        .sort((a, b) => a.display_order - b.display_order)
        .map((i) => ({ url: i.image_url, path: i.image_url })),
      variants: [],
    });
    setOpen(true);
    // Load variants + their per-location stock breakdown for this product
    const { data: vData } = await supabase
      .from("product_variants")
      .select("id, color_name, color_hex, image_url, stock_quantity, display_order, product_variant_stock(id, location_id, quantity, floor_display_order)")
      .eq("product_id", p.id)
      .order("display_order");
    setForm((f) => ({
      ...f,
      variants: (vData ?? []).map((v: any) => ({
        id: v.id,
        color_name: v.color_name,
        color_hex: v.color_hex ?? "",
        image_url: v.image_url,
        stock_quantity: v.stock_quantity ?? 0,
        stocks: ((v.product_variant_stock ?? []) as any[])
          .sort((a, b) => (a.floor_display_order ?? 0) - (b.floor_display_order ?? 0))
          .map((s) => ({
            id: s.id,
            location_id: s.location_id,
            quantity: s.quantity ?? 0,
            floor_display_order: s.floor_display_order ?? 0,
          })),
      })),
    }));
  };

  const save = async () => {
    // Only Name + Item photo are mandatory. Everything else is optional and
    // auto-filled to satisfy DB NOT NULL constraints when left blank.
    if (!form.product_name.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    if (form.images.length === 0) {
      toast({ title: "At least one product photo is required", variant: "destructive" });
      return;
    }
    let mainCatId = form.main_category_id;
    if (!mainCatId) {
      mainCatId = mainCats[0]?.id ?? "";
      if (!mainCatId) {
        toast({ title: "Create a category first", description: "Add at least one main category in Categories.", variant: "destructive" });
        return;
      }
    }
    const autoCode =
      form.product_code.trim() ||
      `AUTO-${Date.now().toString(36).toUpperCase()}`;
    setSaving(true);
    const payload: any = {
      product_name: titleCaseTrim(form.product_name),
      product_code: autoCode,
      description: form.description || null,
      mrp: form.mrp ? Number(form.mrp) : 0,
      offer_price: form.offer_price ? Number(form.offer_price) : null,
      available_colors: form.available_colors
        ? form.available_colors.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      material: form.material || null,
      dimensions: form.dimensions || null,
      stock_quantity: Number(form.stock_quantity || 0),
      reorder_level: Number(form.reorder_level || 5),
      is_featured: form.is_featured,
      is_published: form.is_published,
      main_category_id: mainCatId,
      sub_category_id: form.sub_category_id || null,
      location_id: form.location_id || null,
      stock_status: form.stock_status,
    };
    if (isAdmin) payload.cost_price = form.cost_price ? Number(form.cost_price) : null;

    let productId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast({ title: "Failed", description: error.message, variant: "destructive" }); }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); return toast({ title: "Failed", description: error?.message, variant: "destructive" }); }
      productId = data.id;
    }

    // Sync images: delete all then re-insert in order (simple approach)
    if (productId) {
      await supabase.from("product_images").delete().eq("product_id", productId);
      if (form.images.length > 0) {
        const rows = form.images.map((img, i) => ({
          product_id: productId!,
          image_url: img.url,
          display_order: i,
        }));
        await supabase.from("product_images").insert(rows);
      }
      // Sync variants: delete all (cascades to product_variant_stock) then
      // re-insert in order. Per-location stock rows are added in a 2nd pass
      // so we know each freshly-inserted variant id.
      await supabase.from("product_variants").delete().eq("product_id", productId);
      const validVariants = form.variants.filter((v) => v.color_name.trim());
      if (validVariants.length > 0) {
        // Total stock = sum of per-location rows (falls back to legacy field).
        const vRows = validVariants.map((v, i) => {
          const stocks = (v.stocks ?? []).filter((s) => s.location_id);
          const total = stocks.length > 0
            ? stocks.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
            : Math.max(0, Number(v.stock_quantity) || 0);
          // For backward-compat, pin the variant to its first location so older
          // code paths that read `product_variants.location_id` still work.
          const primaryLoc = stocks[0]?.location_id ?? null;
          return {
            product_id: productId!,
            color_name: v.color_name.trim(),
            color_hex: v.color_hex || null,
            image_url: v.image_url,
            stock_quantity: total,
            display_order: (i + 1) * 10,
            location_id: primaryLoc,
            floor_display_order: Math.max(0, Number(stocks[0]?.floor_display_order) || 0),
          };
        });
        const { data: inserted, error: vErr } = await supabase
          .from("product_variants")
          .insert(vRows)
          .select("id, color_name, display_order");
        if (vErr) {
          setSaving(false);
          return toast({ title: "Failed to save colors", description: vErr.message, variant: "destructive" });
        }
        // Insert per-location stock rows. Match by display_order which we set
        // deterministically just above so ordering is reliable.
        const stockRows: { variant_id: string; location_id: string; quantity: number; floor_display_order: number }[] = [];
        validVariants.forEach((v, i) => {
          const variantRow = (inserted ?? []).find((r: any) => r.display_order === (i + 1) * 10);
          if (!variantRow) return;
          for (const s of v.stocks ?? []) {
            if (!s.location_id) continue;
            stockRows.push({
              variant_id: variantRow.id,
              location_id: s.location_id,
              quantity: Math.max(0, Number(s.quantity) || 0),
              floor_display_order: Math.max(0, Number(s.floor_display_order) || 0),
            });
          }
        });
        if (stockRows.length > 0) {
          await supabase.from("product_variant_stock").insert(stockRows);
        }
      }
    }

    setSaving(false);
    setOpen(false);
    toast({ title: editing ? "Product updated" : "Product created" });
    load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`Move "${p.product_name}" to Trash? You can restore it for 30 days.`)) return;
    const { softDelete } = await import("@/lib/softDelete");
    const { error } = await softDelete("products", p.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    toast({ title: "Moved to Trash", description: "Restore from Admin → Trash within 30 days." });
    load();
  };

  return (
    <AdminShell>
      {!authLoading && !isAdmin && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <h1 className="font-display text-xl">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view Products.</p>
        </div>
      )}
      {!authLoading && isAdmin && (<>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {/* Show the count of what is actually visible in the list so the
                header never disagrees with the rendered rows. When a search
                or low-stock filter is active, also show the total in brackets. */}
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
            {(search || showLowStockOnly) && filtered.length !== products.length && (
              <span className="text-muted-foreground/70"> of {products.length}</span>
            )}
            {" "}in your catalog
            {lowStockCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                · <AlertTriangle className="h-3.5 w-3.5" /> {lowStockCount} low stock
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Button variant="outline" onClick={() => setLocationsDialogOpen(true)} className="gap-1.5">
            <MapPin className="h-4 w-4" /> Locations
          </Button>
          <Button variant="outline" onClick={() => setPinDialogOpen(true)} className="gap-1.5">
            <KeyRound className="h-4 w-4" /> Catalog PIN
          </Button>
          <Button onClick={openNew} className="w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" /> Add product</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code…" className="pl-9" />
        </div>
        <Button
          type="button"
          variant={showLowStockOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowLowStockOnly((v) => !v)}
          className="gap-1.5"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Low stock {lowStockCount > 0 && `(${lowStockCount})`}
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium">
            <Tag className="mr-1.5 inline h-4 w-4 text-primary" />
            {selected.size} selected for label printing
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
            <Button size="sm" onClick={() => setLabelDialogOpen(true)}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print labels
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {filtered.length === 0 && (
              <li className="p-12 text-center text-muted-foreground">No products yet. Click "Add product" to begin.</li>
            )}
            {filtered.map((p) => {
              const cover = p.product_images.sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
              const isSelected = selected.has(p.id);
              const isLow = p.stock_quantity <= (p.reorder_level ?? 5);
              return (
                <li key={p.id} className={`flex items-center gap-3 p-3 sm:gap-4 sm:p-4 ${isSelected ? "bg-primary/5" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(p.id)}
                    aria-label={`Select ${p.product_name} for label printing`}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-16 sm:w-16">
                    {cover ? <img src={cover} alt="" className="h-full w-full object-contain p-1" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="min-w-0 truncate font-medium">{toTitleCase(p.product_name)}</p>
                      {p.is_featured && <Badge className="bg-accent text-accent-foreground shrink-0 text-[10px]">Featured</Badge>}
                      {!p.is_published && <Badge variant="secondary" className="shrink-0 text-[10px]">Hidden</Badge>}
                      {isLow && (
                        <Badge variant="destructive" className="shrink-0 gap-0.5 text-[10px]">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {p.stock_quantity === 0 ? "Out" : "Low"}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">Code · {p.product_code}</p>
                    <p className="truncate text-sm">
                      <span className="font-semibold text-primary">{formatINR(p.offer_price ?? p.mrp)}</span>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => setStockProduct(p)}
                        className={`underline-offset-2 hover:underline ${isLow ? "text-destructive font-semibold" : "text-foreground/70"}`}
                        title="Manage stock"
                      >
                        Stock {p.stock_quantity}
                      </button>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setStockProduct(p)} title="Manage inventory">
                      <Boxes className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <DialogTitle className="font-display text-xl sm:text-2xl">
              {editing ? "Edit product" : "New product"}
            </DialogTitle>
          </DialogHeader>

          <div
            className="grid flex-1 gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2 sm:px-6"
            onFocusCapture={scrollFocusedIntoView}
          >
            <Field label="Product name *">
              <AutoSuggestInput
                value={form.product_name}
                onChange={(v) => setForm({ ...form, product_name: v })}
                placeholder="Start typing to search existing products…"
                fetchSuggestions={(q) => {
                  const qq = q.toLowerCase();
                  return products
                    .filter((p) => p.id !== editing?.id)
                    .filter(
                      (p) =>
                        p.product_name.toLowerCase().includes(qq) ||
                        p.product_code.toLowerCase().includes(qq),
                    )
                    .map<Suggestion<Product>>((p) => ({
                      label: p.product_name,
                      sub: `${p.product_code} · ${formatINR(p.offer_price ?? p.mrp)}`,
                      image: p.product_images.sort((a, b) => a.display_order - b.display_order)[0]?.image_url,
                      data: p,
                    }));
                }}
                onPick={(s) => {
                  const p = s.data as Product;
                  if (!p) return;
                  setForm((prev) => ({
                    ...prev,
                    product_name: p.product_name,
                    product_code: p.product_code,
                    main_category_id: p.main_category_id,
                    sub_category_id: p.sub_category_id ?? "",
                    mrp: prev.mrp || p.mrp.toString(),
                    offer_price: prev.offer_price || (p.offer_price?.toString() ?? ""),
                    material: prev.material || (p.material ?? ""),
                    dimensions: prev.dimensions || (p.dimensions ?? ""),
                  }));
                }}
              />
            </Field>
            <Field label="Product code">
              <Input
                value={form.product_code}
                onChange={(e) => setForm({ ...form, product_code: e.target.value.toUpperCase() })}
                placeholder="e.g. HS-234"
                className="uppercase tracking-wide"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Main category">
              <Select value={form.main_category_id} onValueChange={(v) => setForm({ ...form, main_category_id: v, sub_category_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {mainCats.map((c) => <SelectItem key={c.id} value={c.id}>{toTitleCase(c.name)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sub-category">
              <Select value={form.sub_category_id || "__none"} onValueChange={(v) => setForm({ ...form, sub_category_id: v === "__none" ? "" : v })} disabled={!form.main_category_id}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {subsForForm.map((s) => <SelectItem key={s.id} value={s.id}>{toTitleCase(s.name)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="MRP (₹)">
              <Input type="number" min={0} value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
            </Field>
            <Field label="Offer price (₹)">
              <Input type="number" min={0} value={form.offer_price} onChange={(e) => setForm({ ...form, offer_price: e.target.value })} />
            </Field>
            {isAdmin && (
              <Field label="Cost price (₹) — admin only">
                <Input type="number" min={0} value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              </Field>
            )}
            <Field label="Stock quantity">
              <Input type="number" min={0} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </Field>
            <Field label="Reorder level (low-stock alert)">
              <Input type="number" min={0} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
            </Field>
            <Field label="Building" >
              <Select value={formBuilding || "__none"} onValueChange={(v) => v === "__none" ? setForm({ ...form, location_id: "" }) : pickBuilding(v)}>
                <SelectTrigger><SelectValue placeholder="Choose building…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Not assigned —</SelectItem>
                  {buildingOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Floor">
              <Select value={formFloor || "__none"} onValueChange={(v) => v !== "__none" && pickFloor(v)} disabled={!formBuilding}>
                <SelectTrigger><SelectValue placeholder={formBuilding ? "Choose floor…" : "Pick a building first"} /></SelectTrigger>
                <SelectContent>
                  {floorOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Section" wide>
              <div className="space-y-2">
                <Select value={form.location_id || "__none"} onValueChange={(v) => v !== "__none" && pickSection(v)} disabled={!formFloor}>
                  <SelectTrigger><SelectValue placeholder={formFloor ? "Choose section…" : "Pick a floor first"} /></SelectTrigger>
                  <SelectContent>
                    {sectionOptions.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.section ? l.section : `(no section · ${l.floor})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formBuilding && formFloor && (
                  <div className="flex gap-2">
                    <Input
                      value={newSection}
                      onChange={(e) => setNewSection(e.target.value)}
                      placeholder="+ Add new section (e.g. Part A)"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInlineSection(); } }}
                    />
                    <Button type="button" variant="outline" onClick={addInlineSection} disabled={addingSection || !newSection.trim()}>
                      {addingSection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </Field>
            <Field label="Stock status">
              <Select value={form.stock_status} onValueChange={(v: "in_stock" | "out_of_stock") => setForm({ ...form, stock_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">In Stock — available for sale</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock — keep as showcase</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Material">
              <Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="e.g. Solid wood, fabric" />
            </Field>
            <Field label="Dimensions">
              <Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder='e.g. 84" x 36" x 32"' />
            </Field>
            <Field label="Color variants & per-color stock" wide>
              <ProductVariantsEditor
                variants={form.variants}
                onChange={(variants) => setForm({ ...form, variants })}
                locations={locations.filter((l) => l.is_active).map((l) => ({ id: l.id, building: l.building, floor: l.floor, section: l.section }))}
                defaultLocationId={form.location_id || null}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Tip: each color shows as a swatch in the catalog. Click a swatch to switch the photo. Set a per-color location to track which floor that color is physically displayed on.
              </p>
            </Field>
            <Field label="Description" wide>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Images *" wide>
              <ImageUploader value={form.images} onChange={(images) => setForm({ ...form, images })} />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Featured on homepage</p>
                <p className="text-xs text-muted-foreground">Shown in the "Hand-picked" section.</p>
              </div>
              <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">Hide to keep as draft.</p>
              </div>
              <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>)}

      <StockMovementDialog
        product={stockProduct}
        open={!!stockProduct}
        onOpenChange={(o) => { if (!o) setStockProduct(null); }}
        onChanged={load}
      />
      <PriceLabelPrintDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        products={selectedProducts as unknown as LabelProduct[]}
      />
      <LocationsDialog
        open={locationsDialogOpen}
        onOpenChange={setLocationsDialogOpen}
        locations={locations}
        onChanged={loadLocations}
      />
      <CatalogPinDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} />
    </AdminShell>
  );
};

const Field = ({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) => (
  <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export default AdminProducts;
