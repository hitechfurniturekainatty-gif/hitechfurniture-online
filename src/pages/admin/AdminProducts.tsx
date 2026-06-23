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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil, Plus, Search, Trash2, Boxes, Tag, Printer, AlertTriangle, X, MapPin, KeyRound, LayoutGrid, List as ListIcon, Upload, Package, ChevronRight, ChevronDown, FileDown, QrCode } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/lib/brand";
import { scrollFocusedIntoView } from "@/lib/mobileFocusScroll";
import { AutoSuggestInput, type Suggestion } from "@/components/admin/AutoSuggestInput";
import { StockMovementDialog } from "@/components/admin/StockMovementDialog";
import { ProductQrDialog, type QrTarget } from "@/components/admin/ProductQrDialog";
import { PriceLabelPrintDialog, type LabelProduct } from "@/components/admin/PriceLabelPrintDialog";
import { LocationsDialog } from "@/components/admin/LocationsDialog";
import { CatalogPinDialog } from "@/components/admin/CatalogPinDialog";
import { ProductVariantsEditor, type VariantDraft } from "@/components/admin/ProductVariantsEditor";
import { PriceHistorySection } from "@/components/admin/PriceHistorySection";
import { titleCaseTrim, toTitleCase } from "@/lib/textCase";

type MainCat = { id: string; name: string; image_url: string | null; display_order: number };
type SubCat = { id: string; main_category_id: string; name: string; image_url: string | null; display_order: number };
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
  const { isAdmin, isOfficeStaff, loading: authLoading } = useAuth();
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
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfStockFilter, setPdfStockFilter] = useState<"all" | "ready" | "none">("all");
  // Track the prices we loaded so we can detect changes on save and log
  // a new effective-dated row in product_price_history via the RPC.
  const [origPrices, setOrigPrices] = useState<{ cost: number | null; mrp: number | null; selling: number | null } | null>(null);
  const [priceEffectiveDate, setPriceEffectiveDate] = useState<string>("");
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "stock">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("admin_products_view") as "list" | "grid" | "stock") || "list";
  });
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [stockItemView, setStockItemView] = useState<"grid" | "list">("grid");
  const [stockFilter, setStockFilter] = useState<"all" | "with_stock" | "without_stock">("all");
  // Per-product committed (reserved) quantity from finalized, not-yet-delivered
  // ready-stock items. Live computed via the get_reserved_stock() DB function
  // so it always reflects current orders without storing duplicate state.
  const [reservedMap, setReservedMap] = useState<Record<string, number>>({});
  const reservedOf = (id: string) => reservedMap[id] ?? 0;
  const availableOf = (id: string, onHand: number) => Math.max(0, onHand - reservedOf(id));
  useEffect(() => {
    try { localStorage.setItem("admin_products_view", viewMode); } catch {}
  }, [viewMode]);

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
    // Refresh reserved totals alongside products — kept best-effort so a
    // function/permission glitch never blocks the catalog from rendering.
    try {
      const { data: rs } = await (supabase as any).rpc("get_reserved_stock");
      const map: Record<string, number> = {};
      ((rs ?? []) as { product_id: string; reserved: number }[]).forEach((r) => {
        map[r.product_id] = Number(r.reserved) || 0;
      });
      setReservedMap(map);
    } catch {
      setReservedMap({});
    }
  };

  useEffect(() => {
    load();
    supabase.from("main_categories").select("id, name, image_url, display_order").order("display_order").then(({ data }) => setMainCats((data ?? []) as MainCat[]));
    supabase.from("sub_categories").select("id, main_category_id, name, image_url, display_order").order("display_order").then(({ data }) => setSubCats((data ?? []) as SubCat[]));
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

  // Closing stock — group by main category. Unit value uses cost_price
  // when set, otherwise falls back to offer_price/MRP so the figure is
  // never zero just because cost isn't entered.
  const stockByCategory = useMemo(() => {
    const catName = (id: string) =>
      mainCats.find((c) => c.id === id)?.name || "Uncategorised";
    const groups = new Map<string, { id: string; name: string; items: Product[]; qty: number; amount: number }>();
    for (const p of products) {
      const key = p.main_category_id || "__none";
      const g = groups.get(key) ?? { id: key, name: catName(p.main_category_id), items: [], qty: 0, amount: 0 };
      const unit = Number(p.cost_price ?? p.offer_price ?? p.mrp ?? 0);
      g.items.push(p);
      g.qty += Number(p.stock_quantity) || 0;
      g.amount += unit * (Number(p.stock_quantity) || 0);
      groups.set(key, g);
    }
    let list = Array.from(groups.values());
    if (stockFilter === "with_stock") list = list.filter((g) => g.qty > 1);
    if (stockFilter === "without_stock") list = list.filter((g) => g.qty <= 1);
    return list.sort((a, b) => b.amount - a.amount);
  }, [products, mainCats, stockFilter]);
  const stockTotals = useMemo(
    () => stockByCategory.reduce(
      (a, g) => ({ qty: a.qty + g.qty, amount: a.amount + g.amount }),
      { qty: 0, amount: 0 },
    ),
    [stockByCategory],
  );
  const toggleCat = (id: string) =>
    setExpandedCats((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

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
    setOrigPrices(null);
    setPriceEffectiveDate("");
    setOpen(true);
  };

  const openEdit = async (p: Product) => {
    setEditing(p);
    setOrigPrices({
      cost: p.cost_price != null ? Number(p.cost_price) : null,
      mrp: p.mrp != null ? Number(p.mrp) : null,
      selling: p.offer_price != null ? Number(p.offer_price) : null,
    });
    setPriceEffectiveDate(new Date().toISOString().slice(0, 10));
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
      titleCaseTrim(form.product_code) ||
      `Auto-${Date.now().toString(36)}`;
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
    if (isOfficeStaff) payload.cost_price = form.cost_price ? Number(form.cost_price) : null;

    let productId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast({ title: "Failed", description: error.message, variant: "destructive" }); }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); return toast({ title: "Failed", description: error?.message, variant: "destructive" }); }
      productId = data.id;
    }

    // If editing and any price field changed, record a new effective-dated
    // history row via the RPC (it also re-syncs the live product prices).
    if (editing && productId && origPrices) {
      const newCost = form.cost_price ? Number(form.cost_price) : null;
      const newMrp = form.mrp ? Number(form.mrp) : 0;
      const newSelling = form.offer_price ? Number(form.offer_price) : null;
      const costChanged = isOfficeStaff && (origPrices.cost ?? null) !== newCost;
      const mrpChanged = (origPrices.mrp ?? 0) !== newMrp;
      const sellingChanged = (origPrices.selling ?? null) !== newSelling;
      if (costChanged || mrpChanged || sellingChanged) {
        const eff = priceEffectiveDate ? new Date(priceEffectiveDate).toISOString() : new Date().toISOString();
        const { error: rpcErr } = await supabase.rpc("apply_product_price_change", {
          _product_id: productId,
          _cost_price: isOfficeStaff ? newCost : null,
          _selling_price: newSelling,
          _mrp: newMrp,
          _effective_from: eff,
          _note: null,
        });
        if (rpcErr) {
          // Non-fatal — the live product row was already updated above.
          toast({ title: "Price saved, history log failed", description: rpcErr.message, variant: "destructive" });
        } else {
          setHistoryReloadKey((k) => k + 1);
          setOrigPrices({ cost: newCost, mrp: newMrp, selling: newSelling });
        }
      }
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

  type PdfScope =
    | { type: "all" }
    | { type: "main"; id: string }
    | { type: "sub"; id: string }
    | { type: "product"; id: string };

  const downloadProductsPdf = async (
    mode: "all" | "ready" | "none",
    scope: PdfScope = { type: "all" },
  ) => {
    setPdfBusy(true);
    try {
      // Filter by stock mode
      const pool = products.filter((p) => {
        if (p.deleted_at) return false;
        if (scope.type === "main" && p.main_category_id !== scope.id) return false;
        if (scope.type === "sub" && p.sub_category_id !== scope.id) return false;
        if (scope.type === "product" && p.id !== scope.id) return false;
        if (mode === "ready") return p.stock_status === "in_stock" && p.stock_quantity > 0;
        if (mode === "none") return p.stock_status === "out_of_stock" || p.stock_quantity <= 0;
        return true;
      });

      if (pool.length === 0) {
        toast({ title: "Nothing to download", description: "No products match this filter." });
        return;
      }

      // Group by Main Category → Sub-category, ordered by display_order
      const productToItem = (p: typeof pool[number]) => {
        const cover = [...(p.product_images ?? [])]
          .sort((a, b) => a.display_order - b.display_order)[0]?.image_url ?? null;
        return {
          product_name: p.product_name,
          product_code: p.product_code,
          mrp: Number(p.mrp),
          offer_price: p.offer_price != null ? Number(p.offer_price) : null,
          material: p.material ?? null,
          dimensions: p.dimensions ?? null,
          cover_image: cover,
          stock_quantity: Number(p.stock_quantity) || 0,
          stock_status: p.stock_status,
        };
      };

      const orderedMains = [...mainCats].sort(
        (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name),
      );
      // Track unknown main category for any orphan products
      const sectionsBuilt = orderedMains
        .map((mc) => {
          const mainItems = pool.filter((p) => p.main_category_id === mc.id);
          if (mainItems.length === 0) return null;
          const mainSubs = subCats
            .filter((s) => s.main_category_id === mc.id)
            .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

          const subSections: { sub_name: string; sub_banner: string | null; items: ReturnType<typeof productToItem>[] }[] = [];
          for (const sc of mainSubs) {
            const subItems = mainItems
              .filter((p) => p.sub_category_id === sc.id)
              .sort((a, b) => a.product_name.localeCompare(b.product_name));
            if (subItems.length === 0) continue;
            subSections.push({
              sub_name: sc.name,
              sub_banner: sc.image_url ?? null,
              items: subItems.map(productToItem),
            });
          }
          // Products without a sub-category
          const orphanSubItems = mainItems
            .filter((p) => !p.sub_category_id || !mainSubs.some((s) => s.id === p.sub_category_id))
            .sort((a, b) => a.product_name.localeCompare(b.product_name));
          if (orphanSubItems.length > 0) {
            subSections.push({
              sub_name: "Other",
              sub_banner: null,
              items: orphanSubItems.map(productToItem),
            });
          }
          return {
            main_name: mc.name,
            main_banner: mc.image_url ?? null,
            subs: subSections,
          };
        })
        .filter(Boolean) as { main_name: string; main_banner: string | null; subs: { sub_name: string; sub_banner: string | null; items: ReturnType<typeof productToItem>[] }[] }[];

      // Products with an unknown main category
      const uncategorisedItems = pool
        .filter((p) => !orderedMains.some((m) => m.id === p.main_category_id))
        .sort((a, b) => a.product_name.localeCompare(b.product_name));
      if (uncategorisedItems.length > 0) {
        sectionsBuilt.push({
          main_name: "Uncategorised",
          main_banner: null,
          subs: [{ sub_name: "All", sub_banner: null, items: uncategorisedItems.map(productToItem) }],
        });
      }

      // Fetch homepage settings (brand details + about) for the cover page
      const { data: hp } = await supabase
        .from("homepage_settings")
        .select("brand_tagline, footer_about, contact_phone, contact_phone_secondary, contact_email, address_lines")
        .limit(1)
        .maybeSingle();

      const { lazyImport } = await import("@/lib/lazyImport");
      const [{ generateStructuredCatalogPdf }, { downloadBlob }, brand] = await Promise.all([
        lazyImport(() => import("@/lib/catalogPdf")),
        lazyImport(() => import("@/lib/downloadBlob")),
        import("@/lib/brand"),
      ]);

      const stockTitleMap = {
        all: "Complete Product Catalog",
        ready: "Ready Stock Catalog",
        none: "No-Stock Inventory Catalog",
      } as const;
      const stockFileMap = {
        all: "all",
        ready: "ready-stock",
        none: "no-stock",
      } as const;
      const slug = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
      let title: string = stockTitleMap[mode];
      let fileName: string = `hitech-products-${stockFileMap[mode]}.pdf`;
      if (scope.type === "main") {
        const mc = mainCats.find((m) => m.id === scope.id);
        const cname = mc?.name ?? "Category";
        title = `${cname} — ${stockTitleMap[mode]}`;
        fileName = `hitech-${slug(cname)}-${stockFileMap[mode]}.pdf`;
      } else if (scope.type === "sub") {
        const sc = subCats.find((s) => s.id === scope.id);
        const mc = sc ? mainCats.find((m) => m.id === sc.main_category_id) : undefined;
        const sname = sc?.name ?? "Sub-category";
        const mname = mc?.name ?? "";
        title = `${mname ? `${mname} › ` : ""}${sname} — ${stockTitleMap[mode]}`;
        fileName = `hitech-${mname ? `${slug(mname)}-` : ""}${slug(sname)}-${stockFileMap[mode]}.pdf`;
      } else if (scope.type === "product") {
        const prod = products.find((p) => p.id === scope.id);
        const pname = prod?.product_name ?? "Product";
        title = pname;
        fileName = `hitech-${slug(pname)}.pdf`;
      }

      const contactLines: string[] = [];
      if (hp?.contact_phone) contactLines.push(hp.contact_phone);
      if (hp?.contact_phone_secondary) contactLines.push(hp.contact_phone_secondary);
      if (hp?.contact_email) contactLines.push(hp.contact_email);
      if (Array.isArray(hp?.address_lines)) contactLines.push(...hp.address_lines.filter(Boolean));
      if (contactLines.length === 0) contactLines.push(brand.CONTACT_LINE);

      const blob = await generateStructuredCatalogPdf(
        sectionsBuilt,
        {
          title,
          brand_name: brand.BRAND_FULL_NAME,
          tagline: hp?.brand_tagline ?? brand.BRAND_TAGLINE,
          about: hp?.footer_about ?? null,
          contact_lines: contactLines,
        },
        brand.CONTACT_LINE,
      );
      downloadBlob(blob, fileName);
      toast({
        title: "PDF downloaded",
        description: `${pool.length} products across ${sectionsBuilt.length} main categor${sectionsBuilt.length === 1 ? "y" : "ies"}.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: "PDF generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <AdminShell>
      {!authLoading && !isOfficeStaff && (
        <div className="rounded-xl border bg-card p-6 text-center">
          <h1 className="font-display text-xl">Staff only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have permission to view Products.</p>
        </div>
      )}
      {!authLoading && isOfficeStaff && (<>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1.5" disabled={pdfBusy}>
                {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Catalog PDF
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Stock filter</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={pdfStockFilter}
                onValueChange={(v) => setPdfStockFilter(v as "all" | "ready" | "none")}
              >
                <DropdownMenuRadioItem value="all">All products</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ready">Ready stock only</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none">No-stock inventory only</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Download</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => downloadProductsPdf(pdfStockFilter, { type: "all" })}>
                Entire catalog (all categories)
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>By main category…</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
                  {mainCats.length === 0 ? (
                    <DropdownMenuItem disabled>No categories</DropdownMenuItem>
                  ) : (
                    [...mainCats]
                      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
                      .map((mc) => (
                        <DropdownMenuItem
                          key={mc.id}
                          onClick={() => downloadProductsPdf(pdfStockFilter, { type: "main", id: mc.id })}
                        >
                          {toTitleCase(mc.name)}
                        </DropdownMenuItem>
                      ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>By sub-category…</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 w-72 overflow-y-auto">
                  {subCats.length === 0 ? (
                    <DropdownMenuItem disabled>No sub-categories</DropdownMenuItem>
                  ) : (
                    [...mainCats]
                      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
                      .flatMap((mc) => {
                        const subs = subCats
                          .filter((s) => s.main_category_id === mc.id)
                          .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
                        if (subs.length === 0) return [];
                        return [
                          <DropdownMenuLabel key={`lbl-${mc.id}`} className="text-xs text-muted-foreground">
                            {toTitleCase(mc.name)}
                          </DropdownMenuLabel>,
                          ...subs.map((sc) => (
                            <DropdownMenuItem
                              key={sc.id}
                              onClick={() => downloadProductsPdf(pdfStockFilter, { type: "sub", id: sc.id })}
                            >
                              {toTitleCase(sc.name)}
                            </DropdownMenuItem>
                          )),
                        ];
                      })
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setPinDialogOpen(true)} className="gap-1.5">
            <KeyRound className="h-4 w-4" /> Catalog PIN
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <Link to="/admin/products/bulk"><Upload className="h-4 w-4" /> Bulk create</Link>
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
        <div className="ml-auto inline-flex rounded-md border bg-background p-0.5">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "list" ? "default" : "ghost"}
            onClick={() => setViewMode("list")}
            className="h-8 gap-1.5 px-2"
            title="List view"
          >
            <ListIcon className="h-3.5 w-3.5" /> List
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            onClick={() => setViewMode("grid")}
            className="h-8 gap-1.5 px-2"
            title="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Grid
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "stock" ? "default" : "ghost"}
            onClick={() => setViewMode("stock")}
            className="h-8 gap-1.5 px-2"
            title="Closing stock by category"
          >
            <Package className="h-3.5 w-3.5" /> Stock
          </Button>
        </div>
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

      {viewMode === "stock" ? (
        <Card>
          <CardContent className="p-2 sm:p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-2 py-3 sm:px-5">
              <div>
                <p className="font-display text-base sm:text-lg">Closing Stock by Category</p>
                <p className="text-xs text-muted-foreground">Valuation uses cost price (fallback: offer / MRP).</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-right">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Qty</p>
                  <p className="font-display text-lg sm:text-xl">{stockTotals.qty}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Value</p>
                  <p className="font-display text-lg text-primary sm:text-xl">{formatINR(stockTotals.amount)}</p>
                </div>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <Button type="button" size="sm" variant={stockItemView === "grid" ? "default" : "ghost"} onClick={() => setStockItemView("grid")} className="h-7 gap-1 px-2 text-xs"><LayoutGrid className="h-3 w-3" /></Button>
                  <Button type="button" size="sm" variant={stockItemView === "list" ? "default" : "ghost"} onClick={() => setStockItemView("list")} className="h-7 gap-1 px-2 text-xs"><ListIcon className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b px-2 py-2 sm:px-5 sm:py-2">
              <Button type="button" size="sm" variant={stockFilter === "all" ? "default" : "ghost"} onClick={() => setStockFilter("all")} className="h-7 text-xs">
                All
              </Button>
              <Button type="button" size="sm" variant={stockFilter === "with_stock" ? "default" : "ghost"} onClick={() => setStockFilter("with_stock")} className="h-7 text-xs">
                With stock
              </Button>
              <Button type="button" size="sm" variant={stockFilter === "without_stock" ? "default" : "ghost"} onClick={() => setStockFilter("without_stock")} className="h-7 text-xs">
                Without stock or total items
              </Button>
            </div>
            {stockByCategory.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No stock data yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {stockByCategory.map((g) => {
                  const open = expandedCats.has(g.id);
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => toggleCat(g.id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 sm:px-5"
                      >
                        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{toTitleCase(g.name)}</p>
                          <p className="text-xs text-muted-foreground">{g.items.length} {g.items.length === 1 ? "product" : "products"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Qty</p>
                          <p className="font-display text-base">{g.qty}</p>
                        </div>
                        <div className="w-28 text-right sm:w-36">
                          <p className="text-xs text-muted-foreground">Value</p>
                          <p className="font-display text-base text-primary">{formatINR(g.amount)}</p>
                        </div>
                      </button>
                      {open && (
                        <div className="border-t bg-muted/20 px-3 py-3 sm:px-5 sm:py-4">
                          {g.items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No items.</p>
                          ) : stockItemView === "grid" ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                              {g.items.map((p) => {
                                const cover = p.product_images.sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
                                const unit = Number(p.cost_price ?? p.offer_price ?? p.mrp ?? 0);
                                const isLow = p.stock_quantity <= (p.reorder_level ?? 5);
                                return (
                                  <button
                                    type="button"
                                    key={p.id}
                                    onClick={() => openEdit(p)}
                                    className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-shadow hover:shadow-md"
                                  >
                                    <div className="relative aspect-square bg-muted">
                                      {cover ? (
                                        <img src={cover} alt={p.product_name} className="h-full w-full object-contain p-2" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
                                      )}
                                      {isLow && (
                                        <Badge variant="destructive" className="absolute right-2 top-2 gap-0.5 text-[10px]">
                                          <AlertTriangle className="h-2.5 w-2.5" />
                                          {p.stock_quantity === 0 ? "Out" : "Low"}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex flex-1 flex-col gap-0.5 p-3">
                                      <p className="line-clamp-2 text-sm font-medium leading-snug">{toTitleCase(p.product_name)}</p>
                                      <p className="truncate text-[11px] text-muted-foreground">Code · {p.product_code}</p>
                                      <div className="mt-1 flex items-end justify-between gap-2">
                                        <div>
                                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Qty</p>
                                          <p className="font-display text-base">{p.stock_quantity}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</p>
                                          <p className="font-display text-sm text-primary">{formatINR(unit * (p.stock_quantity || 0))}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <ul className="divide-y divide-border rounded-lg border bg-card">
                              {g.items.map((p) => {
                                const cover = p.product_images.sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
                                const unit = Number(p.cost_price ?? p.offer_price ?? p.mrp ?? 0);
                                const isLow = p.stock_quantity <= (p.reorder_level ?? 5);
                                return (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      onClick={() => openEdit(p)}
                                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/40"
                                    >
                                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                                        {cover ? <img src={cover} alt="" className="h-full w-full object-contain p-1" /> : null}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{toTitleCase(p.product_name)}</p>
                                        <p className="truncate text-[11px] text-muted-foreground">Code · {p.product_code}</p>
                                      </div>
                                      {isLow && (
                                        <Badge variant="destructive" className="shrink-0 gap-0.5 text-[10px]">
                                          <AlertTriangle className="h-2.5 w-2.5" />
                                          {p.stock_quantity === 0 ? "Out" : "Low"}
                                        </Badge>
                                      )}
                                      <div className="w-14 shrink-0 text-right">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Qty</p>
                                        <p className="font-display text-sm">{p.stock_quantity}</p>
                                      </div>
                                      <div className="w-24 shrink-0 text-right sm:w-32">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</p>
                                        <p className="font-display text-sm text-primary">{formatINR(unit * (p.stock_quantity || 0))}</p>
                                      </div>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
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
                        On {p.stock_quantity} · Res {reservedOf(p.id)} · Avail {availableOf(p.id, p.stock_quantity)}
                      </button>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setStockProduct(p)} title="Manage inventory">
                      <Boxes className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() => downloadProductsPdf("all", { type: "product", id: p.id })}
                      disabled={pdfBusy}
                      title="Download this product as PDF"
                    >
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() => setQrTarget({ productId: p.id, productName: p.product_name, productCode: p.product_code })}
                      title="Generate QR"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isOfficeStaff && (
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
      ) : (
        <div>
          {filtered.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              No products yet. Click "Add product" to begin.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filtered.map((p) => {
                const cover = p.product_images.sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
                const isSelected = selected.has(p.id);
                const isLow = p.stock_quantity <= (p.reorder_level ?? 5);
                return (
                  <div
                    key={p.id}
                    className={`group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="relative aspect-square bg-muted">
                      {cover ? (
                        <img src={cover} alt={p.product_name} className="h-full w-full object-contain p-2" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
                      )}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        aria-label={`Select ${p.product_name} for label printing`}
                        className="absolute left-2 top-2 h-4 w-4 cursor-pointer accent-primary"
                      />
                      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                        {p.is_featured && <Badge className="bg-accent text-accent-foreground text-[10px]">Featured</Badge>}
                        {!p.is_published && <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                        {isLow && (
                          <Badge variant="destructive" className="gap-0.5 text-[10px]">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {p.stock_quantity === 0 ? "Out" : "Low"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <p className="line-clamp-2 text-sm font-medium leading-snug" title={toTitleCase(p.product_name)}>
                        {toTitleCase(p.product_name)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">Code · {p.product_code}</p>
                      <p className="text-sm">
                        <span className="font-semibold text-primary">{formatINR(p.offer_price ?? p.mrp)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setStockProduct(p)}
                        className={`text-left text-xs underline-offset-2 hover:underline ${isLow ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                        title="Manage stock"
                      >
                        On {p.stock_quantity} · Res {reservedOf(p.id)} · Avail {availableOf(p.id, p.stock_quantity)}
                      </button>
                    </div>
                    <div className="flex items-stretch border-t">
                      <button
                        type="button"
                        onClick={() => setStockProduct(p)}
                        className="flex flex-1 items-center justify-center gap-1 py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                        title="Manage inventory"
                      >
                        <Boxes className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadProductsPdf("all", { type: "product", id: p.id })}
                        disabled={pdfBusy}
                        className="flex flex-1 items-center justify-center gap-1 border-l py-2 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                        title="Download PDF"
                      >
                        <FileDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrTarget({ productId: p.id, productName: p.product_name, productCode: p.product_code })}
                        className="flex flex-1 items-center justify-center gap-1 border-l py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                        title="Generate QR"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="flex flex-1 items-center justify-center gap-1 border-l py-2 text-xs hover:bg-accent hover:text-accent-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {isOfficeStaff && (
                        <button
                          type="button"
                          onClick={() => remove(p)}
                          className="flex flex-1 items-center justify-center gap-1 border-l py-2 text-xs text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                onBlur={() => setForm((prev) => ({ ...prev, product_name: toTitleCase(prev.product_name) }))}
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
                onChange={(e) => setForm({ ...form, product_code: e.target.value })}
                onBlur={(e) => setForm((prev) => ({ ...prev, product_code: toTitleCase(e.target.value) }))}
                placeholder="e.g. HS-234"
                className="tracking-wide"
                autoCapitalize="words"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field label="Main category">
              <SearchableSelect
                value={form.main_category_id}
                onChange={(v) => setForm({ ...form, main_category_id: v, sub_category_id: "" })}
                options={mainCats.map((c) => ({ value: c.id, label: toTitleCase(c.name) }))}
                placeholder="Choose…"
              />
            </Field>
            <Field label="Sub-category">
              <SearchableSelect
                value={form.sub_category_id || "__none"}
                onChange={(v) => setForm({ ...form, sub_category_id: v === "__none" ? "" : v })}
                options={[{ value: "__none", label: "— None —" }, ...subsForForm.map((s) => ({ value: s.id, label: toTitleCase(s.name) }))]}
                placeholder="Optional"
                disabled={!form.main_category_id}
              />
            </Field>
            <Field label="MRP (₹)">
              <Input type="number" min={0} value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
            </Field>
            <Field label="Offer price (₹)">
              <Input type="number" min={0} value={form.offer_price} onChange={(e) => setForm({ ...form, offer_price: e.target.value })} />
            </Field>
            {isOfficeStaff && (
              <Field label="Cost price (₹) — staff only">
                <Input type="number" min={0} value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              </Field>
            )}
            {editing && (
              <Field label="Price effective from">
                <Input
                  type="date"
                  value={priceEffectiveDate}
                  onChange={(e) => setPriceEffectiveDate(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Used only when MRP / Selling / Cost is changed. Catalog always shows the current price.
                </p>
              </Field>
            )}
            <Field label="Stock quantity">
              <Input type="number" min={0} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </Field>
            <Field label="Reorder level (low-stock alert)">
              <Input type="number" min={0} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
            </Field>
            <Field label="Building" >
              <SearchableSelect
                value={formBuilding || "__none"}
                onChange={(v) => v === "__none" ? setForm({ ...form, location_id: "" }) : pickBuilding(v)}
                options={[{ value: "__none", label: "— Not assigned —" }, ...buildingOptions.map((b) => ({ value: b, label: b }))]}
                placeholder="Choose building…"
              />
            </Field>
            <Field label="Floor">
              <SearchableSelect
                value={formFloor || ""}
                onChange={(v) => v && pickFloor(v)}
                options={floorOptions.map((f) => ({ value: f, label: f }))}
                placeholder={formBuilding ? "Choose floor…" : "Pick a building first"}
                disabled={!formBuilding}
              />
            </Field>
            <Field label="Section" wide>
              <div className="space-y-2">
                <SearchableSelect
                  value={form.location_id || ""}
                  onChange={(v) => v && pickSection(v)}
                  options={sectionOptions.map((l) => ({ value: l.id, label: l.section ? l.section : `(no section · ${l.floor})` }))}
                  placeholder={formFloor ? "Choose section…" : "Pick a floor first"}
                  disabled={!formFloor}
                />
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
            {editing && (
              <div className="sm:col-span-2 space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Price history</p>
                  <p className="text-[11px] text-muted-foreground">Most recent first</p>
                </div>
                <PriceHistorySection
                  productId={editing.id}
                  showCost={isOfficeStaff}
                  reloadKey={historyReloadKey}
                />
              </div>
            )}
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
      <ProductQrDialog
        open={!!qrTarget}
        onOpenChange={(o) => { if (!o) setQrTarget(null); }}
        target={qrTarget}
      />
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
