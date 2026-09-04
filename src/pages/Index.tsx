import { useEffect, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy, Check, QrCode, Star, MapPin, Phone, ClipboardList, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionSlideshow } from "@/components/SectionSlideshow";
import { LuxuryScrollHero } from "@/components/LuxuryScrollHero";
import { openEnquiryForm } from "@/lib/enquiryForm";

import { Seo } from "@/components/Seo";
import { LOCAL_BUSINESS_JSONLD } from "@/lib/localBusinessSchema";
import {
  alignClass,
  fetchHomepageData,
  HomepageSection,
  HomepageSettings,
  presetClasses,
} from "@/lib/homepage";
import { cn } from "@/lib/utils";

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
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [settings, setSettings] = useState<HomepageSettings | null>(null);

  useEffect(() => {
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
      setSections(hp.sections);
      setSettings(hp.settings);
    }).catch(() => { /* page still renders if optional homepage data fails */ });

    type IdleCb = (cb: () => void, opts?: { timeout: number }) => number;
    const idle = (window as unknown as { requestIdleCallback?: IdleCb }).requestIdleCallback;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const setup = () => {
      if (cancelled) return;
      channel = supabase
        .channel("home-main-categories")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "main_categories" },
          () => { loadCategories(); },
        )
        .subscribe();
      import("./Catalog.tsx"); import("./ProductDetail.tsx");
    };
    if (idle) idle(setup, { timeout: 4000 }); else setTimeout(setup, 2500);

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const brandStory = sections.find((s) => s.section_key === "brand_story");
  const belowSections = sections.filter((s) => s.section_key !== "hero_intro" && s.section_key !== "brand_story");

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Hitech Furniture & Interiors — Custom Sofas, Beds & Wardrobes in Wayanad"
        description="14+ years of crafting custom furniture and interiors in Kalpetta, Wayanad. Browse our live catalog of sofas, beds, wardrobes and more — enquire on WhatsApp."
        jsonLd={{
          ...LOCAL_BUSINESS_JSONLD,
          telephone: settings?.contact_phone ?? LOCAL_BUSINESS_JSONLD.telephone,
        }}
      />
      <SiteHeader />
      <LuxuryScrollHero />

      <section id="about" className="container-page py-14 md:py-20">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-card-soft">
          <div className="grid md:grid-cols-[0.8fr_1.2fr]">
            <div className="flex flex-col justify-between bg-primary px-7 py-9 text-primary-foreground md:px-10 md:py-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground/70">
                  {brandStory?.eyebrow ?? "14+ Years of Craftsmanship"}
                </p>
                <p className="mt-5 font-display text-4xl leading-none md:text-5xl">14+</p>
                <p className="mt-2 max-w-[14rem] text-sm leading-relaxed text-primary-foreground/75">
                  Years serving homes and businesses across Wayanad.
                </p>
              </div>
              <p className="mt-10 text-xs uppercase tracking-[0.22em] text-primary-foreground/60">Kalpetta · Wayanad</p>
            </div>

            <div className="p-7 sm:p-9 md:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Our story</p>
              <h2 className="mt-3 max-w-2xl font-display text-3xl leading-tight text-foreground md:text-4xl">
                {brandStory?.title ?? "Designed for your home. Crafted for your life."}
              </h2>
              <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-7 text-muted-foreground md:text-base">
                {brandStory?.body ?? "From custom sofas and solid-wood dining sets to wardrobes and complete interior solutions, Hitech brings together craftsmanship, comfort and thoughtful design. We create furniture around your space, your needs and the way you live — with local support from our Wayanad team."}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/about" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                  Discover Hitech <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                  Browse furniture <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-5">
        <div className="mx-auto max-w-4xl rounded-2xl bg-muted/55 px-5 py-4 text-center">
          <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
            Serving <strong className="text-foreground">Kalpetta</strong>, <strong className="text-foreground">Sulthan Bathery</strong>,{" "}
            <strong className="text-foreground">Mananthavady</strong>, <strong className="text-foreground">Vythiri</strong>,{" "}
            <strong className="text-foreground">Meppadi</strong>, <strong className="text-foreground">Pulpally</strong> and the wider Wayanad district.
          </p>
        </div>
      </section>

      <section className="container-page py-14 md:py-20">
        <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Furniture collection</p>
            <h2 className="font-display text-3xl text-foreground md:text-4xl">Explore by category</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Browse our live collection and find pieces for every room, style and requirement.
            </p>
          </div>
          <Link to="/catalog" className="hidden items-center gap-2 text-sm font-bold text-primary hover:underline sm:flex">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">Our furniture categories will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/catalog?cat=${c.slug}`}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-product"
              >
                <div className="relative aspect-[1/0.88] overflow-hidden bg-muted/40">
                  {c.image_url ? (
                    <img
                      src={
                        c.image_url.includes("/storage/v1/object/public/")
                          ? c.image_url.replace("/object/public/", "/render/image/public/") +
                            (c.image_url.includes("?") ? "&" : "?") +
                            "width=360&quality=76&resize=contain"
                          : c.image_url
                      }
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      width={360}
                      height={320}
                      className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <span className="font-display text-3xl text-primary">{c.name[0]}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-4 py-3.5">
                  <span className="text-sm font-bold text-foreground">{c.name}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <Link to="/catalog" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary sm:hidden">
          View full catalog <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="container-page py-14 md:py-20">
          <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Featured collection</p>
              <h2 className="font-display text-3xl text-foreground md:text-4xl">Selected pieces for your home</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                A curated selection from our current furniture catalog, chosen to help you start exploring.
              </p>
            </div>
            <Link to="/catalog" className="hidden items-center gap-2 text-sm font-bold text-primary hover:underline sm:flex">
              Shop all furniture <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-muted-foreground">Featured products will appear here.</p>
              <Button asChild variant="link" className="mt-2">
                <Link to="/catalog">Browse the catalog →</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          <Link to="/catalog" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary sm:hidden">
            Shop all furniture <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <div className="grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-card-soft lg:grid-cols-2">
          <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">Custom furniture</p>
            <h2 className="mt-4 max-w-xl font-display text-3xl leading-tight text-foreground md:text-5xl">Made for your space, not just any space.</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
              Choose the size, layout, finish, material and comfort that suit your home. From sofas and dining sets to beds, wardrobes and storage, our team helps shape furniture around the way you live.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="rounded-xl" onClick={() => openEnquiryForm()}>
                <ClipboardList className="mr-2 h-5 w-5" /> Start a custom order
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl">
                <Link to="/catalog">Explore furniture <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            <PremiumFeature number="01" title="Designed to fit" text="Furniture planned around your room dimensions and practical needs." />
            <PremiumFeature number="02" title="Your finish" text="Select materials, colours and finishes that match your interior style." />
            <PremiumFeature number="03" title="Comfort first" text="Choose proportions and configurations that work for everyday living." />
            <PremiumFeature number="04" title="Local support" text="Discuss, customise and follow up with our Wayanad-based team." />
          </div>
        </div>
      </section>

      <section id="interiors" className="border-y border-border bg-primary text-primary-foreground">
        <div className="container-page py-16 md:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary-foreground/60">Complete interiors</p>
              <h2 className="mt-4 max-w-2xl font-display text-4xl leading-tight md:text-5xl">From an empty room to a finished home.</h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-primary-foreground/72 md:text-base">
                Hitech brings furniture and interiors together under one roof — helping you plan spaces, customise storage and furniture, coordinate finishes and complete installation with a more seamless experience.
              </p>
              <Button size="lg" variant="secondary" className="mt-8 rounded-xl" onClick={() => openEnquiryForm()}>
                Discuss your interior project <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InteriorStep number="01" title="Plan" text="Understand the room, requirement, style and practical priorities." />
              <InteriorStep number="02" title="Design" text="Develop furniture, storage and finish choices around the space." />
              <InteriorStep number="03" title="Build" text="Coordinate custom furniture and interior elements with attention to detail." />
              <InteriorStep number="04" title="Install" text="Bring the pieces together on site for a finished, usable space." />
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-accent">Why Hitech</p>
          <h2 className="mt-4 font-display text-3xl leading-tight text-foreground md:text-5xl">Premium choices, with a local team you can reach.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            More than a catalog — we combine product choice, customisation, interior guidance and local after-sales support for homes and businesses across Wayanad.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <WhyCard title="14+ Years" text="Experience serving furniture and interior customers across Wayanad." />
          <WhyCard title="Custom Made" text="Furniture can be tailored around space, finish and usage requirements." />
          <WhyCard title="Furniture + Interiors" text="A simpler journey from individual products to complete room solutions." />
          <WhyCard title="Local Support" text="A Kalpetta-area team for showroom visits, enquiries and follow-up." />
        </div>
      </section>

      {belowSections.length > 0 && (
        <div className="container-page space-y-16 py-16 md:space-y-20 md:py-20">
          {belowSections.map((sec) => (
            <DynamicSection key={sec.id} section={sec} />
          ))}
        </div>
      )}

      <section id="contact" className="container-page pb-16 pt-4 md:pb-20">
        <div className="grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-card-soft lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-primary p-8 text-primary-foreground sm:p-10 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary-foreground/65">Visit our showroom</p>
            <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">See the furniture. Feel the finish. Plan your space.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-primary-foreground/75">
              Visit Hitech Furniture & Interiors in the Kalpetta area to explore furniture, discuss custom requirements and plan complete interior solutions with our team.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">Kalpetta · Wayanad</p>
                  <p className="mt-1 text-xs text-primary-foreground/65">Furniture showroom & interior consultation</p>
                </div>
              </div>
              {settings?.contact_phone && (
                <a href={`tel:${settings.contact_phone}`} className="flex items-start gap-3 transition hover:opacity-80">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{settings.contact_phone}</p>
                    <p className="mt-1 text-xs text-primary-foreground/65">Call our showroom team</p>
                  </div>
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-accent">
              <Sparkles className="h-3.5 w-3.5" /> Furniture & Interiors
            </div>
            <h3 className="mt-5 max-w-xl font-display text-3xl leading-tight text-foreground md:text-4xl">Have a room, project or furniture idea in mind?</h3>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
              Tell us what you need. Share your room details, preferred style or product requirement and our team can guide you with suitable options.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="rounded-xl" onClick={() => openEnquiryForm()}>
                <ClipboardList className="mr-2 h-5 w-5" /> Start an enquiry
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl">
                <Link to="/catalog">Browse furniture <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniTrust title="14+ Years" text="Local experience" />
              <MiniTrust title="Custom Made" text="Built for your space" />
              <MiniTrust title="Interiors" text="Design to install" />
              <MiniTrust title="Wayanad" text="Local support" />
            </div>
          </div>
        </div>
      </section>

      {settings?.show_google_review !== false && <GoogleReviewCta />}

      <Suspense fallback={null}>
        <SiteFooter />
        <WhatsAppFab />
      </Suspense>
    </div>
  );
};

export default Index;

const PremiumFeature = ({ number, title, text }: { number: string; title: string; text: string }) => (
  <div className="min-h-44 bg-background p-6 sm:p-8">
    <p className="text-[11px] font-bold tracking-[0.24em] text-accent">{number}</p>
    <h3 className="mt-5 font-display text-xl text-foreground">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
  </div>
);

const InteriorStep = ({ number, title, text }: { number: string; title: string; text: string }) => (
  <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-6 backdrop-blur-sm">
    <p className="text-xs font-bold tracking-[0.24em] text-accent">{number}</p>
    <h3 className="mt-4 font-display text-2xl">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-primary-foreground/68">{text}</p>
  </div>
);

const WhyCard = ({ title, text }: { title: string; text: string }) => (
  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-product">
    <div className="mb-5 h-px w-10 bg-accent" />
    <h3 className="font-display text-xl text-foreground">{title}</h3>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
  </div>
);

const MiniTrust = ({ title, text }: { title: string; text: string }) => (
  <div className="rounded-xl border border-border bg-muted/25 p-3">
    <p className="text-xs font-bold text-foreground">{title}</p>
    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{text}</p>
  </div>
);

const GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJh4fFy6kMpjsR9mGrdWARwXo";

const GoogleReviewCta = () => {
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=2&data=" +
    encodeURIComponent(GOOGLE_REVIEW_URL);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_REVIEW_URL);
      setCopied(true);
      toast({ title: "Link copied", description: "Share it with friends & family." });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast({ title: "Couldn't copy", description: "Please copy the link manually.", variant: "destructive" });
    }
  };

  return (
    <section className="container-page pb-16 md:pb-20">
      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-amber-50/40 p-8 text-center shadow-card-soft md:p-12">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm">
            <Star className="h-7 w-7 fill-current" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Loved your experience?</p>
          <h2 className="font-display text-3xl text-foreground md:text-4xl">Rate us on Google</h2>
          <div className="mt-3 flex items-center justify-center gap-1 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} viewBox="0 0 24 24" className="h-6 w-6 fill-current drop-shadow-sm">
                <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1z" />
              </svg>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground md:text-base">
            One tap opens the star-rating page — or copy the link to share with friends & family.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="group shadow-md">
              <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener">
                Rate us on Google
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={handleCopy}>
              {copied ? (
                <><Check className="h-4 w-4 text-emerald-600" />Link copied</>
              ) : (
                <><Copy className="h-4 w-4" />Copy review link</>
              )}
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
              <QrCode className="h-4 w-4" />
              {showQr ? "Hide QR code" : "Show QR code"}
            </Button>
          </div>

          {showQr && (
            <div className="mt-7 flex animate-fade-up flex-col items-center gap-2">
              <div className="rounded-2xl border border-border bg-background p-3 shadow-sm">
                <img
                  src={qrUrl}
                  alt="Scan to rate Hitech Furniture on Google"
                  loading="lazy"
                  decoding="async"
                  width={180}
                  height={180}
                  className="h-44 w-44"
                />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scan with your phone camera</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

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

  if (section.style_preset === "bold") {
    return (
      <section className={cn("hero-bg relative overflow-hidden rounded-3xl px-6 py-14 text-primary-foreground md:px-16 md:py-20", align)}>
        {section.eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accent">{section.eyebrow}</p>}
        {section.title && <h2 className="mx-auto max-w-2xl font-display text-3xl md:text-5xl">{section.title}</h2>}
        {section.body && <p className="mx-auto mt-4 max-w-xl whitespace-pre-line text-primary-foreground/80">{section.body}</p>}
        {cta && <div className={cn(section.text_align === "center" ? "flex justify-center" : "")}>{cta}</div>}
      </section>
    );
  }

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