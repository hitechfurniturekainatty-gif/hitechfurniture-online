import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import livingRoomAsset from "@/assets/living-room-hero.png.asset.json";
import diningRoomAsset from "@/assets/dining-room-hero.png.asset.json";
import kitchenAsset from "@/assets/kitchen-hero.png.asset.json";
import masterBedroomAsset from "@/assets/master-bedroom-hero.png.asset.json";
import balconyAsset from "@/assets/balcony-hero.png.asset.json";

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
    imageUrl: livingRoomAsset.url,
    alt: "Luxury living room interior with marble, walnut, chandelier and daylight flooding through tall glass windows",
  },
  {
    id: "dining-room",
    label: "Dining Room",
    imageUrl: diningRoomAsset.url,
    alt: "Luxury dining room interior with sculptural lighting, walnut finishes and soft beige seating",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    imageUrl: kitchenAsset.url,
    alt: "Premium kitchen with marble island, walnut cabinetry and warm daylight",
  },
  {
    id: "master-bedroom",
    label: "Master Bedroom",
    imageUrl: masterBedroomAsset.url,
    alt: "Luxury master bedroom with upholstered bed, marble wall and floor-to-ceiling tropical view",
  },
  {
    id: "balcony",
    label: "Balcony",
    imageUrl: balconyAsset.url,
    alt: "Luxury balcony lounge with soft sectional seating, marble table and mountain view",
  },
];

const clamp = (n: number, min = 0, max = 1) => Math.min(Math.max(n, min), max);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export const LuxuryScrollHero = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
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
    const el = sectionRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const total = Math.max(el.offsetHeight - viewportHeight, 1);
      const scrolled = clamp(-rect.top, 0, total);
      setProgress(scrolled / total);
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
  const introFade = clamp(1 - progress * 2.2);

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: reduceMotion ? "100vh" : `${SCENES.length * 100}vh` }}
      aria-label="Luxury interior visual journey"
    >
      <div className="sticky top-0 h-screen overflow-hidden bg-background">
        <div className="absolute inset-0">
          {sceneMetrics.map((scene) => {
            const depthShift = reduceMotion ? 0 : (scene.index - activeIndex) * 24 - scene.reveal * 18;
            const slowZoom = reduceMotion ? 1 : 1.06 + scene.reveal * 0.08;
            const parallaxY = reduceMotion ? 0 : 4 - scene.reveal * 18;

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
                <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 via-transparent to-foreground/55" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--background)/0)_28%,hsl(var(--foreground)/0.22)_100%)]" />
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between px-5 pb-10 pt-28 sm:px-8 md:px-12 lg:px-20">
          <div className="max-w-3xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.35em] text-background/85"
              style={{ opacity: Math.max(introFade, 0.18) }}
            >
              Hitech Furniture & Interiors
            </p>
            <h1
              className="mt-4 max-w-4xl font-display text-4xl leading-[1.02] text-background drop-shadow md:text-6xl lg:text-7xl"
              style={{ opacity: introFade }}
            >
              Hitech Furniture &amp; Interiors
            </h1>
            <p
              className="mt-4 max-w-2xl text-base text-background/90 md:text-lg lg:text-xl"
              style={{ opacity: Math.max(introFade * 0.95, 0.2) }}
            >
              Crafting Luxury Living Spaces
            </p>
          </div>

          <div className="flex items-end justify-between gap-6">
            <div className="max-w-sm rounded-md border border-background/20 bg-background/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-background/70">
                Visual Journey
              </p>
              <p className="mt-2 font-display text-2xl text-background md:text-3xl">
                {SCENES[activeIndex]?.label}
              </p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <div className="flex gap-2">
                {SCENES.map((scene, index) => (
                  <span
                    key={scene.id}
                    className="h-1.5 rounded-full bg-background/35 transition-all duration-500"
                    style={{ width: index === activeIndex ? 44 : 16 }}
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-background"
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
            className="pointer-events-none absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2 text-background/85"
            style={{ opacity: introFade }}
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.35em]">Scroll to explore</span>
            <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden />
          </div>
        )}
      </div>
    </section>
  );
};