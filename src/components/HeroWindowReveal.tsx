import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import exteriorImg from "@/assets/hero-exterior-door.jpg";
import interiorImg from "@/assets/hero-interior-room.jpg";

/**
 * Premium scroll-linked "Window Reveal" hero.
 *
 * The section is taller than the viewport (200vh). As the user scrolls
 * through it, the black-framed glass doors swing open (left + right halves
 * translate outward and rotate slightly) while the interior image zooms
 * in behind them — creating the illusion of walking from the villa's
 * exterior into a luxury showroom. Scrolling back up reverses the motion.
 *
 * The exterior image is split into two halves clipped down the middle so
 * each half can animate independently like a real double door.
 */
export const HeroWindowReveal = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0); // 0 = closed, 1 = fully open

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // total scrollable distance inside the pinned hero
      const total = el.offsetHeight - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const p = total > 0 ? scrolled / total : 0;
      setProgress(p);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
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

  // Eased progress for buttery-smooth motion
  const eased = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  // Door halves slide outward and rotate slightly (like real doors swinging open)
  const doorTranslate = eased * 60; // % of half-width
  const doorRotate = eased * 18; // degrees
  const doorOpacity = 1 - Math.min(eased * 1.4, 1);

  // Interior zooms in as we walk through
  const interiorScale = 1 + eased * 0.35;
  const interiorOpacity = Math.min(0.2 + eased * 1.6, 1);

  // Headline fades + lifts as user begins scrolling
  const headlineOpacity = 1 - Math.min(progress * 2.5, 1);
  const headlineLift = -progress * 40;

  // Interior caption fades in once doors are mostly open
  const interiorCaptionOpacity = Math.max((eased - 0.55) / 0.45, 0);

  return (
    <section
      ref={sectionRef}
      className="relative w-full"
      style={{ height: "200vh" }}
      aria-label="Luxury furniture showroom reveal"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        {/* Interior layer — visible as the doors open */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `scale(${interiorScale})`,
            opacity: interiorOpacity,
            transition: "opacity 120ms linear",
          }}
        >
          <img
            src={interiorImg}
            alt="Luxury showroom interior with emerald green velvet sofas and a wooden coffee table"
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
          {/* Soft vignette for cinematic depth */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.45)_100%)]" />
        </div>

        {/* Door — left half */}
        <div
          className="absolute inset-y-0 left-0 w-1/2 will-change-transform"
          style={{
            transform: `translateX(-${doorTranslate}%) rotateY(${doorRotate}deg)`,
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
            opacity: doorOpacity,
            backfaceVisibility: "hidden",
          }}
        >
          <div
            className="h-full w-full bg-cover bg-no-repeat shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            style={{
              backgroundImage: `url(${exteriorImg})`,
              backgroundPosition: "left center",
              backgroundSize: "200% 100%",
            }}
          />
        </div>

        {/* Door — right half */}
        <div
          className="absolute inset-y-0 right-0 w-1/2 will-change-transform"
          style={{
            transform: `translateX(${doorTranslate}%) rotateY(-${doorRotate}deg)`,
            transformOrigin: "right center",
            transformStyle: "preserve-3d",
            opacity: doorOpacity,
            backfaceVisibility: "hidden",
          }}
        >
          <div
            className="h-full w-full bg-cover bg-no-repeat shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            style={{
              backgroundImage: `url(${exteriorImg})`,
              backgroundPosition: "right center",
              backgroundSize: "200% 100%",
            }}
          />
        </div>

        {/* Headline (visible while doors are still closed) */}
        <div
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center"
          style={{
            opacity: headlineOpacity,
            transform: `translateY(${headlineLift}px)`,
          }}
        >
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/80 md:text-xs">
            Hitech Furniture &amp; Interiors
          </p>
          <h1 className="font-display text-4xl leading-[1.05] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] md:text-6xl lg:text-7xl">
            Luxury Furniture,
            <br />
            <span className="italic text-white/95">Redefined.</span>
          </h1>

          {/* Scroll cue */}
          <div className="mt-12 flex flex-col items-center gap-2 text-white/85">
            <span className="text-[10px] font-medium uppercase tracking-[0.35em]">
              Scroll to enter
            </span>
            <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden />
          </div>
        </div>

        {/* Interior caption (revealed once you've "walked in") */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex flex-col items-center px-6 text-center md:bottom-16"
          style={{ opacity: interiorCaptionOpacity }}
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/85 md:text-xs">
            Step inside
          </p>
          <h2 className="font-display text-2xl text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)] md:text-4xl">
            Welcome to the showroom
          </h2>
        </div>
      </div>
    </section>
  );
};
