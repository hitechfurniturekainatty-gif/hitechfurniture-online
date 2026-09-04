import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ClipboardList, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import livingRoomImage from "@/assets/living-room-hero.png";
import diningRoomImage from "@/assets/dining-room-hero.png";
import kitchenImage from "@/assets/kitchen-hero.png";
import masterBedroomImage from "@/assets/master-bedroom-hero.png";
import balconyImage from "@/assets/balcony-hero.png";
import { openEnquiryForm } from "@/lib/enquiryForm";

type Scene = {
  id: string;
  label: string;
  imageUrl: string;
  alt: string;
};

const SCENES: Scene[] = [
  {
    id: "living-room",
    label: "Living Room",
    imageUrl: livingRoomImage,
    alt: "Luxury living room interior with marble, walnut, chandelier and daylight flooding through tall glass windows",
  },
  {
    id: "dining-room",
    label: "Dining Room",
    imageUrl: diningRoomImage,
    alt: "Luxury dining room interior with sculptural lighting, walnut finishes and soft beige seating",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    imageUrl: kitchenImage,
    alt: "Premium kitchen with marble island, walnut cabinetry and warm daylight",
  },
  {
    id: "master-bedroom",
    label: "Master Bedroom",
    imageUrl: masterBedroomImage,
    alt: "Luxury master bedroom with upholstered bed, marble wall and floor-to-ceiling tropical view",
  },
  {
    id: "balcony",
    label: "Balcony",
    imageUrl: balconyImage,
    alt: "Luxury balcony lounge with soft sectional seating, marble table and mountain view",
  },
];

