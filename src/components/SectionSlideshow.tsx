import { useEffect, useState } from "react";

/**
 * Auto-advancing 3-second image slideshow used inside admin-managed homepage
 * sections. Pauses on hover; falls back to a static image when only one URL.
 */
export const SectionSlideshow = ({
  images,
  alt,
  intervalMs = 3000,
}: {
  images: string[];
  alt: string;
  intervalMs?: number;
}) => {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (images.length <= 1 || paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % images.length), intervalMs);
    return () => clearInterval(t);
  }, [images.length, paused, intervalMs]);

  if (!images.length) return null;

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-product"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {images.map((src, idx) => (
        <img
          key={src + idx}
          src={src}
          alt={alt}
          loading={idx === 0 ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
            idx === i ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={idx !== i}
        />
      ))}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Show image ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-5 bg-background" : "w-1.5 bg-background/60 hover:bg-background/90"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
