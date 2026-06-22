import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, MessageCircle, Phone, Star, MapPin, LayoutGrid, Sofa, CookingPot, BedDouble, Trees, Building2, Sparkles, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { openEnquiryForm } from "@/lib/enquiryForm";
import { buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/brand";
import { COMPANY } from "@/lib/companyInfo";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import livingRoomAsset from "@/assets/villa-tour/living-room.png";
import diningRoomAsset from "@/assets/villa-tour/dining-room.png";
import kitchenAsset from "@/assets/villa-tour/kitchen.png";
import masterBedroomAsset from "@/assets/villa-tour/master-bedroom.png";
import balconyAsset from "@/assets/villa-tour/balcony.png";
import villaRevealAsset from "@/assets/villa-tour/villa-reveal.png";
import { SiteHeader } from "@/components/SiteHeader";

const SiteFooter = lazy(() =>
  import("@/components/SiteFooter").then((m) => ({ default: m.SiteFooter })),
);
const WhatsAppFab = lazy(() =>
  import("@/components/WhatsAppFab").then((m) => ({ default: m.WhatsAppFab })),
);

const GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJh4fFy6kMpjsR9mGrdWARwXo";

const villaSections = [
  {
    id: "living-room",
    sectionNo: "01",
    eyebrow: "Luxury Living Room",
    title: "Hitech Furniture & Interiors",
    subtitle: "Crafting Luxury Living Spaces",
    description:
      "Step into a bright ultra-luxury villa where custom furniture, architectural lighting, stone textures, and refined proportions work as one seamless living experience.",
    image: livingRoomAsset,
    alt: "Luxury living room interior with curved sofa, chandelier, marble wall and daylight glazing",
    align: "left" as const,
    notes: ["Slow cinematic zoom", "Smooth parallax scrolling", "Elegant text reveal", "Floating premium UI elements"],
    stat: "14+ years crafting custom interiors",
    icon: Sofa,
  },
  {
    id: "dining-room",
    sectionNo: "02",
    eyebrow: "Luxury Dining Room",
    title: "Elegant Dining Experiences",
    description:
      "The walkthrough glides into a dining space shaped by rich walnut surfaces, sculptural lighting, and hospitality-grade comfort for memorable hosting.",
    image: diningRoomAsset,
    alt: "Luxury dining room with walnut dining table, upholstered chairs and chandelier lighting",
    align: "right" as const,
    notes: ["Seamless walkthrough transition from living room", "Camera glides naturally toward dining area", "Chandelier depth animation", "Luxury fade-in effects"],
    stat: "Tailored dining layouts for modern homes",
    icon: LayoutGrid,
  },
  {
    id: "kitchen",
    sectionNo: "03",
    eyebrow: "Luxury Kitchen",
    title: "Premium Modular Kitchens",
    description:
      "From material selection to storage flow, every kitchen is designed to feel precise, luminous, and quietly opulent in daily use.",
    image: kitchenAsset,
    alt: "Luxury modular kitchen with marble island, walnut cabinetry and warm pendant lighting",
    align: "left" as const,
    notes: ["Smooth movement from dining room", "Camera subtly pushes forward", "Floating information cards", "Premium reveal effects"],
    stat: "Smart layouts, integrated storage, premium finishes",
    icon: CookingPot,
  },
  {
    id: "bedroom",
    sectionNo: "04",
    eyebrow: "Luxury Master Bedroom",
    title: "Luxury Bedrooms Designed For Comfort",
    description:
      "The villa slows into a sanctuary—layered textures, warm lighting, and custom furniture arranged with the poise of a private suite.",
    image: masterBedroomAsset,
    alt: "Luxury master bedroom with upholstered bed, warm walnut panels and panoramic glazing",
    align: "right" as const,
    notes: ["Natural transition from kitchen", "Soft layered parallax", "Luxury hotel-style presentation", "Elegant content animations"],
    stat: "Bedrooms that balance calm, storage and visual warmth",
    icon: BedDouble,
  },
  {
    id: "balcony",
    sectionNo: "05",
    eyebrow: "Luxury Balcony",
    title: "Outdoor Living Reimagined",
    description:
      "The experience opens to fresh air, panoramic views, and curated outdoor furniture that extends the villa lifestyle beyond the interior shell.",
    image: balconyAsset,
    alt: "Luxury balcony lounge with sectional sofa, marble table and panoramic mountain view",
    align: "left" as const,
    notes: ["Open-air transition from bedroom", "Environmental motion effects", "Subtle luxury animations", "Spacious visual experience"],
    stat: "Indoor-outdoor continuity with premium lounge planning",
    icon: Trees,
  },
  {
    id: "villa-reveal",
    sectionNo: "06",
    eyebrow: "Complete Villa Reveal",
    title: "Furniture. Interiors. Lifestyle.",
    subtitle: "Complete Home Solutions By Hitech Furniture & Interiors",
    description:
      "A grand reveal of the full residence—every room connected through one material story, one design language, and one execution partner.",
    image: villaRevealAsset,
    alt: "Full luxury villa exterior reveal with large glazed openings and illuminated interiors",
    align: "center" as const,
    notes: ["Smooth zoom-out", "Reveal the complete villa", "Showcase all designed spaces together", "Cinematic grand finale"],
    stat: "End-to-end design and furnishing under one roof",
    icon: Building2,
  },
];

const services = [
  "Custom Furniture",
  "Interior Design",
  "Modular Kitchens",
  "Living Room Solutions",
  "Dining Room Solutions",
  "Bedroom Solutions",
  "Space Planning",
];

const galleryItems = [
  { title: "Living Room", image: livingRoomAsset, alt: villaSections[0].alt, tall: true },
  { title: "Dining Room", image: diningRoomAsset, alt: villaSections[1].alt },
  { title: "Kitchen", image: kitchenAsset, alt: villaSections[2].alt },
  { title: "Master Bedroom", image: masterBedroomAsset, alt: villaSections[3].alt, wide: true },
  { title: "Balcony", image: balconyAsset, alt: villaSections[4].alt },
  { title: "Villa Reveal", image: villaRevealAsset, alt: villaSections[5].alt, tall: true },
];

const testimonials = [
  {
    quote:
      "They transformed our home into a space that feels luxurious, calm and deeply personal. Every finish and every furniture detail felt considered.",
    name: "Fathima & Niyas",
    label: "Kalpetta Residence",
  },
  {
    quote:
      "From the living room to the kitchen, the execution felt premium and highly organised. The final result looked exactly like a designer show home.",
    name: "Arjun Thomas",
    label: "Villa Interior Project",
  },
  {
    quote:
      "The team balanced beauty and function brilliantly. Storage, comfort, lighting and material selection all came together with a very high-end feel.",
    name: "Rasheeda Salam",
    label: "Custom Home Furnishing",
  },
];

const socialLinks = [
  { label: "Instagram", key: "instagram_url" as const },
  { label: "Facebook", key: "facebook_url" as const },
];

const Index = () => {
  const settings = useHomepageSettings();
  const [activeQuote, setActiveQuote] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveQuote((current) => (current + 1) % testimonials.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const whatsappNumber = settings?.whatsapp_number || WHATSAPP_NUMBER;
  const whatsappUrl = buildWhatsAppUrl("Hello Hitech Furniture & Interiors, I would like to discuss a luxury home interior project.").replace(WHATSAPP_NUMBER, whatsappNumber);
  const phone = settings?.contact_phone || COMPANY.phone;
  const mapsUrl = settings?.google_maps_url || "https://maps.app.goo.gl/hy5mbzYsFP2c3vx27?g_st=iw";
  const mapsEmbed = settings?.google_maps_embed_url || "https://www.google.com/maps?q=Edappetty+Shopping+Centre+Kalpetta+Wayanad&output=embed";
  const addressLines = useMemo(
    () => settings?.address_lines?.length ? settings.address_lines : ["Edappetty Shopping Centre", "Near Amrid, Edappetty", "Kalpetta, Wayanad - 673122"],
    [settings?.address_lines],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Luxury Home Interiors in Wayanad | Hitech Furniture"
        description="Experience Hitech Furniture & Interiors through a cinematic luxury villa tour featuring living rooms, dining rooms, modular kitchens, bedrooms and complete home solutions in Wayanad."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FurnitureStore",
          name: "Hitech Furniture & Interiors",
          description: "Luxury custom furniture, modular kitchens and interior design solutions in Wayanad.",
          telephone: phone,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Kalpetta",
            addressRegion: "Kerala",
            addressCountry: "IN",
          },
          image: villaSections.map((section) => section.image),
          url: typeof window !== "undefined" ? window.location.origin : undefined,
        }}
      />
      <SiteHeader />

      <main>
        <section className="relative isolate min-h-[calc(100svh-4.5rem)] overflow-hidden border-b border-border/60">
          <img
            src={livingRoomAsset}
            alt={villaSections[0].alt}
            className="absolute inset-0 h-full w-full scale-[1.06] object-cover animate-[fade-in_1.4s_ease-out_both]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background)/0.92)_8%,hsl(var(--background)/0.48)_42%,hsl(var(--foreground)/0.06)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent, hsl(var(--background)))]" />

          <div className="container-page relative z-10 flex min-h-[calc(100svh-4.5rem)] items-end py-10 md:items-center md:py-16">
            <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-end">
              <div className="max-w-3xl">
                <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.34em] text-primary/85 md:text-sm">
                  Section 01 — Luxury Living Room
                </p>
                <h1 className="mt-4 animate-fade-up text-5xl leading-[0.95] text-foreground md:text-7xl lg:text-[5.6rem]">
                  Hitech Furniture &amp; Interiors
                </h1>
                <p className="mt-4 max-w-2xl animate-fade-up text-xl font-medium text-primary md:text-2xl">
                  Crafting Luxury Living Spaces
                </p>
                <p className="mt-6 max-w-xl animate-fade-up text-base leading-relaxed text-foreground/72 md:text-lg">
                  A guided daylight tour through one ultra-luxury villa—showing how furniture, interiors, lighting and spatial planning come together as a complete lifestyle experience.
                </p>

                <div className="mt-8 flex flex-wrap gap-3 animate-fade-up">
                  <Button asChild size="lg" className="shadow-elegant">
                    <Link to="/catalog">
                      Explore catalog
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-primary/25 bg-background/70 backdrop-blur-sm">
                    <a href={whatsappUrl} target="_blank" rel="noopener">
                      Chat on WhatsApp
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="ghost" className="bg-card/65 backdrop-blur-sm" onClick={() => openEnquiryForm()}>
                    Start your enquiry
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:justify-self-end">
                <div className="rounded-2xl border border-border/70 bg-card/72 p-5 shadow-card-soft backdrop-blur-md animate-fade-up">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/85">Walkthrough highlights</p>
                  <ul className="mt-4 space-y-3">
                    {villaSections[0].notes.map((item) => (
                      <li key={item} className="flex items-center gap-3 text-sm text-foreground/75">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/18 text-primary">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/72 p-5 shadow-card-soft backdrop-blur-md animate-fade-up">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/85">Luxury villa flow</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {villaSections.map((section) => (
                      <a key={section.id} href={`#${section.id}`} className="rounded-full border border-border/80 bg-background/75 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-smooth hover:border-primary/35 hover:text-primary">
                        {section.sectionNo}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container-page py-8 md:py-12">
          <div className="grid gap-4 rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-card-soft md:grid-cols-3 md:p-7">
            {[
              "Bright daylight luxury interiors",
              "Custom furniture, interiors and kitchens",
              "Architectural storytelling from room to room",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-background/75 px-4 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/18 text-primary">
                  <MoveRight className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium text-foreground/75">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {villaSections.map((section, index) => (
          <VillaSection key={section.id} section={section} index={index} />
        ))}

        <section id="services" className="container-page py-20 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-primary/85">Section 07 — Services</p>
              <h2 className="mt-4 text-4xl text-foreground md:text-5xl">Complete luxury interior services for every room.</h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                From first concept to final styling, we design cohesive residential spaces with furniture, finishes, layouts and built-ins tailored to how you live.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service, idx) => (
                <div key={service} className="group rounded-2xl border border-border/70 bg-card p-5 shadow-card-soft transition-smooth hover:-translate-y-1 hover:shadow-product">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/75">{String(idx + 1).padStart(2, "0")}</p>
                  <h3 className="mt-4 text-xl text-foreground">{service}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Bespoke planning, materials and detailing designed to feel elegant, functional and cohesive within the full home story.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="gallery" className="border-y border-border/60 bg-secondary/45 py-20 md:py-28">
          <div className="container-page">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-primary/85">Section 08 — Project Gallery</p>
                <h2 className="mt-4 text-4xl text-foreground md:text-5xl">A premium gallery of spaces designed to flow together.</h2>
              </div>
              <Button asChild variant="outline" className="w-fit border-primary/25 bg-background/70">
                <Link to="/catalog">Browse all collections</Link>
              </Button>
            </div>

            <div className="grid auto-rows-[180px] gap-4 md:grid-cols-3 md:auto-rows-[220px]">
              {galleryItems.map((item) => (
                <article
                  key={item.title}
                  className={[
                    "group relative overflow-hidden rounded-[1.75rem] border border-border/60 shadow-card-soft",
                    item.tall ? "md:row-span-2" : "",
                    item.wide ? "md:col-span-2" : "",
                  ].join(" ")}
                >
                  <img src={item.image} alt={item.alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,hsl(var(--foreground)/0.68)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-background/70">Villa story</p>
                      <h3 className="mt-2 text-2xl text-background">{item.title}</h3>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background/86 text-primary shadow-card-soft transition-smooth group-hover:translate-x-1">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="testimonials" className="container-page py-20 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-primary/85">Section 09 — Testimonials</p>
              <h2 className="mt-4 text-4xl text-foreground md:text-5xl">What clients feel after the tour becomes their real home.</h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
                Every project is shaped around atmosphere, comfort and long-term satisfaction—so the finished home feels elevated every single day.
              </p>
            </div>
            <div className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-product md:p-8">
              <div className="flex items-center gap-1 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-6 min-h-[150px] text-2xl leading-tight text-foreground md:text-3xl">
                “{testimonials[activeQuote].quote}”
              </blockquote>
              <div className="mt-6 flex items-center justify-between gap-4 border-t border-border/70 pt-5">
                <div>
                  <p className="text-lg font-semibold text-foreground">{testimonials[activeQuote].name}</p>
                  <p className="text-sm text-muted-foreground">{testimonials[activeQuote].label}</p>
                </div>
                <div className="flex gap-2">
                  {testimonials.map((item, idx) => (
                    <button
                      key={item.name}
                      type="button"
                      aria-label={`Show testimonial ${idx + 1}`}
                      onClick={() => setActiveQuote(idx)}
                      className={idx === activeQuote ? "h-2.5 w-10 rounded-full bg-primary" : "h-2.5 w-2.5 rounded-full bg-border transition-smooth hover:bg-primary/45"}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="border-t border-border/60 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--secondary)/0.8))] py-20 md:py-28">
          <div className="container-page">
            <div className="mb-10 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-primary/85">Section 10 — Contact</p>
              <h2 className="mt-4 text-4xl text-foreground md:text-5xl">Begin your own luxury home tour with us.</h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
                Share your room ideas, schedule a call, or start an enquiry. We’ll help shape furniture, interiors, layouts and finishes into one complete home experience.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-card-soft md:p-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button asChild size="lg" className="w-full justify-between">
                    <a href={whatsappUrl} target="_blank" rel="noopener">
                      WhatsApp
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full justify-between border-primary/25 bg-background/80">
                    <a href={`tel:${phone.replace(/\s+/g, "")}`}>
                      Call now
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => openEnquiryForm()}
                  className="mt-4 flex w-full items-center justify-between rounded-2xl border border-border/80 bg-secondary/55 px-5 py-4 text-left shadow-card-soft transition-smooth hover:border-primary/30 hover:bg-secondary"
                >
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/80">Enquiry Form</p>
                    <p className="mt-1 text-base text-foreground/75">Open the guided project enquiry and share what you need.</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-primary" />
                </button>

                <div className="mt-6 rounded-2xl border border-border/70 bg-background/75 p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent/18 text-primary">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-foreground">Visit the studio</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{addressLines.join(" · ")}</p>
                      <a href={mapsUrl} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                        Open Google Maps
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {socialLinks.map(({ label, key }) =>
                    settings?.[key] ? (
                      <a key={label} href={settings[key] ?? undefined} target="_blank" rel="noopener" className="rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-foreground/75 transition-smooth hover:border-primary/30 hover:text-primary">
                        {label}
                      </a>
                    ) : null,
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-card-soft">
                <iframe
                  title="Hitech Furniture & Interiors map"
                  src={mapsEmbed}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-[520px] w-full"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <SiteFooter />
        <WhatsAppFab />
      </Suspense>
    </div>
  );
};

type VillaSectionProps = {
  section: (typeof villaSections)[number];
  index: number;
};

const VillaSection = ({ section, index }: VillaSectionProps) => {
  const Icon = section.icon;
  const reverse = section.align === "right";
  const centered = section.align === "center";

  return (
    <section id={section.id} className={index % 2 === 1 ? "bg-secondary/35 py-20 md:py-28" : "py-20 md:py-28"}>
      <div className="container-page">
        <div className={centered ? "mx-auto max-w-5xl" : `grid gap-8 lg:items-center ${reverse ? "lg:grid-cols-[0.92fr_1.08fr]" : "lg:grid-cols-[1.08fr_0.92fr]"}`}>
          <div className={centered ? "mb-10 text-center" : reverse ? "order-2" : "order-1"}>
            <div className={centered ? "mx-auto max-w-3xl" : "max-w-xl"}>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-primary/85">Section {section.sectionNo} — {section.eyebrow}</p>
              <h2 className="mt-4 text-4xl leading-tight text-foreground md:text-5xl lg:text-6xl">{section.title}</h2>
              {section.subtitle && <p className="mt-4 text-lg font-medium text-primary md:text-xl">{section.subtitle}</p>}
              <p className="mt-6 text-base leading-relaxed text-muted-foreground md:text-lg">{section.description}</p>

              <div className={centered ? "mt-8 grid gap-4 md:grid-cols-2" : "mt-8 grid gap-4 sm:grid-cols-2"}>
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card-soft">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/18 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-foreground/75">{section.stat}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/75">Animation direction</p>
                  <p className="mt-2 text-sm text-foreground/72">{section.notes[0]}</p>
                </div>
              </div>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {section.notes.map((item) => (
                  <li key={item} className="rounded-2xl border border-border/65 bg-background/75 px-4 py-3 text-sm text-foreground/72 shadow-card-soft">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={centered ? "mx-auto w-full max-w-5xl" : reverse ? "order-1" : "order-2"}>
            <div className="group relative overflow-hidden rounded-[2rem] border border-border/65 shadow-product">
              <img src={section.image} alt={section.alt} loading="lazy" decoding="async" className={`w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03] ${centered ? "aspect-[16/10]" : "aspect-[4/5] md:aspect-[16/11]"}`} />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_42%,hsl(var(--foreground)/0.54)_100%)]" />
              <div className="absolute left-5 top-5 rounded-full border border-border/60 bg-card/72 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-primary/85 backdrop-blur-sm">
                {section.eyebrow}
              </div>
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-4">
                <div className="rounded-2xl border border-border/45 bg-card/68 px-4 py-3 text-sm text-foreground/78 backdrop-blur-md shadow-card-soft">
                  Guided transition · {section.sectionNo}
                </div>
                <div className="rounded-full border border-border/45 bg-card/68 p-3 text-primary backdrop-blur-md shadow-card-soft">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Index;
