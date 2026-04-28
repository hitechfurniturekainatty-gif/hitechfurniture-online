import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { HeroSlide } from "@/lib/homepage";
import { cn } from "@/lib/utils";

/**
 * Auto-advancing hero slider (5 second interval) with dot indicators.
 * Pauses on hover. Falls back gracefully when only one slide is supplied.
 */
export const HeroSlider = ({ slides }: { slides: HeroSlide[] }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length, paused]);

  if (!slides.length) return null;

  return (
    <section
      className="relative h-full overflow-hidden bg-muted"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured banners"
    >
      <div className="relative aspect-[16/9] w-full md:aspect-auto md:h-full md:min-h-[360px]">
        {slides.map((slide, i) => {
          const isHttp = slide.cta_link?.startsWith("http");
          const cta = slide.cta_label && slide.cta_link ? (
            isHttp ? (
              <Button asChild size="lg">
                <a href={slide.cta_link} target="_blank" rel="noopener">
                  {slide.cta_label}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to={slide.cta_link}>
                  {slide.cta_label}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )
          ) : null;

          return (
            <div
              key={slide.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-out",
                i === index ? "opacity-100" : "opacity-0 pointer-events-none",
              )}
              aria-hidden={i !== index}
            >
              {slide.image_url && (
                <img
                  src={slide.image_url}
                  alt={slide.headline ?? "Banner"}
                  className="absolute inset-0 h-full w-full object-cover md:object-contain"
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={i === 0 ? "high" : "auto"}
                />
              )}
              {(slide.headline || slide.subheadline || cta) && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/30 to-transparent" />
                  <div className="container-page relative z-10 flex h-full items-end pb-10 md:items-center md:pb-0">
                    <div className="max-w-2xl text-background">
                      {slide.headline && (
                        <h2 className="font-display text-3xl leading-tight text-background drop-shadow md:text-5xl lg:text-6xl">
                          {slide.headline}
                        </h2>
                      )}
                      {slide.subheadline && (
                        <p className="mt-3 max-w-xl text-sm text-background/90 md:text-base lg:text-lg">
                          {slide.subheadline}
                        </p>
                      )}
                      {cta && <div className="mt-5">{cta}</div>}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-background" : "w-2 bg-background/60 hover:bg-background/90",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
};