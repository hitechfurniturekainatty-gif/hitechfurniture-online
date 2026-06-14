import { useEffect, useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import videoAsset from "@/assets/hero-furnishing.mp4.asset.json";

/**
 * Cinematic looping home-furnishing video band. Sits below the scroll-reveal
 * hero on the homepage. Auto-plays muted (mobile-safe), with a soft parallax
 * vignette, eyebrow + headline overlay, and a subtle Ken-Burns zoom for extra
 * life while the clip loops.
 */
export const HeroFurnishingVideo = () => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onReady = () => setReady(true);
    v.addEventListener("canplay", onReady);
    // Some browsers need an explicit play() after metadata loads.
    v.play().catch(() => {});
    return () => v.removeEventListener("canplay", onReady);
  }, []);

  return (
    <section
      aria-label="Step inside our showroom"
      className="relative w-full overflow-hidden bg-black"
    >
      <div className="relative h-[70vh] min-h-[420px] w-full md:h-[85vh]">
        <video
          ref={ref}
          src={(videoAsset as { url: string }).url}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster=""
          className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1400ms] ease-out ${
            ready ? "opacity-100 scale-100" : "opacity-0 scale-105"
          } animate-[heroKenBurns_24s_ease-in-out_infinite_alternate]`}
        />

        {/* Cinematic vignette + gradient */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/40" />

        {/* Loader shimmer until first frame paints */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur-sm">
              <Play className="h-3 w-3" /> Loading showcase
            </div>
          </div>
        )}

        {/* Overlay copy */}
        <div className="container-page relative z-10 flex h-full flex-col items-start justify-end pb-12 md:items-start md:justify-center md:pb-0">
          <div className="max-w-2xl animate-fade-in text-background">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/85 md:text-xs">
              Crafted spaces · Curated furniture
            </p>
            <h2 className="font-display text-3xl leading-[1.05] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)] md:text-5xl lg:text-6xl">
              Where every room
              <br />
              <span className="italic text-white/95">tells a story.</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm text-white/80 md:text-base">
              Sofas, dining, beds, and interiors — designed in-house, made to
              last, delivered to your door.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group">
                <Link to="/catalog">
                  Explore catalog
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              >
                <Link to="/about">Our story</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Animated bottom accent line */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      </div>

      <style>{`
        @keyframes heroKenBurns {
          0%   { transform: scale(1)    translate3d(0,0,0); }
          100% { transform: scale(1.08) translate3d(-1.5%, -1%, 0); }
        }
      `}</style>
    </section>
  );
};

export default HeroFurnishingVideo;