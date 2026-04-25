import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type MainCat = { id: string; name: string; slug: string; image_url: string | null };
type SubCat = { id: string; main_category_id: string; name: string; slug: string };
type Product = ProductCardData & {
  main_category_id: string;
  sub_category_id: string | null;
  mrp: number;
};

// First page size — keeps the initial payload small on 3G/4G so cards
// appear in under a second; the rest streams in on scroll / "Load more".
const PAGE_SIZE = 24;

const Catalog = () => {
  const [params, setParams] = useSearchParams();
  const [mainCats, setMainCats] = useState<MainCat[]>([]);
  const [subCats, setSubCats] = useState<SubCat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  // Defer search text so typing never blocks the main thread while filtering
  // hundreds of products on a low-end phone.
  const deferredSearch = useDeferredValue(search);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  const activeCatSlug = params.get("cat");
  const activeSubSlug = params.get("sub");

  const activeCat = mainCats.find((c) => c.slug === activeCatSlug);

  useEffect(() => {
    // Fire all three queries in parallel so the page paints in 1 round-trip
    // instead of waiting for them to finish sequentially.
    let cancelled = false;
    Promise.all([
      supabase.from("main_categories").select("id, name, slug, image_url").order("display_order"),
      supabase.from("sub_categories").select("id, main_category_id, name, slug").order("display_order"),
      supabase
        .from("products")
        .select("id, main_category_id, sub_category_id, product_name, product_code, mrp, offer_price, available_colors, stock_quantity, product_images(image_url, display_order)")
        .eq("is_published", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]).then(([mc, sc, pr]) => {
      if (cancelled) return;
      setMainCats(mc.data ?? []);
      setSubCats(sc.data ?? []);
      setProducts((pr.data ?? []) as Product[]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const subsForActive = useMemo(
    () => (activeCat ? subCats.filter((s) => s.main_category_id === activeCat.id) : []),
    [activeCat, subCats]
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeCat && p.main_category_id !== activeCat.id) return false;
      if (activeSubSlug) {
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
      return true;
    });
  }, [products, activeCat, activeSubSlug, deferredSearch, subCats]);

  // Reset pagination whenever filters change so we never silently hide results.
  useEffect(() => { setVisible(PAGE_SIZE); }, [activeCatSlug, activeSubSlug, deferredSearch]);

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

  // Landing mode = no category chosen and no active search. The user lands on
  // /catalog from "View all" and first picks a category, then sees the
  // matching products list (matching the requested two-step flow).
  const isLandingView = !activeCatSlug && !deferredSearch.trim();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="border-b border-border/60 bg-secondary/40">
        <div className="container-page py-10 md:py-14">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Live Catalog</p>
          <h1 className="font-display text-3xl text-foreground md:text-5xl">
            {isLandingView ? "Shop by category" : activeCat ? activeCat.name : "Browse our collection"}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {isLandingView
              ? "Pick a category to see the pieces inside. You can also search by name or product code."
              : "Filter by sub-category, search by name or product code, and tap any piece for full details and a WhatsApp inquiry."}
          </p>
        </div>
      </div>

      <div className="container-page py-8">
        {/* Search */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or product code…"
              className="pl-9"
            />
          </div>
          {!isLandingView && (
            <p className="text-sm text-muted-foreground">{filtered.length} pieces</p>
          )}
        </div>

        {/* Landing view: only show categories. Once one is picked we switch
            to the filtered product grid below. */}
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
                      {c.name}
                    </span>
                    <span className="rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      {productCountByCat[c.id] ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Back to all categories */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCat(null); setSearch(""); }}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> All categories
              </Button>
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
                  {c.name}
                </Chip>
              ))}
            </div>

            {/* Sub cat chips */}
            {activeCat && subsForActive.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                <Chip subtle active={!activeSubSlug} onClick={() => setSub(null)}>All {activeCat.name}</Chip>
                {subsForActive.map((s) => (
                  <Chip subtle key={s.id} active={activeSubSlug === s.slug} onClick={() => setSub(s.slug)}>
                    {s.name}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )}

        {/* Product grid — only in non-landing view */}
        {!isLandingView && (loading ? (
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
                <ProductCard key={p.id} product={p} />
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
