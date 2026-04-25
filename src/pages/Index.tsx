import { useEffect, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import heroImgWebp from "@/assets/hero-living.webp";
import heroImgWebpSm from "@/assets/hero-living-sm.webp";
import heroImgJpg from "@/assets/hero-living.jpg";
import { BRAND_TAGLINE } from "@/lib/brand";

// Below-the-fold — loaded lazily so the home page's initial JS payload is smaller on mobile.
const SiteFooter = lazy(() =>
  import("@/components/SiteFooter").then((m) => ({ default: m.SiteFooter })),
);
const WhatsAppFab = lazy(() =>
  import("@/components/WhatsAppFab").then((m) => ({ default: m.WhatsAppFab })),
);

type Cat = { id: string; name: string; slug: string; image_url: string | null };

const Index = () => {
  const [categories, setCategories] = useState<Cat[]>([]);
  const [featured, setFeatured] = useState<ProductCardData[]>([]);

  useEffect(() => {
    // Fire both queries in parallel — saves one full round-trip on mobile.
    let cancelled = false;
    Promise.all([
      supabase
        .from("main_categories")
        .select("id, name, slug, image_url")
        .order("display_order", { ascending: true })
        .limit(6),
      supabase
        .from("products")
        .select("id, product_name, product_code, mrp, offer_price, available_colors, stock_quantity, product_images(image_url, display_order)")
        .eq("is_published", true)
        .eq("is_featured", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
    ]).then(([cats, prods]) => {
      if (cancelled) return;
      setCategories(cats.data ?? []);
      setFeatured((prods.data ?? []) as ProductCardData[]);
    });

    // Prefetch the catalog chunk while the browser is idle so navigating
    // from home → catalog feels instant on mobile.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const prefetch = () => { import("./Catalog.tsx"); import("./ProductDetail.tsx"); };
    if (idle) idle(prefetch); else setTimeout(prefetch, 1500);

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-12 py-16 md:grid-cols-2 md:py-24 lg:py-28">
          <div className="animate-fade-up">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Live Catalog · Updated Daily
            </p>
            <h1 className="font-display text-4xl leading-[1.05] text-foreground md:text-6xl lg:text-7xl">
              Furniture, <em className="text-primary not-italic font-display">crafted</em>
              <br />for the way you live.
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              {BRAND_TAGLINE} Browse our complete collection of sofas, beds, wardrobes and bespoke interiors — with live pricing and instant WhatsApp inquiry.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group">
                <Link to="/catalog">
                  Explore catalog
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="https://wa.me/919526610404" target="_blank" rel="noopener">Chat on WhatsApp</a>
              </Button>
            </div>
          </div>
          <div className="relative animate-scale-in">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl" />
            <picture>
              <source media="(max-width: 767px)" srcSet={heroImgWebpSm} type="image/webp" />
              <source srcSet={heroImgWebp} type="image/webp" />
              <img
                src={heroImgJpg}
                alt="Living room styled with Hitech furniture"
                fetchPriority="high"
                decoding="async"
                width={800}
                height={1000}
                className="relative aspect-[4/5] w-full rounded-3xl object-cover shadow-elegant md:aspect-[5/6]"
              />
            </picture>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl bg-card p-5 shadow-product md:block">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">From</p>
              <p className="font-display text-2xl font-semibold text-primary">₹ 12,500</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-16 md:py-20">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Browse</p>
            <h2 className="font-display text-3xl text-foreground md:text-4xl">Shop by category</h2>
          </div>
          <Link to="/catalog" className="text-sm font-medium text-primary hover:underline">
            View all →
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">No categories yet. Sign in to your dashboard to add the first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/catalog?cat=${c.slug}`}
                className="img-frame group relative aspect-square transition-smooth hover:shadow-product"
              >
                {c.image_url ? (
                  <img
                    src={
                      c.image_url.includes("/storage/v1/object/public/")
                        ? c.image_url.replace("/object/public/", "/render/image/public/") +
                          (c.image_url.includes("?") ? "&" : "?") +
                          "width=320&quality=72&resize=contain"
                        : c.image_url
                    }
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    width={320}
                    height={320}
                    className="h-full w-full object-contain p-4 transition-smooth group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                    <span className="font-display text-2xl text-primary">{c.name[0]}</span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-foreground/70 via-foreground/0 to-transparent" />
                <span className="absolute bottom-3 left-3 right-3 z-10 font-display text-base font-semibold text-background">
                  {c.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured products */}
      <section className="container-page py-16 md:py-20">
        <div className="mb-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Featured</p>
          <h2 className="font-display text-3xl text-foreground md:text-4xl">Hand-picked pieces</h2>
        </div>
        {featured.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">No featured products yet.</p>
            <Button asChild variant="link" className="mt-2">
              <Link to="/catalog">Browse the catalog →</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* CTA banner */}
      <section className="container-page pb-20">
        <div className="hero-bg relative overflow-hidden rounded-3xl px-8 py-14 text-center text-primary-foreground md:px-16 md:py-20">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accent">Made to order</p>
          <h2 className="mx-auto max-w-2xl font-display text-3xl md:text-5xl">
            Have something specific in mind?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Send us a photo or sketch on WhatsApp and our team will craft it to your dimensions.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <a href="https://wa.me/919526610404" target="_blank" rel="noopener">Start a conversation</a>
          </Button>
        </div>
      </section>

      <Suspense fallback={null}>
        <SiteFooter />
        <WhatsAppFab />
      </Suspense>
    </div>
  );
};

export default Index;
