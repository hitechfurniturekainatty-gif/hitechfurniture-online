import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/brand";
import { Loader2, Lock, Unlock, ArrowLeft, Search, ArrowUpDown, GripVertical, ShieldCheck } from "lucide-react";
import { FloorReorderDialog, type ReorderItem } from "@/components/admin/FloorReorderDialog";
import { VariantSwatches } from "@/components/VariantSwatches";
import { useAuth } from "@/hooks/useAuth";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Sort floor labels by the leading number when present, so "Floor 1",
 * "Floor 2", "Floor 10" line up naturally and named floors like "Ground"
 * or "Godown" fall after the numbered ones.
 */
const floorNum = (s: string): number => {
  const m = (s || "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : Number.POSITIVE_INFINITY;
};
const floorCompare = (a: string, b: string): number => {
  const na = floorNum(a);
  const nb = floorNum(b);
  if (na !== nb) return na - nb;
  return (a || "").localeCompare(b || "");
};

type Location = { id: string; building: string; floor: string; section: string | null; is_active: boolean };
type MainCat = { id: string; name: string };
type SubCat = { id: string; main_category_id: string; name: string };
type Product = {
  id: string;
  product_name: string;
  product_code: string;
  description: string | null;
  mrp: number;
  offer_price: number | null;
  material: string | null;
  dimensions: string | null;
  available_colors: string[] | null;
  stock_quantity: number;
  stock_status: "in_stock" | "out_of_stock";
  location_id: string | null;
  floor_display_order: number;
  main_category_id: string;
  sub_category_id: string | null;
  product_images: { image_url: string; display_order: number }[];
  product_variants: {
    id: string;
    color_name: string;
    color_hex: string | null;
    image_url: string | null;
    stock_quantity: number;
    display_order: number;
    location_id: string | null;
    floor_display_order: number;
    product_variant_stock: {
      id: string;
      location_id: string;
      quantity: number;
      floor_display_order: number;
    }[];
  }[];
};

/**
 * A single row in the staff floor view. Each (variant × location) stock entry
 * becomes its own row so a colour stocked in two locations shows up on both
 * floors with the right quantity. Variants without per-location stock fall
 * back to a residual "product" row using the product's main location.
 */
type FloorEntry = {
  key: string;                 // unique row key
  /** "product" reorders products row, "variant_stock" reorders a stock-row */
  kind: "product" | "variant_stock";
  /** product.id when kind=product, product_variant_stock.id when kind=variant_stock */
  refId: string;
  product: Product;
  variant: Product["product_variants"][number] | null;
  location_id: string | null;
  floor_display_order: number;
  cover: string | null;
  stock: number;
};

const SS_KEY = "staff_catalog_unlocked";

const StaffCatalog = () => {
  const { isAdmin } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SS_KEY) === "1"; } catch { return false; }
  });
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pinIsSet, setPinIsSet] = useState<boolean | null>(null);

  // Admin "Edit positions" mode: only admins can toggle this on, and the
  // drag-to-reorder handles only appear while it is on. Re-asks for PIN
  // confirmation on each enable so a left-open laptop can't be misused.
  const [editMode, setEditMode] = useState(false);
  const [adminPinOpen, setAdminPinOpen] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminVerifying, setAdminVerifying] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderOpen, setReorderOpen] = useState(false);
  // Optimistic ordering applied while staff drag-and-drop cards on the grid.
  // Stored as the current ordered list of FloorEntry.key values; cleared
  // whenever the underlying filtered list changes shape.
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const [building, setBuilding] = useState<string>("__all");
  const [floor, setFloor] = useState<string>("__all");
  const [locationId, setLocationId] = useState<string>("__all");
  const [mainCatId, setMainCatId] = useState<string>("__all");
  const [subCatId, setSubCatId] = useState<string>("__all");
  const [stockFilter, setStockFilter] = useState<"available" | "out" | "all">("available");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.rpc("catalog_pin_is_set").then(({ data }) => setPinIsSet(!!data));
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    Promise.all([
      supabase.from("product_locations").select("*").eq("is_active", true).order("display_order"),
      supabase
        .from("products")
        .select("id, product_name, product_code, description, mrp, offer_price, material, dimensions, available_colors, stock_quantity, stock_status, location_id, floor_display_order, main_category_id, sub_category_id, product_images(image_url, display_order), product_variants(id, color_name, color_hex, image_url, stock_quantity, display_order, location_id, floor_display_order, product_variant_stock(id, location_id, quantity, floor_display_order))")
        .is("deleted_at", null),
      supabase.from("main_categories").select("id, name").is("deleted_at", null).order("display_order"),
      supabase.from("sub_categories").select("id, main_category_id, name").is("deleted_at", null).order("display_order"),
    ])
      .then(([loc, pr, mc, sc]) => {
        setLocations((loc.data ?? []) as Location[]);
        setProducts((pr.data ?? []) as Product[]);
        setMainCats((mc.data ?? []) as MainCat[]);
        setSubCats((sc.data ?? []) as SubCat[]);
      })
      .catch((e) => toast({ title: "Failed to load catalog", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [unlocked]);

  const verify = async () => {
    setVerifying(true);
    const { data, error } = await supabase.rpc("verify_catalog_pin", { _pin: pin });
    setVerifying(false);
    if (error || !data) {
      return toast({ title: "Wrong PIN", variant: "destructive" });
    }
    try { sessionStorage.setItem(SS_KEY, "1"); } catch { /* ignore */ }
    setUnlocked(true);
  };

  const buildings = useMemo(() => Array.from(new Set(locations.map((l) => l.building))), [locations]);
  const floors = useMemo(
    () => Array.from(new Set(locations.filter((l) => building === "__all" || l.building === building).map((l) => l.floor)))
      .sort(floorCompare),
    [locations, building],
  );
  const locationOptions = useMemo(
    () => locations.filter((l) =>
      (building === "__all" || l.building === building) &&
      (floor === "__all" || l.floor === floor) &&
      !!l.section
    ),
    [locations, building, floor],
  );

  const subCatOptions = useMemo(
    () => subCats.filter((s) => mainCatId === "__all" || s.main_category_id === mainCatId),
    [subCats, mainCatId],
  );

  // Auto-correct dependent selections when their parent options change so
  // we never display a stale/invalid selected value.
  useEffect(() => {
    if (building !== "__all" && !buildings.includes(building)) setBuilding("__all");
  }, [buildings, building]);
  useEffect(() => {
    if (floor !== "__all" && !floors.includes(floor)) setFloor("__all");
  }, [floors, floor]);
  useEffect(() => {
    if (locationId !== "__all" && !locationOptions.some((l) => l.id === locationId)) setLocationId("__all");
  }, [locationOptions, locationId]);
  useEffect(() => {
    if (subCatId !== "__all" && !subCatOptions.some((s) => s.id === subCatId)) setSubCatId("__all");
  }, [subCatOptions, subCatId]);

  // Expand each product into one or more "floor entries" so colors that are
  // physically displayed on different floors show up in their respective
  // floor lists with their own photo + location-specific stock.
  const filtered = useMemo<FloorEntry[]>(() => {
    const q = search.trim().toLowerCase();
    const baseCoverOf = (p: Product) =>
      p.product_images?.slice().sort((a, b) => a.display_order - b.display_order)[0]?.image_url ?? null;

    // Pick the best cover for the *current location filter*: prefer the photo
    // of the first variant that has stock physically present at this floor /
    // section, so the card image always matches what's actually on display.
    const locationCoverOf = (p: Product): string | null => {
      const variants = (p.product_variants ?? []).slice().sort((a, b) => a.display_order - b.display_order);
      const matchHere = variants.find((v) => {
        const rows = v.product_variant_stock ?? [];
        return rows.some((s) => s.quantity > 0 && locInScope(s.location_id));
      });
      if (matchHere?.image_url) return matchHere.image_url;
      const anyVariantWithImg = variants.find((v) => v.image_url);
      return anyVariantWithImg?.image_url ?? baseCoverOf(p);
    };

    const matchesCategory = (p: Product) => {
      if (mainCatId !== "__all" && p.main_category_id !== mainCatId) return false;
      if (subCatId !== "__all" && p.sub_category_id !== subCatId) return false;
      if (q && !p.product_name.toLowerCase().includes(q) && !p.product_code.toLowerCase().includes(q)) return false;
      return true;
    };

    const locInScope = (locId: string | null) => {
      if (locationId !== "__all") return locId === locationId;
      if (building === "__all" && floor === "__all") return true;
      const loc = locations.find((l) => l.id === locId);
      if (!loc) return false;
      if (building !== "__all" && loc.building !== building) return false;
      if (floor !== "__all" && loc.floor !== floor) return false;
      return true;
    };

    const stockOk = (qty: number, statusInStock: boolean) => {
      if (stockFilter === "available") return statusInStock && qty > 0;
      if (stockFilter === "out") return !(statusInStock && qty > 0);
      return true;
    };

    const entries: FloorEntry[] = [];
    for (const p of products) {
      if (!matchesCategory(p)) continue;
      const variants = p.product_variants ?? [];

      // 1) Each per-location stock row of each variant becomes its own entry.
      // A variant stocked in 2 floors yields 2 rows (one per floor).
      // Variants without any stock rows fall under the residual product row.
      let anyVariantHasStockRows = false;
      for (const v of variants) {
        const stockRows = v.product_variant_stock ?? [];
        if (stockRows.length > 0) anyVariantHasStockRows = true;
        for (const s of stockRows) {
          if (!locInScope(s.location_id)) continue;
          // Hide zero-stock rows on a floor — staff requested cleaner floor view.
          if (s.quantity <= 0) continue;
          if (!stockOk(s.quantity, p.stock_status === "in_stock")) continue;
          entries.push({
            key: `s:${s.id}`,
            kind: "variant_stock",
            refId: s.id,
            product: p,
            variant: v,
            location_id: s.location_id,
            floor_display_order: s.floor_display_order ?? 0,
            cover: v.image_url || baseCoverOf(p),
            stock: s.quantity,
          });
        }
      }

      // 2) Residual product row: covers variants with no per-location stock,
      // or products with no variants at all. Skipped when every variant has
      // dedicated stock rows — no need to double-list.
      const variantsWithoutStock = variants.filter((v) => (v.product_variant_stock ?? []).length === 0);
      const hasResidual = !anyVariantHasStockRows || variantsWithoutStock.length > 0 || variants.length === 0;
      if (hasResidual) {
        if (!locInScope(p.location_id)) continue;
        const residualStock = variantsWithoutStock.length > 0
          ? variantsWithoutStock.reduce((s, v) => s + (v.stock_quantity || 0), 0)
          : (variants.length > 0 ? 0 : p.stock_quantity);
        if (!stockOk(residualStock, p.stock_status === "in_stock")) continue;
        entries.push({
          key: `p:${p.id}`,
          kind: "product",
          refId: p.id,
          product: p,
          variant: null,
          location_id: p.location_id,
          floor_display_order: p.floor_display_order ?? 0,
          cover: locationCoverOf(p),
          stock: residualStock,
        });
      }
    }

    // Build a floor-number-aware order: Floor 1 → Floor 2 → Floor 3 → Ground/Godown last.
    // Within the same floor, fall back to the location's natural list order.
    const locOrder = new Map(
      locations
        .slice()
        .sort((a, b) => floorCompare(a.floor, b.floor) || a.building.localeCompare(b.building))
        .map((l, i) => [l.id, i]),
    );
    // Group items on the same floor by product type — sofas together, then
    // wardrobes, then chairs, etc. — using the admin-defined category order.
    const mainOrder = new Map(mainCats.map((m, i) => [m.id, i]));
    const subOrder = new Map(subCats.map((s, i) => [s.id, i]));
    return entries.sort((a, b) => {
      const la = a.location_id ? locOrder.get(a.location_id) ?? 1e9 : 1e9;
      const lb = b.location_id ? locOrder.get(b.location_id) ?? 1e9 : 1e9;
      if (la !== lb) return la - lb;
      const ma = mainOrder.get(a.product.main_category_id) ?? 1e9;
      const mb = mainOrder.get(b.product.main_category_id) ?? 1e9;
      if (ma !== mb) return ma - mb;
      const sa = a.product.sub_category_id ? subOrder.get(a.product.sub_category_id) ?? 1e9 : 1e9;
      const sb = b.product.sub_category_id ? subOrder.get(b.product.sub_category_id) ?? 1e9 : 1e9;
      if (sa !== sb) return sa - sb;
      if (a.floor_display_order !== b.floor_display_order) return a.floor_display_order - b.floor_display_order;
      return a.product.product_name.localeCompare(b.product.product_name);
    });
  }, [products, locations, mainCats, subCats, building, floor, locationId, mainCatId, subCatId, stockFilter, search]);

  const reloadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, product_name, product_code, description, mrp, offer_price, material, dimensions, available_colors, stock_quantity, stock_status, location_id, floor_display_order, main_category_id, sub_category_id, product_images(image_url, display_order), product_variants(id, color_name, color_hex, image_url, stock_quantity, display_order, location_id, floor_display_order, product_variant_stock(id, location_id, quantity, floor_display_order))")
      .is("deleted_at", null);
    setProducts((data ?? []) as Product[]);
  };

  // Drop the local order whenever the filter set changes (different keys),
  // so we don't show a stale order after switching floor / search.
  const filteredKeySig = filtered.map((e) => e.key).join("|");
  useEffect(() => {
    setOrderOverride(null);
  }, [filteredKeySig]);

  const displayed = useMemo<FloorEntry[]>(() => {
    if (!orderOverride) return filtered;
    const map = new Map(filtered.map((e) => [e.key, e]));
    const seen = new Set<string>();
    const ordered: FloorEntry[] = [];
    for (const k of orderOverride) {
      const e = map.get(k);
      if (e) { ordered.push(e); seen.add(k); }
    }
    for (const e of filtered) if (!seen.has(e.key)) ordered.push(e);
    return ordered;
  }, [filtered, orderOverride]);

  // 1-second press-and-hold before a drag starts, so normal taps still work
  // for opening Move popovers, swatches, etc.
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 1000, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 1000, tolerance: 8 } }),
  );

  const onCardDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = displayed.findIndex((x) => x.key === active.id);
    const newIdx = displayed.findIndex((x) => x.key === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(displayed, oldIdx, newIdx);
    setOrderOverride(next.map((x) => x.key));

    // Persist floor_display_order for every item sharing the moved card's
    // location, so the new physical sequence sticks across reloads.
    const movedLoc = next[newIdx].location_id;
    const sameLoc = next.filter((x) => x.location_id === movedLoc);
    setSavingOrder(true);
    try {
      const updates = sameLoc.map((x, i) => {
        const order = (i + 1) * 10;
        if (x.kind === "variant_stock") {
          return supabase.from("product_variant_stock").update({ floor_display_order: order }).eq("id", x.refId);
        }
        return supabase.from("products").update({ floor_display_order: order }).eq("id", x.refId);
      });
      const results = await Promise.all(updates);
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      toast({ title: "Floor order updated", description: "New position saved." });
      await reloadProducts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save new order";
      toast({ title: "Failed to save order", description: msg, variant: "destructive" });
      setOrderOverride(null);
    } finally {
      setSavingOrder(false);
    }
  };

  const reorderScope = useMemo(() => {
    // Reorder is available whenever the staff has narrowed the floor view
    // (specific section, or a single building / floor). Each per-color
    // multi-location stock row is sortable on its own.
    const narrowed = locationId !== "__all" || building !== "__all" || floor !== "__all";
    if (!narrowed) return { canReorder: false, label: "", items: [] as ReorderItem[] };

    let label = "Filtered floor";
    if (locationId !== "__all") {
      const loc = locations.find((l) => l.id === locationId);
      if (loc) label = `${loc.building} · ${loc.floor}${loc.section ? " · " + loc.section : ""}`;
    } else {
      const parts: string[] = [];
      if (building !== "__all") parts.push(building);
      if (floor !== "__all") parts.push(floor);
      label = parts.join(" · ") || label;
    }
    return {
      canReorder: true,
      label,
      items: filtered.map<ReorderItem>((e) => ({
        id: e.refId,
        kind: e.kind,
        product_name: e.product.product_name,
        product_code: e.product.product_code,
        cover_url: e.cover,
        color_label: e.variant?.color_name ?? null,
        color_hex: e.variant?.color_hex ?? null,
        stock: e.stock,
      })),
    };
  }, [locationId, building, floor, locations, filtered]);

  if (!unlocked) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="text-center">
                <Lock className="mx-auto mb-2 h-8 w-8 text-primary" />
                <h1 className="font-display text-2xl">Staff Catalog</h1>
                <p className="text-sm text-muted-foreground">
                  Enter the catalog PIN to view floor-wise stock with MRP &amp; full descriptions.
                </p>
              </div>
              {pinIsSet === false && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  No PIN configured yet. Ask the admin to set one in Products → Catalog PIN.
                </p>
              )}
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verify()}
                placeholder="Catalog PIN"
                autoFocus
              />
              <Button className="w-full" onClick={verify} disabled={verifying || !pin}>
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unlock
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link to="/catalog"><ArrowLeft className="mr-2 h-4 w-4" /> Back to public catalog</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Staff Catalog</h1>
            <p className="text-sm text-muted-foreground">Floor-wise stock view · MRP visible</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ } setUnlocked(false); }}>
            <Lock className="mr-1.5 h-3.5 w-3.5" /> Lock
          </Button>
        </div>

        <Card className="mb-4">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={mainCatId} onValueChange={(v) => { setMainCatId(v); setSubCatId("__all"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All categories</SelectItem>
                  {mainCats.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sub-category</Label>
              <Select value={subCatId} onValueChange={setSubCatId} disabled={subCatOptions.length === 0}>
                <SelectTrigger><SelectValue placeholder={subCatOptions.length === 0 ? "—" : "All sub-categories"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All sub-categories</SelectItem>
                  {subCatOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Building</Label>
              <Select value={building} onValueChange={(v) => { setBuilding(v); setFloor("__all"); setLocationId("__all"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All buildings</SelectItem>
                  {buildings.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Floor</Label>
              <Select value={floor} onValueChange={(v) => { setFloor(v); setLocationId("__all"); }} disabled={floors.length === 0}>
                <SelectTrigger><SelectValue placeholder={floors.length === 0 ? "—" : "All floors"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All floors</SelectItem>
                  {floors.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Section</Label>
              <Select value={locationId} onValueChange={setLocationId} disabled={locationOptions.length === 0}>
                <SelectTrigger><SelectValue placeholder={locationOptions.length === 0 ? "—" : "All sections"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All sections</SelectItem>
                  {locationOptions.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.section} <span className="text-muted-foreground">· {l.building} · {l.floor}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stock view</Label>
              <Select value={stockFilter} onValueChange={(v: "available" | "out" | "all") => setStockFilter(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available now</SelectItem>
                  <SelectItem value="out">Out of stock (showcase)</SelectItem>
                  <SelectItem value="all">Master view</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or code…" className="pl-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "item" : "items"} · floor sequence
                <span className="ml-2 hidden text-[11px] sm:inline">· hold a card to move it · drag while holding to reorder</span>
                {savingOrder && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
              </p>
              {reorderScope.canReorder && (
                <Button size="sm" variant="outline" onClick={() => setReorderOpen(true)} disabled={reorderScope.items.length === 0}>
                  <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /> Arrange floor order
                </Button>
              )}
            </div>
            <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={onCardDragEnd}>
              <SortableContext items={displayed.map((e) => e.key)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {displayed.map((entry) => {
                    const loc = locations.find((l) => l.id === entry.location_id);
                    return (
                      <SortableStaffCard
                        key={entry.key}
                        entry={entry}
                        loc={loc}
                        locations={locations}
                        onMoved={reloadProducts}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            {filtered.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">No items match these filters.</p>
            )}
          </>
        )}
      </main>
      <FloorReorderDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        locationLabel={reorderScope.label}
        items={reorderScope.items}
        onSaved={reloadProducts}
        allLocations={locations.filter((l) => l.is_active).map((l) => ({ id: l.id, building: l.building, floor: l.floor, section: l.section }))}
      />
      <SiteFooter />
    </div>
  );
};

export default StaffCatalog;

// ----- Sortable wrapper: long-press to pick up a card and drop in a new spot -----
const SortableStaffCard = ({
  entry,
  loc,
  locations,
  onMoved,
}: {
  entry: FloorEntry;
  loc: Location | undefined;
  locations: Location[];
  onMoved: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 30 : undefined,
    boxShadow: isDragging ? "0 12px 28px hsl(var(--foreground) / 0.18)" : undefined,
    cursor: isDragging ? "grabbing" : undefined,
    touchAction: "manipulation",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StaffProductCard entry={entry} loc={loc} locations={locations} onMoved={onMoved} />
    </div>
  );
};

// ----- Staff product card (one card per floor entry: product OR pinned color) -----
const StaffProductCard = ({
  entry,
  loc,
  locations,
  onMoved,
}: {
  entry: FloorEntry;
  loc: Location | undefined;
  locations: Location[];
  onMoved: () => void;
}) => {
  const p = entry.product;
  const allVariants = (p.product_variants ?? []).slice().sort((a, b) => a.display_order - b.display_order);
  // When this row represents a color pinned to the current floor, lock the
  // swatch + photo to that color. Other colors live in their own floor rows.
  const pinnedVariant = entry.variant;
  // Side swatches: only show OTHER colors that aren't pinned elsewhere, so
  // the floor view doesn't suggest stock that lives on a different floor.
  const sideVariants = pinnedVariant
    ? []
    : allVariants.filter((v) => !v.location_id);

  const [activeId, setActiveId] = useState<string | null>(pinnedVariant?.id ?? null);
  const activeVariant = pinnedVariant ?? sideVariants.find((v) => v.id === activeId) ?? null;

  const baseCover = p.product_images?.slice().sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
  const cover = activeVariant?.image_url || baseCover;

  const stock = entry.stock;
  const isOut = p.stock_status !== "in_stock" || stock <= 0;

  // Press-and-hold (without moving the finger) opens the Move popover.
  // If the user drags after the hold, dnd-kit takes over (1s drag activation).
  const [moveOpen, setMoveOpen] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const HOLD_MS = 600;
  const MOVE_TOL = 8;
  const clearHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    startPt.current = null;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    // Ignore right-clicks and clicks on interactive controls inside the card
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, [role=combobox], input, select")) return;
    startPt.current = { x: e.clientX, y: e.clientY };
    holdTimer.current = window.setTimeout(() => {
      setMoveOpen(true);
      // brief haptic on supporting devices
      try { navigator.vibrate?.(15); } catch { /* ignore */ }
    }, HOLD_MS);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startPt.current) return;
    const dx = e.clientX - startPt.current.x;
    const dy = e.clientY - startPt.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOL) clearHold();
  };

  return (
    <Card
      className="overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onPointerLeave={clearHold}
    >
      <div className="aspect-[4/5] bg-muted">
        {cover ? <img src={cover} alt={p.product_name} loading="lazy" className="h-full w-full object-contain" /> : null}
      </div>
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-tight line-clamp-2">
            {p.product_name}
            {pinnedVariant && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">· {pinnedVariant.color_name}</span>
            )}
          </p>
          {isOut ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">Out</Badge>
          ) : (
            <Badge className="shrink-0 bg-primary/10 text-primary text-[10px]">
              {pinnedVariant ? "Here" : "In stock"} · {stock}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Code · {p.product_code}</p>
        {sideVariants.length > 0 && (
          <div className="pt-1">
            <VariantSwatches
              variants={sideVariants}
              activeId={activeId ?? sideVariants[0]?.id ?? null}
              onPick={(v) => setActiveId(v.id)}
              size="md"
            />
            {activeVariant && !pinnedVariant && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{activeVariant.color_name}</span>
                {" · "}
                {activeVariant.stock_quantity > 0 ? `${activeVariant.stock_quantity} available` : "Out of stock"}
              </p>
            )}
          </div>
        )}
        {pinnedVariant && allVariants.length > 1 && (
          <p className="text-[11px] text-muted-foreground">
            Other colors of this product are listed under their own floors.
          </p>
        )}
        {p.offer_price && p.offer_price < p.mrp ? (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-base font-semibold text-primary">{formatINR(p.offer_price)}</span>
            <span className="text-xs text-muted-foreground line-through">{formatINR(p.mrp)}</span>
            <Badge className="bg-accent text-accent-foreground text-[10px]">Offer</Badge>
          </div>
        ) : (
          <p className="font-display text-base font-semibold text-primary">{formatINR(p.mrp)}</p>
        )}
        {loc && (
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] text-muted-foreground truncate">
              📍 {loc.building} · {loc.floor}{loc.section ? ` · ${loc.section}` : ""}
            </p>
            <QuickMovePopover entry={entry} locations={locations} onMoved={onMoved} open={moveOpen} onOpenChange={setMoveOpen} />
          </div>
        )}
        {!loc && (
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] text-muted-foreground italic">📍 No location set</p>
            <QuickMovePopover entry={entry} locations={locations} onMoved={onMoved} open={moveOpen} onOpenChange={setMoveOpen} />
          </div>
        )}
        {p.description && (
          <p className="text-xs text-foreground/70 line-clamp-3">{p.description}</p>
        )}
        {(p.material || p.dimensions) && (
          <p className="text-[11px] text-muted-foreground">
            {[p.material, p.dimensions].filter(Boolean).join(" · ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// ----- Quick "Move to Building / Floor / Section" popover -----
// Lets staff walking the floor reposition a product (or a single color row) in
// three taps without opening the bulk reorder dialog.
const QuickMovePopover = ({
  entry,
  locations,
  onMoved,
  open: openProp,
  onOpenChange,
}: {
  entry: FloorEntry;
  locations: Location[];
  onMoved: () => void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) => {
  const current = locations.find((l) => l.id === entry.location_id);
  const [openInner, setOpenInner] = useState(false);
  const open = openProp ?? openInner;
  const setOpen = (o: boolean) => {
    onOpenChange?.(o);
    if (openProp === undefined) setOpenInner(o);
  };
  const [building, setBuilding] = useState<string>(current?.building ?? "");
  const [floor, setFloor] = useState<string>(current?.floor ?? "");
  const [section, setSection] = useState<string>(current?.id ?? "");
  const [saving, setSaving] = useState(false);

  // Reset selections each time popover opens so it always reflects current loc.
  useEffect(() => {
    if (open) {
      setBuilding(current?.building ?? "");
      setFloor(current?.floor ?? "");
      setSection(current?.id ?? "");
    }
  }, [open, current?.building, current?.floor, current?.id]);

  const activeLocs = locations.filter((l) => l.is_active);
  const buildings = Array.from(new Set(activeLocs.map((l) => l.building)));
  const floors = Array.from(
    new Set(activeLocs.filter((l) => !building || l.building === building).map((l) => l.floor)),
  ).sort(floorCompare);
  const sections = activeLocs.filter(
    (l) => (!building || l.building === building) && (!floor || l.floor === floor),
  );

  const save = async () => {
    if (!section) {
      toast({ title: "Pick a section", description: "Building → Floor → Section.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (entry.kind === "variant_stock") {
        const { error } = await supabase
          .from("product_variant_stock")
          .update({ location_id: section, floor_display_order: 0 })
          .eq("id", entry.refId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("products")
          .update({ location_id: section, floor_display_order: 0 })
          .eq("id", entry.refId);
        if (error) throw error;
      }
      const dest = locations.find((l) => l.id === section);
      const label = dest
        ? `${dest.building} · ${dest.floor}${dest.section ? " · " + dest.section : ""}`
        : "new location";
      toast({ title: "Moved", description: `${entry.product.product_name} → ${label}` });
      setOpen(false);
      onMoved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not move item";
      toast({ title: "Failed to move", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 px-1.5 text-[11px] text-primary hover:bg-primary/10"
          aria-label="Move to another location"
        >
          <MapPin className="mr-0.5 h-3 w-3" /> Move
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2" align="end" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-xs font-medium">Move to new spot</p>
          <p className="text-[11px] text-muted-foreground">{entry.product.product_name}{entry.variant ? ` · ${entry.variant.color_name}` : ""}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Building</Label>
          <Select value={building} onValueChange={(v) => { setBuilding(v); setFloor(""); setSection(""); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick building" /></SelectTrigger>
            <SelectContent>
              {buildings.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Floor</Label>
          <Select value={floor} onValueChange={(v) => { setFloor(v); setSection(""); }} disabled={!building}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick floor" /></SelectTrigger>
            <SelectContent>
              {floors.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Section / Part</Label>
          <Select value={section} onValueChange={setSection} disabled={!floor || sections.length === 0}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={sections.length === 0 ? "No sections" : "Pick section"} />
            </SelectTrigger>
            <SelectContent>
              {sections.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.section ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-1.5 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving || !section}>
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
