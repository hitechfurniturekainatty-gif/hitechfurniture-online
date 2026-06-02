import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, ArrowLeft, SlidersHorizontal, FileDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Seo } from "@/components/Seo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toTitleCase } from "@/lib/textCase";
import { toast } from "@/hooks/use-toast";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { useAuth } from "@/hooks/useAuth";

type MainCat = { id: string; name: string; slug: string; image_url: string | null };
type SubCat = { id: string; main_category_id: string; name: string; slug: string; image_url: string | null };
type Product = ProductCardData & {
  main_category_id: string;
  sub_category_id: string | null;
  mrp: number;
  offer_price: number | null;
  material?: string | null;
  dimensions?: string | null;
  __isBundle?: boolean;
};

// First page size — keeps the initial payload small on 3G/4G so cards
// appear in under a second; the rest streams in on scroll / "Load more".
const PAGE_SIZE = 24;

const Catalog = () => {
  const [params, setParams] = useSearchParams();
  const homeSettings = useHomepageSettings();
  const hidePrices = !!homeSettings?.hide_public_prices;
  const { isStaff } = useAuth();
  // Admin can hide the entire public catalog. Staff (signed in) still see it.
  const catalogHidden = homeSettings?.show_public_catalog === false && !isStaff;
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  // Defer search text so typing never blocks the main thread while filtering
  // hundreds of products on a low-end phone.
  const deferredSearch = useDeferredValue(search);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  // --- Advanced filter state (price, material, in-stock, sort) ---
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [material, setMaterial] = useState<string>("__all__");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<string>("newest");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const activeCatSlug = params.get("cat");
  const activeSubSlug = params.get("sub");

  const activeCat = mainCats.find((c) => c.slug === activeCatSlug);

  useEffect(() => {
    // Fire all three queries in parallel so the page paints in 1 round-trip
    // instead of waiting for them to finish sequentially.
    let cancelled = false;
    Promise.all([
      supabase.from("main_categories").select("id, name, slug, image_url").order("display_order"),
      supabase.from("sub_categories").select("id, main_category_id, name, slug, image_url").order("display_order"),
      supabase
        .from("products")
        .select("id, main_category_id, sub_category_id, product_name, product_code, mrp, offer_price, available_colors, stock_quantity, material, dimensions, product_images(image_url, display_order), product_variants(id, color_name, color_hex, image_url, stock_quantity, display_order)")
        .eq("is_published", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("product_bundles")
        .select("id, main_category_id, sub_category_id, bundle_code, name, mrp, offer_price, available_colors, stock_status, material, dimensions, main_image_url")
        .eq("is_published", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]).then(([mc, sc, pr, bn]) => {
      if (cancelled) return;
      setMainCats(mc.data ?? []);
      setSubCats(sc.data ?? []);
      const bundles: Product[] = ((bn.data ?? []) as any[]).map((b) => ({
        id: b.id,
        main_category_id: b.main_category_id,
        sub_category_id: b.sub_category_id,
        product_name: b.name,
        product_code: b.bundle_code,
        mrp: Number(b.mrp ?? 0),
        offer_price: b.offer_price != null ? Number(b.offer_price) : null,
        available_colors: b.available_colors ?? [],
        stock_quantity: b.stock_status === "out_of_stock" ? 0 : 1,
        material: b.material,
        dimensions: b.dimensions,
        product_images: b.main_image_url ? [{ image_url: b.main_image_url, display_order: 0 }] : [],
        product_variants: [],
        __isBundle: true,
      }));
      setProducts([...((pr.data ?? []) as Product[]), ...bundles]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const subsForActive = useMemo(
    () => (activeCat ? subCats.filter((s) => s.main_category_id === activeCat.id) : []),
    [activeCat, subCats]
  );

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      if (activeCat && p.main_category_id !== activeCat.id) return false;
      if (activeSubSlug && activeSubSlug !== "__all__") {
        const sub = subCats.find((s) => s.slug === activeSubSlug && s.main_category_id === activeCat?.id);
        if (sub && p.sub_category_id !== sub.id) return false;
      }
      if (deferredSearch) {
        const q = deferredSearch.toLowerCase();
        if (
          !p.product_name.toLowerCase().includes(q) &&
          !p.product_code.toLowerCase().includes(q)
        )
          return false;
      }
      // Effective price (offer if set, else MRP) used for both filtering & sorting
      const eff = p.offer_price && p.offer_price < p.mrp ? p.offer_price : p.mrp;
      const min = priceMin ? Number(priceMin) : null;
      const max = priceMax ? Number(priceMax) : null;
      if (min != null && !Number.isNaN(min) && eff < min) return false;
      if (max != null && !Number.isNaN(max) && eff > max) return false;
      if (material !== "__all__" && (p.material ?? "").toLowerCase() !== material.toLowerCase()) return false;
      if (inStockOnly && (p.stock_quantity ?? 0) <= 0) return false;
      return true;
    });
    const eff = (p: Product) => (p.offer_price && p.offer_price < p.mrp ? p.offer_price : p.mrp);
    if (sort === "price_asc") list.sort((a, b) => eff(a) - eff(b));
    else if (sort === "price_desc") list.sort((a, b) => eff(b) - eff(a));
    else if (sort === "name_asc") list.sort((a, b) => a.product_name.localeCompare(b.product_name));
    return list;
  }, [products, activeCat, activeSubSlug, deferredSearch, subCats, priceMin, priceMax, material, inStockOnly, sort]);

  // Distinct material list — built once from the loaded payload.
  const materials = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.material && p.material.trim()) set.add(p.material.trim());
    return Array.from(set).sort();
  }, [products]);

  const activeFilterCount =
    (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (material !== "__all__" ? 1 : 0) + (inStockOnly ? 1 : 0);

  // Reset pagination whenever filters change so we never silently hide results.
  useEffect(() => { setVisible(PAGE_SIZE); }, [activeCatSlug, activeSubSlug, deferredSearch, priceMin, priceMax, material, inStockOnly, sort]);

  const visibleProducts = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  const setCat = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug) next.set("cat", slug); else next.delete("cat");
    next.delete("sub");
    setParams(next, { replace: true });
  };
  const setSub = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug) next.set("sub", slug); else next.delete("sub");
    setParams(next, { replace: true });
  };

  // Count products per main category so the landing tiles can show how many
  // pieces live under each category. Cheap to compute client-side because the
  // catalog payload is already in memory.
  const productCountByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.main_category_id] = (m[p.main_category_id] ?? 0) + 1;
    return m;
  }, [products]);

  // Three-step navigation:
  //  1. Landing (no cat, no search)         → show main categories
  //  2. Sub-category picker (cat, no sub)   → show sub-categories of that main
  //     (if the main has no subs, fall through to products directly)
  //  3. Products (cat + sub, OR search)     → show filtered product grid
  const isLandingView = !activeCatSlug && !deferredSearch.trim();
  const isSubPickerView =
    !!activeCatSlug &&
    !activeSubSlug &&
    !deferredSearch.trim() &&
    subsForActive.length > 0;

  // Count products per sub-category for the sub-picker tiles.
  const productCountBySub = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) {
      if (p.sub_category_id) m[p.sub_category_id] = (m[p.sub_category_id] ?? 0) + 1;
    }
    return m;
  }, [products]);

  const downloadCatalogPdf = async () => {
    if (!filtered.length) {
      toast({ title: "Nothing to download", description: "Adjust filters and try again." });
      return;
    }
    setDownloadingPdf(true);
    try {
      const { lazyImport } = await import("@/lib/lazyImport");
      const [{ generateCatalogPdf }, { downloadBlob }] = await Promise.all([
        lazyImport(() => import("@/lib/catalogPdf")),
        lazyImport(() => import("@/lib/downloadBlob")),
      ]);
      const items = filtered.map((p) => {
        const cover = [...(p.product_images ?? [])].sort((a, b) => a.display_order - b.display_order)[0]?.image_url ?? null;
        return {
          product_name: p.product_name,
          product_code: p.product_code,
          mrp: Number(p.mrp),
          offer_price: p.offer_price ? Number(p.offer_price) : null,
          material: p.material ?? null,
          dimensions: p.dimensions ?? null,
          cover_image: cover,
        };
      });
      const title = activeCat ? `${activeCat.name} Catalog` : "Product Catalog";
      const subtitle = "Hitech Furniture & Interiors · Wayanad";
      const blob = await generateCatalogPdf(items, title, subtitle);
      downloadBlob(blob, `hitech-${activeCat?.slug ?? "catalog"}.pdf`);
      toast({ title: "Catalog downloaded", description: "Share it on WhatsApp anytime." });
    } catch (e) {
      console.error(e);
      toast({ title: "PDF generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {catalogHidden && <Navigate to="/" replace />}
      <Seo
        title={
          activeCat
            ? `${activeCat.name} — Hitech Furniture Catalog`
            : "Furniture Catalog — Sofas, Beds, Wardrobes | Hitech Furniture"
        }
        description={
          activeCat
            ? `Browse ${activeCat.name.toLowerCase()} from Hitech Furniture & Interiors, Wayanad. Filter by price, material and stock. Download PDF or enquire on WhatsApp.`
            : "Live furniture catalog — sofas, beds, wardrobes, dining and more from Hitech Furniture & Interiors, Wayanad. Filter, browse and enquire instantly on WhatsApp."
        }
      />
      <SiteHeader />

      <div className="border-b border-border/60 bg-secondary/40">
        <div className="container-page py-10 md:py-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Live Catalog</p>
          <h1 className="font-display text-3xl text-foreground md:text-5xl">
            {isLandingView
              ? "Shop by category"
              : isSubPickerView
                ? activeCat?.name
                : activeCat
                  ? activeCat.name
                  : "Browse our collection"}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {isLandingView
              ? "Pick a category to see what's inside. You can also search by name or product code."
              : isSubPickerView
                ? "Choose a sub-category to see the matching pieces."
                : "Filter by sub-category, search by name or product code, and tap any piece for full details and a WhatsApp inquiry."}
          </p>
        </div>
      </div>

      <div className="container-page py-8">
        {/* Search */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or product code…"
              className="pl-9"
            />
          </div>
          {(
            <div className="flex flex-wrap items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Filter products</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-6">
                    <div>
                      <p className="mb-2 text-sm font-medium">Main category</p>
                      <Select
                        value={activeCatSlug ?? "__all__"}
                        onValueChange={(v) => setCat(v === "__all__" ? null : v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All categories</SelectItem>
                          {mainCats.map((c) => (
                            <SelectItem key={c.id} value={c.slug}>{toTitleCase(c.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {activeCat && subsForActive.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Sub-category</p>
                        <Select
                          value={activeSubSlug ?? "__all__"}
                          onValueChange={(v) => setSub(v === "__all__" ? null : v)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All sub-categories</SelectItem>
                            {subsForActive.map((s) => (
                              <SelectItem key={s.id} value={s.slug}>{toTitleCase(s.name)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!hidePrices && (<div>
                      <p className="mb-2 text-sm font-medium">Price range (₹)</p>
                      <div className="flex items-center gap-2">
                        <Input type="number" inputMode="numeric" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                        <span className="text-muted-foreground">to</span>
                        <Input type="number" inputMode="numeric" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          { label: "Under ₹10k", min: "", max: "10000" },
                          { label: "₹10k–25k", min: "10000", max: "25000" },
                          { label: "₹25k–50k", min: "25000", max: "50000" },
                          { label: "₹50k–1L", min: "50000", max: "100000" },
                          { label: "Above ₹1L", min: "100000", max: "" },
                        ].map((r) => (
                          <button
                            key={r.label}
                            type="button"
                            onClick={() => { setPriceMin(r.min); setPriceMax(r.max); }}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs transition-colors",
                              priceMin === r.min && priceMax === r.max
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:bg-muted"
                            )}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>)}
                    {materials.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Material</p>
                        <Select value={material} onValueChange={setMaterial}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All materials</SelectItem>
                            {materials.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(v === true)} />
                      In stock only
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setPriceMin(""); setPriceMax(""); setMaterial("__all__"); setInStockOnly(false); }}
                    >
                      Clear filters
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              {!isLandingView && !isSubPickerView && (<>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  {!hidePrices && <SelectItem value="price_asc">Price: low → high</SelectItem>}
                  {!hidePrices && <SelectItem value="price_desc">Price: high → low</SelectItem>}
                  <SelectItem value="name_asc">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={downloadCatalogPdf} disabled={downloadingPdf}>
                {downloadingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
                Catalog PDF
              </Button>
              </>)}
            </div>
          )}
          {!isLandingView && (
            <p className="text-sm text-muted-foreground">{filtered.length} pieces</p>
          )}
        </div>

        {/* STEP 1 — Landing: main categories grid */}
        {isLandingView ? (
          loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : mainCats.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
              <p className="text-lg font-display text-foreground">No categories yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {mainCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.slug)}
                  className="img-frame group relative aspect-square overflow-hidden text-left transition-smooth hover:shadow-product"
                >
                  {c.image_url ? (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain p-4 transition-smooth group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <span className="font-display text-3xl text-primary">{c.name[0]}</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-foreground/75 via-foreground/0 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2">
                    <span className="font-display text-base font-semibold text-background">
                      {toTitleCase(c.name)}
                    </span>
                    <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      {productCountByCat[c.id] ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : isSubPickerView ? (
          /* STEP 2 — Sub-category picker for the chosen main category */
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={() => setCat(null)}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> All categories
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSub("__all__")}>
                View all {toTitleCase(activeCat?.name ?? "")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {/* "All in category" tile so users can browse everything */}
              <button
                type="button"
                onClick={() => {
                  // Clearing sub keeps cat active → product grid shows all in main
                  const next = new URLSearchParams(params);
                  next.set("cat", activeCatSlug!);
                  next.set("sub", "__all__");
                  setParams(next, { replace: true });
                }}
                className="img-frame group relative flex aspect-square flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary/15 to-accent/10 p-4 text-center transition-smooth hover:shadow-product"
              >
                <span className="font-display text-xl text-primary">All</span>
                <span className="mt-1 text-xs text-muted-foreground">{toTitleCase(activeCat?.name ?? "")}</span>
                <span className="mt-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                  {productCountByCat[activeCat?.id ?? ""] ?? 0} pieces
                </span>
              </button>
              {subsForActive.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSub(s.slug)}
                  className="img-frame group relative aspect-square overflow-hidden bg-card text-left transition-smooth hover:shadow-product"
                >
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain p-4 transition-smooth group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <span className="font-display text-2xl text-primary">{s.name[0]}</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-foreground/75 via-foreground/0 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2">
                    <span className="font-display text-base font-semibold text-background">
                      {toTitleCase(s.name)}
                    </span>
                    <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      {productCountBySub[s.id] ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* STEP 3 — Product list (cat + sub OR search) */
          <>
            {/* Back to all categories */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setCat(null); setSearch(""); }}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> All categories
                </Button>
                {activeCat && subsForActive.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSub(null)}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> {activeCat.name} sub-categories
                  </Button>
                )}
              </div>
              {(activeSubSlug || search) && (
                <Button variant="ghost" size="sm" onClick={() => { setSub(null); setSearch(""); }}>
                  <X className="mr-1 h-3 w-3" /> Clear sub-filter
                </Button>
              )}
            </div>

            {/* Main cat chips — keep so users can quickly switch */}
            <div className="mb-3 flex flex-wrap gap-2">
              <Chip active={!activeCatSlug} onClick={() => setCat(null)}>All</Chip>
              {mainCats.map((c) => (
                <Chip key={c.id} active={activeCatSlug === c.slug} onClick={() => setCat(c.slug)}>
                  {toTitleCase(c.name)}
                </Chip>
              ))}
            </div>

            {/* Sub cat chips */}
            {activeCat && subsForActive.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                <Chip subtle active={!activeSubSlug} onClick={() => setSub(null)}>All {toTitleCase(activeCat.name)}</Chip>
                {subsForActive.map((s) => (
                  <Chip subtle key={s.id} active={activeSubSlug === s.slug} onClick={() => setSub(s.slug)}>
                    {toTitleCase(s.name)}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )}

        {/* Product grid — only when we're past the picker steps */}
        {!isLandingView && !isSubPickerView && (loading ? (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-lg font-display text-foreground">No products found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((p) => (
                <ProductCard
                  key={(p.__isBundle ? "b-" : "p-") + p.id}
                  product={p}
                  hidePrice={hidePrices}
                  linkPrefix={p.__isBundle ? "bundle" : "product"}
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button variant="outline" size="lg" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Load more ({filtered.length - visible})
                </Button>
              </div>
            )}
          </>
        ))}
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-2 text-right">
        <a
          href="/staff-catalog"
          className="text-[10px] text-muted-foreground/40 hover:text-primary"
          title="Staff access"
        >
          · staff ·
        </a>
      </div>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
};

const Chip = ({
  active,
  subtle,
  onClick,
  children,
}: {
  active: boolean;
  subtle?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-full border px-4 py-1.5 text-sm transition-smooth",
      subtle ? "text-xs" : "font-medium",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background hover:border-primary/50 hover:text-primary"
    )}
  >
    {children}
  </button>
);

export default Catalog;