const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export const LuxuryScrollHero = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const total = Math.max(el.offsetHeight - viewportHeight, 1);
      const next = clamp(-rect.top / total);
      if (Math.abs(next - progressRef.current) > 0.005) {
        progressRef.current = next;
        setProgress(next);
      }
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const sceneMetrics = useMemo(() => {
    const count = SCENES.length;
    return SCENES.map((scene, index) => {
      const start = index / count;
      const end = (index + 1) / count;
      const local = clamp((progress - start) / (end - start));
      const reveal = reduceMotion ? local : ease(local);
      const fadeIn = clamp(local / 0.32);
      const fadeOut = 1 - clamp((local - 0.72) / 0.28);
      const opacity = clamp(fadeIn * fadeOut);
      const active = progress >= start && progress < end;
      return {
        ...scene,
        index,
        active,
        local,
        reveal,
        opacity: index === 0 && progress < start + 0.02 ? 1 : opacity,
      };
    });
  }, [progress, reduceMotion]);

  const activeIndex = Math.min(Math.floor(progress * SCENES.length), SCENES.length - 1);
  const introFade = clamp(1 - progress * 2.35);

  return (
    <>
      <section
        ref={sectionRef}
        className="relative"
        style={{ height: reduceMotion ? "100vh" : `${SCENES.length * 80}vh` }}
        aria-label="Hitech Furniture and Interiors visual journey"
      >
        <div className="sticky top-0 h-screen overflow-hidden bg-background">
          <div className="absolute inset-0">
            {sceneMetrics.map((scene) => {
              const depthShift = reduceMotion ? 0 : (scene.index - activeIndex) * 24 - scene.reveal * 18;
              const slowZoom = reduceMotion ? 1 : 1.04 + scene.reveal * 0.07;
              const parallaxY = reduceMotion ? 0 : 4 - scene.reveal * 16;

              return (
                <div
                  key={scene.id}
                  className="absolute inset-0"
                  style={{
                    opacity: scene.index === activeIndex ? Math.max(scene.opacity, 0.82) : scene.opacity,
                    transform: `translate3d(0, ${depthShift}px, 0)`,
                    transition: reduceMotion ? "opacity 280ms ease" : undefined,
                    willChange: "opacity, transform",
                  }}
                  aria-hidden={!scene.active}
                >
                  <img
                    src={scene.imageUrl}
                    alt={scene.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading={scene.index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    {...({ fetchpriority: scene.index === 0 ? "high" : "auto" } as Record<string, string>)}
                    style={{
                      transform: `scale(${slowZoom}) translate3d(0, ${parallaxY}px, 0)`,
                      transformOrigin: "center center",
                      willChange: "transform",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/60" />
                </div>
              );
            })}
          </div>

          <div className="absolute inset-0 z-10 flex flex-col justify-between px-5 pb-10 pt-24 sm:px-8 md:px-12 md:pt-28 lg:px-20">
            <div className="max-w-4xl" style={{ opacity: Math.max(introFade, 0.08) }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/90 backdrop-blur-md sm:text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Hitech Furniture & Interiors
              </div>

              <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.02] text-white drop-shadow-lg sm:text-5xl md:text-6xl lg:text-7xl">
                Furniture crafted for the way you live.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/88 sm:text-base md:text-lg">
                Custom furniture, premium collections and complete interior solutions for homes and businesses across Wayanad.
              </p>

              <div className="pointer-events-auto mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/catalog"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-xl transition hover:-translate-y-0.5 hover:bg-white/95"
                >
                  Explore Collection
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => openEnquiryForm()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/20"
                >
                  <ClipboardList className="h-4 w-4" />
                  Get Free Consultation
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between gap-6">
              <div className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 backdrop-blur-md">
                <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/65">Explore</p>
                <p className="mt-1 font-display text-xl text-white md:text-2xl">{SCENES[activeIndex]?.label}</p>
              </div>

              <div className="hidden items-center gap-3 md:flex">
                <div className="flex gap-2">
                  {SCENES.map((scene, index) => (
                    <span
                      key={scene.id}
                      className="h-1.5 rounded-full bg-white/30 transition-all duration-500"
                      style={{ width: index === activeIndex ? 44 : 16 }}
                      aria-hidden
                    >
                      <span
                        className="block h-full rounded-full bg-white"
                        style={{
                          width: index === activeIndex ? `${Math.max(sceneMetrics[index]?.local ?? 0, 0.1) * 100}%` : "0%",
                        }}
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {!reduceMotion && (
            <div
              className="pointer-events-none absolute bottom-9 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-white/80 sm:flex"
              style={{ opacity: introFade }}
            >
              <span className="text-[9px] font-medium uppercase tracking-[0.35em]">Scroll to explore</span>
              <ChevronDown className="h-4 w-4 animate-bounce" aria-hidden />
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-border bg-card" aria-label="Why choose Hitech">
        <div className="container-page grid grid-cols-2 gap-px py-3 sm:grid-cols-4 sm:py-4">
          <TrustItem icon={ShieldCheck} title="14+ Years" subtitle="Trusted craftsmanship" />
          <TrustItem icon={Sparkles} title="Custom Made" subtitle="Built for your space" />
          <TrustItem icon={MapPin} title="Wayanad" subtitle="Local showroom & service" />
          <TrustItem icon={ClipboardList} title="Complete Interiors" subtitle="Design to installation" />
        </div>
      </section>

      <section className="container-page py-14 md:py-20" aria-labelledby="shop-by-room-title">
        <div className="mb-8 flex items-end justify-between gap-5 md:mb-10">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Explore your space</p>
            <h2 id="shop-by-room-title" className="font-display text-3xl text-foreground md:text-4xl">Shop by room</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              Discover furniture and interior inspiration room by room, then browse our live collection for available designs.
            </p>
          </div>
          <Link to="/catalog" className="hidden items-center gap-2 text-sm font-semibold text-primary hover:underline sm:flex">
            View full catalog <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          {SCENES.map((scene) => (
            <Link
              key={scene.id}
              to="/catalog"
              className="group relative min-h-[190px] overflow-hidden rounded-2xl bg-muted sm:min-h-[240px] md:min-h-[300px]"
            >
              <img
                src={scene.imageUrl}
                alt={scene.alt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="font-display text-lg font-semibold md:text-xl">{scene.label}</p>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-white/80">
                  Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section id="interiors" className="container-page pb-14 md:pb-20">
        <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-card-soft lg:grid-cols-[1.05fr_0.95fr]">
          <div className="order-2 flex flex-col justify-center p-7 sm:p-10 lg:order-1 lg:p-14">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Interior solutions</p>
            <h2 className="font-display text-3xl leading-tight text-foreground md:text-4xl">From an empty room to a complete living space.</h2>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
              We handle custom furniture and complete interiors for living rooms, bedrooms, kitchens and more — from planning and material selection to production and installation.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openEnquiryForm()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                Start an Interior Enquiry
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/about"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                About Hitech
              </Link>
            </div>
          </div>

          <div className="order-1 grid min-h-[320px] grid-cols-2 lg:order-2 lg:min-h-[470px]">
            <img src={kitchenImage} alt="Hitech kitchen interior inspiration" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            <div className="grid grid-rows-2">
              <img src={masterBedroomImage} alt="Hitech bedroom interior inspiration" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              <img src={livingRoomImage} alt="Hitech living room interior inspiration" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

type TrustItemProps = {
  icon: typeof ShieldCheck;
  title: string;
  subtitle: string;
};

const TrustItem = ({ icon: Icon, title, subtitle }: TrustItemProps) => (
  <div className="flex items-center gap-3 px-2 py-3 sm:justify-center sm:px-4">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground sm:text-xs">{subtitle}</p>
    </div>
  </div>
);