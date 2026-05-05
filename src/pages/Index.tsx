import { useEffect, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { HeroSlider } from "@/components/HeroSlider";
import { SectionSlideshow } from "@/components/SectionSlideshow";
import { HeroWindowReveal } from "@/components/HeroWindowReveal";
import { Seo } from "@/components/Seo";
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
  // Global loading guard — prevents the brief flash of the placeholder
  // hero before homepage data finishes loading.
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Fire both queries in parallel — saves one full round-trip on mobile.
    let cancelled = false;
    const loadCategories = async () => {
      const { data } = await supabase
        .from("main_categories")
        .select("id, name, slug, image_url")
        .is("deleted_at", null)
        .order("display_order", { ascending: true });
      if (!cancelled) setCategories(data ?? []);
    };
    Promise.all([
      loadCategories(),
      supabase
        .from("products")
        .select("id, product_name, product_code, mrp, offer_price, available_colors, stock_quantity, product_images(image_url, display_order)")
        .eq("is_published", true)
        .eq("is_featured", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
      fetchHomepageData(),
    ]).then(([_cats, prods, hp]) => {
      if (cancelled) return;
      setFeatured((prods.data ?? []) as ProductCardData[]);
      setSlides(hp.slides);
      setSections(hp.sections);
      setSettings(hp.settings);
      setInitializing(false);
    }).catch(() => {
      if (!cancelled) setInitializing(false);
    });

    // Realtime: when admin reorders / edits / adds main categories, refresh instantly.
    const channel = supabase
      .channel("home-main-categories")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "main_categories" },
        () => { loadCategories(); },
      )
      .subscribe();

    // Prefetch downstream chunks well after first paint, so they never
    // compete with the LCP image / hero. ProductDetail no longer drags the
    // PDF lib (loaded on-demand inside its handlers), so this stays cheap.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const prefetch = () => { import("./Catalog.tsx"); import("./ProductDetail.tsx"); };
    if (idle) idle(prefetch, { timeout: 4000 }); else setTimeout(prefetch, 3000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const heroIntro = sections.find((s) => s.section_key === "hero_intro");
  // All sections except hero_intro render below the hero. Honour admin display_order.
  const belowSections = sections.filter((s) => s.section_key !== "hero_intro");

  // Global Loading Guard — show a clean branded splash until homepage data is
  // ready. Prevents the brief flash of the legacy split hero on refresh.
  if (initializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo className="h-16 w-auto" />
        <Loader2 className="h-5 w-5 animate-spin text-primary/70" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Hitech Furniture & Interiors — Custom Sofas, Beds & Wardrobes in Wayanad"
        description="14+ years of crafting custom furniture and interiors in Kalpetta, Wayanad. Browse our live catalog of sofas, beds, wardrobes and more — enquire on WhatsApp."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FurnitureStore",
          name: "Hitech Furniture & Interiors",
          description: "Custom furniture manufacturer and interior designer in Kalpetta, Wayanad. Retail and wholesale.",
          telephone: settings?.contact_phone ?? "+91 95266 10404",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Kalpetta",
            addressRegion: "Kerala",
            addressCountry: "IN",
          },
          url: typeof window !== "undefined" ? window.location.origin : undefined,
        }}
      />
      <SiteHeader />

      {/* Premium "Window Reveal" hero — scroll-linked door-opening cinematic. */}
      <HeroWindowReveal />

      {/* Dynamic hero slider. The legacy split-hero fallback was removed to
          eliminate the flash-of-old-UI on refresh. */}
      {slides.length > 0 && (
        heroIntro && (heroIntro.eyebrow || heroIntro.title || heroIntro.body) ? (
          // Old-model split layout: slider on the left, intro frame on the right (desktop).
          // On mobile they stack — slider first, then intro.
          <section className="container-page py-8 md:py-12">
            <div className="grid items-stretch gap-6 md:grid-cols-2 lg:gap-8">
              <div className="overflow-hidden rounded-3xl shadow-product">
                <HeroSlider slides={slides} />
              </div>
              <div className="flex animate-fade-up flex-col justify-center rounded-3xl border border-border bg-card p-6 shadow-card-soft md:p-10">
                {heroIntro.eyebrow && (
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
                    {heroIntro.eyebrow}
                  </p>
                )}
                {heroIntro.title && (
                  <h1 className="font-display text-3xl leading-[1.1] text-foreground md:text-4xl lg:text-5xl">
                    {heroIntro.title}
                  </h1>
                )}
                {heroIntro.body && (
                  <p className="mt-4 max-w-xl whitespace-pre-line text-base text-muted-foreground">
                    {heroIntro.body}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="group">
                    <Link to={heroIntro.cta_link || "/catalog"}>
                      {heroIntro.cta_label || "Explore catalog"}
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <a href={`https://wa.me/${settings?.whatsapp_number || "919526610404"}`} target="_blank" rel="noopener">
                      Chat on WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <HeroSlider slides={slides} />
        )
      )}

      {/* heroIntro is now rendered inline alongside the slider (above), so no
          separate intro section is needed when slides exist. */}

      {/* Brand story — static "About us" block shown on every visit. */}
      <section className="container-page py-12 md:py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card p-8 text-center shadow-card-soft md:p-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            14+ Years of Craftsmanship
          </p>
          <h2 className="font-display text-3xl text-foreground md:text-4xl">
            Welcome to <span className="text-primary">Hitech Furniture &amp; Interiors</span>
          </h2>
          <p className="mx-auto mt-2 text-sm font-medium text-muted-foreground md:text-base">
            Kalpetta, Wayanad · Retail &amp; Wholesale
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            We are a trusted retail and wholesale furniture shop dedicated to providing high-quality
            solutions for homes and businesses. Our specialty is{" "}
            <span className="font-semibold text-foreground">complete customization</span> — we manufacture
            all types of custom furniture tailored exactly to your space, style, and requirements.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Whether you are looking for a single statement piece, exploring functional designs with
            natural wood textures, or placing a bulk wholesale order, our expert interior design team
            is here to bring your vision to life.
          </p>
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

      {/* Google review CTA — bottom-left, just above the footer edge. */}
      <GoogleReviewCta />
    </div>
  );
};

export default Index;

// ---------- Google review CTA ----------

const GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJh4fFy6kMpjsR9mGrdWARwXo";

const GoogleReviewCta = () => {
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=1&data=" +
    encodeURIComponent(GOOGLE_REVIEW_URL);
  return (
    <section className="container-page pb-10 md:pb-14">
      <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card-soft">
        <div className="shrink-0 rounded-xl border border-border bg-background p-1.5">
          <img
            src={qrUrl}
            alt="Scan to rate Hitech Furniture on Google"
            loading="lazy"
            decoding="async"
            width={72}
            height={72}
            className="h-16 w-16"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1z" />
              </svg>
            ))}
          </div>
          <h3 className="mt-0.5 font-display text-sm font-semibold text-foreground">
            Rate us on Google
          </h3>
          <p className="text-[11px] text-muted-foreground">Scan QR or tap the button</p>
          <Button asChild size="sm" className="mt-1.5 h-7 px-2.5 text-xs">
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Rate now
              <ArrowRight className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

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
