import { useEffect, useMemo, useState } from "react";
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
import { toast } from "@/hooks/use-toast";
import { formatINR } from "@/lib/brand";
import { Loader2, Lock, ArrowLeft, Search } from "lucide-react";

type Location = { id: string; building: string; floor: string; section: string | null; is_active: boolean };
type MainCat = { id: string; name: string; image_url: string | null };
type SubCat = { id: string; main_category_id: string; name: string; image_url: string | null };
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
  main_category_id: string;
  sub_category_id: string | null;
  product_images: { image_url: string; display_order: number }[];
};

const SS_KEY = "staff_catalog_unlocked";

const StaffCatalog = () => {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(SS_KEY) === "1"; } catch { return false; }
  });
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pinIsSet, setPinIsSet] = useState<boolean | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [loading, setLoading] = useState(true);

  const [building, setBuilding] = useState<string>("__all");
  const [floor, setFloor] = useState<string>("__all");
  const [locationId, setLocationId] = useState<string>("__all");
  const [mainCatId, setMainCatId] = useState<string>("__all");
  const [subCatId, setSubCatId] = useState<string>("__all");
  const [stockFilter, setStockFilter] = useState<"available" | "out" | "all">("available");
  const [search, setSearch] = useState("");
  // When user clicks "All <Category>" in sub picker, bypass the sub picker step
  const [bypassSubPicker, setBypassSubPicker] = useState(false);

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
        .select("id, product_name, product_code, description, mrp, offer_price, material, dimensions, available_colors, stock_quantity, stock_status, location_id, main_category_id, sub_category_id, product_images(image_url, display_order)")
        .is("deleted_at", null),
      supabase.from("main_categories").select("id, name, image_url").is("deleted_at", null).order("display_order"),
      supabase.from("sub_categories").select("id, main_category_id, name, image_url").is("deleted_at", null).order("display_order"),
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
    () => Array.from(new Set(locations.filter((l) => building === "__all" || l.building === building).map((l) => l.floor))),
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (stockFilter === "available" && (p.stock_status !== "in_stock" || p.stock_quantity <= 0)) return false;
      if (stockFilter === "out" && p.stock_status === "in_stock" && p.stock_quantity > 0) return false;
      if (mainCatId !== "__all" && p.main_category_id !== mainCatId) return false;
      if (subCatId !== "__all" && p.sub_category_id !== subCatId) return false;
      if (locationId !== "__all") {
        if (p.location_id !== locationId) return false;
      } else if (building !== "__all" || floor !== "__all") {
        const loc = locations.find((l) => l.id === p.location_id);
        if (!loc) return false;
        if (building !== "__all" && loc.building !== building) return false;
        if (floor !== "__all" && loc.floor !== floor) return false;
      }
      if (q && !p.product_name.toLowerCase().includes(q) && !p.product_code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, locations, building, floor, locationId, mainCatId, subCatId, stockFilter, search]);

  // Counts for landing tiles
  const productCountByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.main_category_id] = (m[p.main_category_id] ?? 0) + 1;
    return m;
  }, [products]);
  const productCountBySub = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) if (p.sub_category_id) m[p.sub_category_id] = (m[p.sub_category_id] ?? 0) + 1;
    return m;
  }, [products]);

  const activeMainCat = mainCats.find((c) => c.id === mainCatId);
  // Three-step navigation mirrors public catalog
  const isLandingView = mainCatId === "__all" && !search.trim();
  const isSubPickerView =
    mainCatId !== "__all" &&
    subCatId === "__all" &&
    !search.trim() &&
    subCatOptions.length > 0 &&
    !bypassSubPicker;

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
        ) : isLandingView ? (
          mainCats.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No categories yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {mainCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setMainCatId(c.id); setSubCatId("__all"); }}
                  className="group relative aspect-square overflow-hidden rounded-2xl border bg-card text-left transition-shadow hover:shadow-md"
                >
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full object-contain p-4 transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <span className="font-display text-3xl text-primary">{c.name[0]}</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/75 via-foreground/0 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <span className="font-display text-base font-semibold text-background">{c.name}</span>
                    <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      {productCountByCat[c.id] ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : isSubPickerView ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMainCatId("__all")}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> All categories
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => setBypassSubPicker(true)}
                className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 to-accent/10 p-4 text-center transition-shadow hover:shadow-md"
              >
                <span className="font-display text-xl text-primary">All</span>
                <span className="mt-1 text-xs text-muted-foreground">{activeMainCat?.name}</span>
                <span className="mt-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                  {productCountByCat[activeMainCat?.id ?? ""] ?? 0} pieces
                </span>
              </button>
              {subCatOptions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSubCatId(s.id)}
                  className="group relative aspect-square overflow-hidden rounded-2xl border bg-card text-left transition-shadow hover:shadow-md"
                >
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} loading="lazy" className="h-full w-full object-contain p-4 transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <span className="font-display text-2xl text-primary">{s.name[0]}</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/75 via-foreground/0 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <span className="font-display text-base font-semibold text-background">{s.name}</span>
                    <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      {productCountBySub[s.id] ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setMainCatId("__all"); setSubCatId("__all"); setSearch(""); }}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> All categories
              </Button>
              {activeMainCat && subCatOptions.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSubCatId("__all")}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> {activeMainCat.name} sub-categories
                </Button>
              )}
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "item" : "items"}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((p) => {
                const cover = p.product_images?.slice().sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
                const loc = locations.find((l) => l.id === p.location_id);
                const isOut = p.stock_status !== "in_stock" || p.stock_quantity <= 0;
                return (
                  <Card key={p.id} className="overflow-hidden">
                    <div className="aspect-[4/5] bg-muted">
                      {cover ? <img src={cover} alt={p.product_name} loading="lazy" className="h-full w-full object-contain" /> : null}
                    </div>
                    <CardContent className="space-y-1.5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight line-clamp-2">{p.product_name}</p>
                        {isOut ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">Out</Badge>
                        ) : (
                          <Badge className="shrink-0 bg-primary/10 text-primary text-[10px]">In stock · {p.stock_quantity}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Code · {p.product_code}</p>
                      <p className="font-display text-base font-semibold text-primary">{formatINR(p.mrp)}</p>
                      {loc && (
                        <p className="text-[11px] text-muted-foreground">
                          📍 {loc.building} · {loc.floor}{loc.section ? ` · ${loc.section}` : ""}
                        </p>
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
              })}
            </div>
            {filtered.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">No items match these filters.</p>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StaffCatalog;
