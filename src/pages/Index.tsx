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
import { HeroSlider } from "@/components/HeroSlider";
import { SectionSlideshow } from "@/components/SectionSlideshow";
import {
  alignClass,
  fetchHomepageData,
  HeroSlide,
  HomepageSection,
  HomepageSettings,
  presetClasses,
} from "@/lib/homepage";
import { cn } from "@/lib/utils";

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
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [settings, setSettings] = useState<HomepageSettings | null>(null);

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
      fetchHomepageData(),
    ]).then(([cats, prods, hp]) => {
      if (cancelled) return;
      setCategories(cats.data ?? []);
      setFeatured((prods.data ?? []) as ProductCardData[]);
      setSlides(hp.slides);
      setSections(hp.sections);
      setSettings(hp.settings);
    });

    // Prefetch downstream chunks well after first paint, so they never
    // compete with the LCP image / hero. ProductDetail no longer drags the
    // PDF lib (loaded on-demand inside its handlers), so this stays cheap.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const prefetch = () => { import("./Catalog.tsx"); import("./ProductDetail.tsx"); };
    if (idle) idle(prefetch, { timeout: 4000 }); else setTimeout(prefetch, 3000);

    return () => { cancelled = true; };
  }, []);

  const heroIntro = sections.find((s) => s.section_key === "hero_intro");
  // All sections except hero_intro render below the hero. Honour admin display_order.
  const belowSections = sections.filter((s) => s.section_key !== "hero_intro");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Dynamic hero slider — falls back to the classic split hero if admin hasn't added slides yet. */}
      {slides.length > 0 ? (
        <HeroSlider slides={slides} />
      ) : (
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-12 py-16 md:grid-cols-2 md:py-24 lg:py-28">
          <div className="animate-fade-up">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              {heroIntro?.eyebrow || "Live Catalog · Updated Daily"}
            </p>
            <h1 className="font-display text-4xl leading-[1.05] text-foreground md:text-6xl lg:text-7xl">
              {heroIntro?.title || (
                <>
                  Furniture, <em className="text-primary not-italic font-display">crafted</em>
                  <br />for the way you live.
                </>
              )}
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              {heroIntro?.body || `${BRAND_TAGLINE} Browse our complete collection of sofas, beds, wardrobes and bespoke interiors — with live pricing and instant WhatsApp inquiry.`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group">
                <Link to={heroIntro?.cta_link || "/catalog"}>
                  {heroIntro?.cta_label || "Explore catalog"}
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={`https://wa.me/${settings?.whatsapp_number || "919526610404"}`} target="_blank" rel="noopener">Chat on WhatsApp</a>
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
      )}

      {/* Optional intro copy block when the slider IS shown — keeps eyebrow/title/body editable from admin */}
      {slides.length > 0 && heroIntro && (heroIntro.eyebrow || heroIntro.title || heroIntro.body) && (
        <section className="container-page py-12 md:py-16">
          <DynamicSection section={heroIntro} />
        </section>
      )}

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

      {/* Admin-managed sections (made-to-order, about, find-us, etc.) */}
      {belowSections.length > 0 && (
        <div className="container-page space-y-16 pb-20 md:space-y-20">
          {belowSections.map((sec) => (
            <DynamicSection key={sec.id} section={sec} />
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        <SiteFooter />
        <WhatsAppFab />
      </Suspense>
    </div>
  );
};

export default Index;

// ---------- helpers ----------

const DynamicSection = ({ section }: { section: HomepageSection }) => {
  const cls = presetClasses(section.style_preset);
  const align = alignClass(section.text_align);
  const isHttp = section.cta_link?.startsWith("http");
  const cta = section.cta_label && section.cta_link ? (
    isHttp ? (
      <Button asChild size="lg" className="mt-6">
        <a href={section.cta_link} target="_blank" rel="noopener">{section.cta_label}</a>
      </Button>
    ) : (
      <Button asChild size="lg" className="mt-6">
        <Link to={section.cta_link}>{section.cta_label}</Link>
      </Button>
    )
  ) : null;

  // Featured ("bold") preset uses a dark gradient banner like the old made-to-order card.
  if (section.style_preset === "bold") {
    return (
      <section className={cn("hero-bg relative overflow-hidden rounded-3xl px-6 py-14 text-primary-foreground md:px-16 md:py-20", align)}>
        {section.eyebrow && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accent">{section.eyebrow}</p>
        )}
        {section.title && (
          <h2 className="mx-auto max-w-2xl font-display text-3xl md:text-5xl">{section.title}</h2>
        )}
        {section.body && (
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80 whitespace-pre-line">{section.body}</p>
        )}
        {cta && <div className={cn(section.text_align === "center" ? "flex justify-center" : "")}>{cta}</div>}
      </section>
    );
  }

  // Two-column when an image is supplied; single column otherwise.
  const galleryUrls = (section.image_urls ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hasGallery = galleryUrls.length > 0;

  if (hasGallery || section.image_url) {
    return (
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className={align}>
          {section.eyebrow && <p className={cn("mb-3", cls.eyebrow)}>{section.eyebrow}</p>}
          {section.title && <h2 className={cls.title}>{section.title}</h2>}
          {section.body && <p className={cn("mt-4 whitespace-pre-line", cls.body)}>{section.body}</p>}
          {cta}
        </div>
        {hasGallery ? (
          <SectionSlideshow images={galleryUrls} alt={section.title ?? ""} />
        ) : (
          <div className="overflow-hidden rounded-3xl shadow-product">
            <img
              src={section.image_url!}
              alt={section.title ?? ""}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={cn("mx-auto max-w-3xl", align)}>
      {section.eyebrow && <p className={cn("mb-3", cls.eyebrow)}>{section.eyebrow}</p>}
      {section.title && <h2 className={cls.title}>{section.title}</h2>}
      {section.body && <p className={cn("mt-4 whitespace-pre-line", cls.body)}>{section.body}</p>}
      {cta && <div className={cn(section.text_align === "center" ? "flex justify-center" : "")}>{cta}</div>}
    </section>
  );
};
