import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import archDefault from "@/assets/hero-villa-arch.jpg";
import glassDoorDefault from "@/assets/hero-glass-door.jpg";
import interiorDefault from "@/assets/hero-interior-sofa.jpg";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";

/**
 * Premium scroll-linked "Visual Journey" hero.
 *
 * Three stages as the user scrolls:
 *  Stage 1 (0.00 - 0.33): Arch villa exterior — full screen.
 *  Stage 2 (0.33 - 0.66): Camera zooms toward the arch; glass door fades/scales in.
 *  Stage 3 (0.66 - 1.00): Glass double doors swing open naturally, revealing
 *                          the premium green sofa interior behind them.
 */
export const HeroWindowReveal = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const settings = useHomepageSettings();
  const archImg = settings?.hero_arch_image_url || archDefault;
  const glassDoorImg = settings?.hero_glass_door_image_url || glassDoorDefault;
  const interiorImg = settings?.hero_interior_image_url || interiorDefault;
  const showText = settings?.show_hero_text !== false;
  const brandText = settings?.hero_brand_text || "Hitech Furniture & Interiors";
  const headline1 = settings?.hero_headline_line1 || "Luxury Furniture,";
  const headline2 = settings?.hero_headline_line2 || "Redefined.";
  const scrollHint = settings?.hero_scroll_hint || "Scroll to enter";
  const captionEyebrow = settings?.hero_caption_eyebrow || "Step inside";
  const captionTitle = settings?.hero_caption_title || "Welcome to the showroom";

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = el.offsetHeight - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      setProgress(total > 0 ? scrolled / total : 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // --- Stage progress (clamped 0..1 within each segment) ---
  const clamp = (n: number) => Math.min(Math.max(n, 0), 1);
  const ease = (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const s1 = clamp(progress / 0.33);          // arch zoom
  const s2 = clamp((progress - 0.33) / 0.33); // glass door appears
  const s3 = clamp((progress - 0.66) / 0.34); // doors open

  // Stage 1: arch zooms in (as if walking toward it)
  const archScale = 1 + ease(s1) * 0.6;
  const archOpacity = 1 - ease(s2) * 0.9;

  // Stage 2: glass door fades + scales in to fill the frame
  const glassScale = 0.7 + ease(s2) * 0.3;
  const glassOpacity = ease(s2);

  // Stage 3: glass doors swing open naturally
  const e3 = ease(s3);
  const doorTranslate = e3 * 55;   // % outward
  const doorRotate = e3 * 22;      // perspective rotation
  const doorOpacity = 1 - Math.min(e3 * 1.3, 1);

  // Interior reveal behind the glass
  const interiorScale = 1 + e3 * 0.25;
  const interiorOpacity = Math.min(0.15 + e3 * 1.6, 1);

  // Headline visible only during stage 1
  const headlineOpacity = 1 - clamp(progress / 0.25);
  const headlineLift = -progress * 50;

  // "Step inside" caption appears once doors are mostly open
  const captionOpacity = clamp((s3 - 0.55) / 0.45);

  return (
    <section
      ref={sectionRef}
      className="relative w-full"
      style={{ height: "300vh" }}
      aria-label="Luxury villa to showroom visual journey"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black [perspective:1400px]">
        {/* Layer 1: Interior (deepest) */}
        <div
          className="absolute inset-0 will-change-transform overflow-hidden"
          style={{
            transform: `scale(${interiorScale})`,
            transformOrigin: "center center",
            opacity: interiorOpacity,
          }}
        >
          <img
            src={interiorImg}
            alt="Luxury showroom interior with emerald green velvet sofa, brass arc lamp and walnut coffee table"
            className="absolute inset-0 h-full w-full object-cover object-[60%_center] sm:object-center"
            loading="eager"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />
        </div>

        {/* Layer 2: Glass door (split into two halves that swing open) */}
        <div
          className="absolute inset-0"
          style={{
            opacity: glassOpacity,
            transform: `scale(${glassScale})`,
            transformOrigin: "center center",
          }}
        >
          {/* Left door half — shows the LEFT side of the glass-door image */}
          <div
            className="absolute inset-y-0 left-0 w-1/2 will-change-transform"
            style={{
              transform: `translateX(-${doorTranslate}%) rotateY(${doorRotate}deg)`,
              transformOrigin: "left center",
              opacity: doorOpacity,
              backfaceVisibility: "hidden",
              boxShadow: e3 > 0 ? "20px 0 60px rgba(0,0,0,0.5)" : undefined,
              backgroundImage: `url(${glassDoorImg})`,
              backgroundSize: "200vw 100dvh",
              backgroundPosition: "left center",
              backgroundRepeat: "no-repeat",
            }}
          />
          {/* Right door half — shows the RIGHT side of the glass-door image */}
          <div
            className="absolute inset-y-0 right-0 w-1/2 will-change-transform"
            style={{
              transform: `translateX(${doorTranslate}%) rotateY(-${doorRotate}deg)`,
              transformOrigin: "right center",
              opacity: doorOpacity,
              backfaceVisibility: "hidden",
              boxShadow: e3 > 0 ? "-20px 0 60px rgba(0,0,0,0.5)" : undefined,
              backgroundImage: `url(${glassDoorImg})`,
              backgroundSize: "200vw 100dvh",
              backgroundPosition: "right center",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>

        {/* Layer 3: Arch villa exterior (top, fades as we zoom into it) */}
        <div
          className="absolute inset-0 will-change-transform overflow-hidden"
          style={{
            transform: `scale(${archScale})`,
            transformOrigin: "center center",
            opacity: archOpacity,
          }}
        >
          <img
            src={archImg}
            alt="Luxury villa exterior with grand arch entrance at golden hour"
            className="absolute inset-0 h-full w-full object-cover object-[50%_30%] sm:object-center"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40" />
        </div>

        {/* Headline — visible at start */}
        {showText && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
          style={{
            opacity: headlineOpacity,
            transform: `translateY(${headlineLift}px)`,
          }}
        >
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/85 md:text-xs">
            {brandText}
          </p>
          <h1 className="font-display text-4xl leading-[1.05] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] md:text-6xl lg:text-7xl">
            {headline1}
            <br />
            <span className="italic text-white/95">{headline2}</span>
          </h1>
          <div className="mt-12 flex flex-col items-center gap-2 text-white/85">
            <span className="text-[10px] font-medium uppercase tracking-[0.35em]">
              {scrollHint}
            </span>
            <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden />
          </div>
        </div>
        )}

        {/* "Step inside" caption — appears after doors open */}
        {showText && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex flex-col items-center px-6 text-center md:bottom-16"
          style={{ opacity: captionOpacity }}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/90 md:text-xs">
            {captionEyebrow}
          </p>
          <h2 className="font-display text-2xl text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)] md:text-4xl">
            {captionTitle}
          </h2>
        </div>
        )}
      </div>
    </section>
  );
};
