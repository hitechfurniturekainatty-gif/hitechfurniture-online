import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, MapPin } from "lucide-react";
import entranceImage from "@/assets/hero-exterior-door.jpg";
import glassDoorImage from "@/assets/hero-glass-door.jpg";
import livingRoomImage from "@/assets/living-room-hero.png";
import livingDetailImage from "@/assets/hero-interior-sofa.jpg";
import diningRoomImage from "@/assets/dining-room-hero.png";
import masterBedroomImage from "@/assets/master-bedroom-hero.png";
import kitchenImage from "@/assets/kitchen-hero.png";
import interiorRevealImage from "@/assets/hero-interior-room.jpg";
import villaExteriorImage from "@/assets/hero-villa-arch.jpg";
import { openEnquiryForm } from "@/lib/enquiryForm";

type JourneyStop = {
  id: string;
  from: number;
  to: number;
  image: string;
  title: string;
  subtitle?: string;
  alt: string;
  focus?: string;
};

const JOURNEY: JourneyStop[] = [
  {
    id: "entrance",
    from: 0,
    to: 0.055,
    image: entranceImage,
    title: "",
    alt: "Bright luxury villa entrance for Hitech Furniture and Interiors",
    focus: "center center",
  },
  {
    id: "door",
    from: 0.035,
    to: 0.11,
    image: glassDoorImage,
    title: "",
    alt: "Glass entrance opening into the same luxury villa",
    focus: "center center",
  },
  {
    id: "living",
    from: 0.075,
    to: 0.22,
    image: livingRoomImage,
    title: "Luxury Living",
    subtitle: "Designed for the way you live.",
    alt: "Premium luxury living room with sofa, teapoy, curtains and bright natural daylight",
    focus: "center center",
  },
  {
    id: "living-detail",
    from: 0.15,
    to: 0.255,
    image: livingDetailImage,
    title: "Luxury Living",
    subtitle: "Designed for the way you live.",
    alt: "Close architectural view of the same bright villa living room and premium sofa",
    focus: "center center",
  },
  {
    id: "dining",
    from: 0.205,
    to: 0.42,
    image: diningRoomImage,
    title: "Dining in Style",
    alt: "Premium dining area inside the same luxury villa with upholstered dining chairs and daylight",
    focus: "center center",
  },
  {
    id: "bedroom",
    from: 0.385,
    to: 0.62,
    image: masterBedroomImage,
    title: "Your Private Retreat",
    alt: "Luxury master bedroom with deep upholstered headboard, side tables, wardrobe and warm wood details",
    focus: "center center",
  },
  {
    id: "kitchen",
    from: 0.585,
    to: 0.79,
    image: kitchenImage,
    title: "Crafted for Everyday Luxury",
    alt: "Premium modular kitchen inside the same villa with island, cabinetry, integrated appliances and daylight",
    focus: "center center",
  },
  {
    id: "interior-reveal",
    from: 0.745,
    to: 0.925,
    image: interiorRevealImage,
    title: "Furniture + Interiors",
    subtitle: "Complete spaces. One trusted destination.",
    alt: "Wide connected interior reveal showing Hitech furniture and complete interior solutions",
    focus: "center center",
  },
  {
    id: "exterior",
    from: 0.885,
    to: 1,
    image: villaExteriorImage,
    title: "",
    alt: "Modern Kerala-friendly luxury villa exterior in bright daylight",
    focus: "center center",
  },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

function stopOpacity(progress: number, stop: JourneyStop) {
  const span = Math.max(stop.to - stop.from, 0.001);
  const local = clamp((progress - stop.from) / span);
  const fadeIn = smoothstep(local / 0.28);
  const fadeOut = 1 - smoothstep((local - 0.72) / 0.28);
  return clamp(fadeIn * fadeOut);
}

function textOpacity(progress: number, stop: JourneyStop) {
  const span = Math.max(stop.to - stop.from, 0.001);
  const local = clamp((progress - stop.from) / span);
  const fadeIn = smoothstep(local / 0.2);
  const fadeOut = 1 - smoothstep((local - 0.67) / 0.24);
  return clamp(fadeIn * fadeOut);
}

export const LuxuryScrollHero = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const targetProgress = useRef(0);
  const renderedProgress = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const readScroll = () => {
      const rect = root.getBoundingClientRect();
      const travel = Math.max(root.offsetHeight - window.innerHeight, 1);
      targetProgress.current = clamp(-rect.top / travel);
    };

    const animate = () => {
      const target = targetProgress.current;
      const current = renderedProgress.current;
      const next = reduceMotion ? target : current + (target - current) * 0.14;
      renderedProgress.current = Math.abs(target - next) < 0.0005 ? target : next;
      setProgress(renderedProgress.current);
      if (Math.abs(target - renderedProgress.current) > 0.0005) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };

    const onScroll = () => {
      readScroll();
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(animate);
    };

    readScroll();
    renderedProgress.current = targetProgress.current;
    setProgress(targetProgress.current);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion]);

  useEffect(() => {
    const priority = JOURNEY.slice(0, 4);
    priority.forEach((stop) => {
      const img = new Image();
      img.decoding = "async";
      img.src = stop.image;
    });
  }, []);

  const renderedStops = useMemo(
    () =>
      JOURNEY.map((stop, index) => {
        const span = Math.max(stop.to - stop.from, 0.001);
        const local = clamp((progress - stop.from) / span);
        const eased = smoothstep(local);
        const cameraScale = reduceMotion ? 1 : 1.015 + eased * 0.075;
        const cameraY = reduceMotion ? 0 : 10 - eased * 18;
        const cameraX = reduceMotion ? 0 : index % 2 === 0 ? 4 - eased * 8 : -4 + eased * 8;
        return {
          ...stop,
          index,
          local,
          imageOpacity: stopOpacity(progress, stop),
          copyOpacity: stop.title ? textOpacity(progress, stop) : 0,
          cameraScale,
          cameraX,
          cameraY,
        };
      }),
    [progress, reduceMotion],
  );

  const activeIndex = renderedStops.reduce((best, stop, index, array) => {
    return stop.imageOpacity > array[best].imageOpacity ? index : best;
  }, 0);

  const finalReveal = smoothstep((progress - 0.925) / 0.075);
  const initialHint = 1 - smoothstep(progress / 0.08);

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#f5f1ea]"
      style={{ height: reduceMotion ? "100vh" : "650vh" }}
      aria-label="Hitech Furniture and Interiors continuous luxury villa journey"
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-[#eee9df]">
        <div className="absolute inset-0">
          {renderedStops.map((stop, index) => {
            const visible = reduceMotion || Math.abs(index - activeIndex) <= 2 || stop.imageOpacity > 0.02;
            if (!visible) return null;
            return (
              <div
                key={stop.id}
                className="absolute inset-0"
                style={{
                  opacity: index === 0 && progress < 0.03 ? Math.max(stop.imageOpacity, 1) : stop.imageOpacity,
                  willChange: index === activeIndex ? "opacity, transform" : undefined,
                }}
                aria-hidden={index !== activeIndex}
              >
                <img
                  src={stop.image}
                  alt={stop.alt}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading={index <= 2 ? "eager" : "lazy"}
                  decoding="async"
                  {...({ fetchpriority: index === 0 ? "high" : "low" } as Record<string, string>)}
                  style={{
                    objectPosition: stop.focus ?? "center center",
                    transform: `translate3d(${stop.cameraX}px, ${stop.cameraY}px, 0) scale(${stop.cameraScale})`,
                    transformOrigin: "center center",
                    willChange: index === activeIndex ? "transform" : undefined,
                  }}
                />
              </div>
            );
          })}

          <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/24" />
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/32 via-black/8 to-transparent" />
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          {renderedStops.map((stop) =>
            stop.title ? (
              <div
                key={`${stop.id}-copy`}
                className="absolute inset-x-0 bottom-[12vh] px-5 sm:bottom-[13vh] sm:px-8 md:px-12 lg:px-20"
                style={{
                  opacity: stop.copyOpacity * (1 - finalReveal),
                  transform: `translate3d(0, ${(1 - stop.copyOpacity) * 18}px, 0)`,
                  filter: `blur(${(1 - stop.copyOpacity) * 5}px)`,
                }}
              >
                <div className="max-w-2xl rounded-[1.4rem] border border-white/35 bg-white/76 p-5 text-[#34261c] shadow-[0_18px_70px_rgba(52,38,28,0.16)] backdrop-blur-md sm:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8b5c35]">Hitech Furniture & Interiors</p>
                  <h2 className="mt-2 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">{stop.title}</h2>
                  {stop.subtitle ? (
                    <p className="mt-2 text-sm font-medium text-[#5f5146] sm:text-base">{stop.subtitle}</p>
                  ) : null}
                </div>
              </div>
            ) : null,
          )}
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-end px-5 pb-7 sm:px-8 sm:pb-9 md:px-12 lg:px-20"
          style={{ opacity: finalReveal }}
        >
          <div className="pointer-events-auto w-full rounded-[1.75rem] border border-white/60 bg-white/88 p-6 text-[#34261c] shadow-[0_24px_90px_rgba(52,38,28,0.18)] backdrop-blur-xl sm:max-w-3xl sm:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8b5c35]">Kalpetta · Wayanad</p>
            <h1 className="mt-3 font-display text-3xl leading-[1.05] sm:text-5xl md:text-6xl">Hitech Furniture & Interiors</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-[#5f5146] sm:text-base md:text-lg">
              Affordable Luxury Furniture & Interior Solutions
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/catalog"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#4a2810] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#3b200d]"
              >
                Explore Furniture <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => openEnquiryForm()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#4a2810]/20 bg-white px-5 py-3 text-sm font-bold text-[#4a2810] transition hover:-translate-y-0.5 hover:bg-[#faf7f2]"
              >
                Explore Interiors <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/contact"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#4a2810]/20 bg-white/80 px-5 py-3 text-sm font-semibold text-[#4a2810] transition hover:bg-white"
              >
                <MapPin className="h-4 w-4" /> Visit Showroom
              </Link>
            </div>
            <p className="mt-5 text-xs font-medium text-[#7c6a5a]">www.hitechfurniture.online</p>
          </div>
        </div>

        {!reduceMotion && (
          <div
            className="pointer-events-none absolute bottom-7 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5 text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.35)]"
            style={{ opacity: initialHint }}
          >
            <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.32em]">Scroll through the villa</span>
            <ChevronDown className="h-4 w-4" aria-hidden />
          </div>
        )}

        <div className="pointer-events-none absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 md:block">
          <div className="h-36 w-[2px] overflow-hidden rounded-full bg-white/35">
            <div className="w-full rounded-full bg-white" style={{ height: `${Math.max(progress * 100, 2)}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
};
