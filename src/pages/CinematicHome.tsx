import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, MessageCircle, Quote, Sparkles, ChevronDown } from "lucide-react";
import { useLenis } from "@/hooks/useLenis";
import { Seo } from "@/components/Seo";

import heroExterior from "@/assets/cinematic/hero-exterior.jpg";
import interiorLiving from "@/assets/cinematic/interior-living.jpg";
import collSofa from "@/assets/cinematic/coll-sofa.jpg";
import collBedroom from "@/assets/cinematic/coll-bedroom.jpg";
import collDining from "@/assets/cinematic/coll-dining.jpg";
import collOffice from "@/assets/cinematic/coll-office.jpg";
import collKitchen from "@/assets/cinematic/coll-kitchen.jpg";
import walkthroughImg from "@/assets/cinematic/walkthrough.jpg";
import beforeImg from "@/assets/cinematic/before.jpg";
import afterImg from "@/assets/cinematic/after.jpg";
import bgDark from "@/assets/cinematic/bg-dark.jpg";

gsap.registerPlugin(ScrollTrigger);

const SiteFooter = lazy(() => import("@/components/SiteFooter").then((m) => ({ default: m.SiteFooter })));

/* =========================================================
   1 — CINEMATIC HERO (door-open scroll-pinned)
   ========================================================= */
const HeroDoorReveal = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const leftDoorRef = useRef<HTMLDivElement>(null);
  const rightDoorRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=180%",
          scrub: 1.2,
          pin: true,
          anticipatePin: 1,
        },
      });
      tl.to(leftDoorRef.current, { xPercent: -105, ease: "power2.inOut" }, 0);
      tl.to(rightDoorRef.current, { xPercent: 105, ease: "power2.inOut" }, 0);
      tl.to(interiorRef.current, { scale: 1.18, opacity: 1, ease: "power1.out" }, 0);
      tl.to(captionRef.current, { opacity: 0, y: -40, ease: "power2.in" }, 0.05);
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative h-screen w-full overflow-hidden bg-black">
      {/* Interior layer (revealed) */}
      <div ref={interiorRef} className="absolute inset-0 origin-center scale-[1.05] opacity-90">
        <img
          src={interiorLiving}
          alt="Hitech luxury showroom interior"
          className="h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
      </div>

      {/* Door layers — split exterior image into two halves */}
      <div
        ref={leftDoorRef}
        className="absolute left-0 top-0 z-10 h-full w-1/2 will-change-transform"
        style={{
          backgroundImage: `url(${heroExterior})`,
          backgroundSize: "200% 100%",
          backgroundPosition: "left center",
          boxShadow: "30px 0 80px -20px rgba(0,0,0,0.85)",
        }}
      >
        <div className="absolute inset-y-0 right-0 w-px bg-[hsl(var(--c-gold)/0.3)]" />
      </div>
      <div
        ref={rightDoorRef}
        className="absolute right-0 top-0 z-10 h-full w-1/2 will-change-transform"
        style={{
          backgroundImage: `url(${heroExterior})`,
          backgroundSize: "200% 100%",
          backgroundPosition: "right center",
          boxShadow: "-30px 0 80px -20px rgba(0,0,0,0.85)",
        }}
      >
        <div className="absolute inset-y-0 left-0 w-px bg-[hsl(var(--c-gold)/0.3)]" />
      </div>

      {/* Cinematic vignette + fog */}
      <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.7)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/3 bg-gradient-to-t from-black to-transparent" />

      {/* Caption */}
      <div
        ref={captionRef}
        className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-center"
      >
        <p className="c-eyebrow mb-5 text-[hsl(var(--c-gold))]">
          Hitech Furniture &amp; Interiors
        </p>
        <h1 className="c-display max-w-4xl text-balance text-5xl text-[hsl(var(--c-fg))] sm:text-7xl md:text-[88px]">
          Step inside <span className="italic text-[hsl(var(--c-gold))]">luxury.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base text-[hsl(var(--c-muted))] sm:text-lg">
          A cinematic showroom for considered living — crafted in Wayanad, India.
        </p>
        <div className="mt-10 flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-[hsl(var(--c-muted))]">
          Scroll to enter <ChevronDown className="h-4 w-4 animate-bounce" />
        </div>
      </div>
    </section>
  );
};

/* =========================================================
   2 — INTERIOR REVEAL (parallax + fade-up)
   ========================================================= */
const InteriorReveal = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1.0, 1.05]);

  return (
    <section ref={ref} className="relative h-[120vh] w-full overflow-hidden bg-black">
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <img src={interiorLiving} alt="Emerald luxury living room" className="h-full w-full object-cover" loading="lazy" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />

      <div className="container-page sticky top-0 flex h-screen flex-col items-start justify-end pb-24">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30%" }}
          className="c-eyebrow mb-4"
        >
          The Showroom Within
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, margin: "-30%" }}
          className="c-display max-w-3xl text-4xl text-[hsl(var(--c-fg))] sm:text-6xl md:text-7xl"
        >
          Emerald velvet. <span className="italic text-[hsl(var(--c-gold))]">Walnut warmth.</span> Marble silence.
        </motion.h2>
      </div>
    </section>
  );
};

/* =========================================================
   3 — FEATURED COLLECTIONS (horizontal cinematic scroll)
   ========================================================= */
const collections = [
  { title: "Sofas", caption: "Sculpted comfort", img: collSofa, slug: "sofas" },
  { title: "Bedrooms", caption: "Sanctuary by design", img: collBedroom, slug: "beds" },
  { title: "Dining", caption: "Theatre of the table", img: collDining, slug: "dining" },
  { title: "Office", caption: "Quiet authority", img: collOffice, slug: "office" },
  { title: "Kitchen", caption: "Modular gravity", img: collKitchen, slug: "kitchen" },
];

const Collections = () => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section ref={ref} className="relative bg-black py-32">
      <div className="container-page mb-16">
        <p className="c-eyebrow mb-4">Curated Collections</p>
        <h2 className="c-display max-w-3xl text-4xl text-[hsl(var(--c-fg))] sm:text-6xl">
          Five rooms. <span className="italic text-[hsl(var(--c-gold))]">One language.</span>
        </h2>
      </div>

      <div className="container-page grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((c, i) => (
          <motion.div
            key={c.slug}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className={`group relative overflow-hidden rounded-3xl ${i === 0 ? "lg:col-span-2 lg:row-span-2" : ""}`}
          >
            <Link to={`/catalog?cat=${c.slug}`} className="block">
              <div className={`relative ${i === 0 ? "aspect-[4/5] lg:aspect-auto lg:h-[820px]" : "aspect-[4/5]"} overflow-hidden`}>
                <img
                  src={c.img}
                  alt={c.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-90 transition-opacity duration-700 group-hover:opacity-100" />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/5" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-7 md:p-9">
                <p className="c-eyebrow mb-2 text-[hsl(var(--c-gold))]">{c.caption}</p>
                <div className="flex items-end justify-between">
                  <h3 className="c-display text-3xl text-white md:text-5xl">{c.title}</h3>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/5 backdrop-blur transition-transform group-hover:translate-x-1 group-hover:border-[hsl(var(--c-gold))]">
                    <ArrowRight className="h-5 w-5 text-white" />
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

/* =========================================================
   4 — WALKTHROUGH (scroll-pinned camera dolly)
   ========================================================= */
const Walkthrough = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.0, 1.35]);
  const blur = useTransform(scrollYProgress, [0, 0.5, 1], [4, 0, 4]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  return (
    <section ref={ref} className="relative h-[180vh] bg-black">
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.img
          src={walkthroughImg}
          alt="Luxury villa walkthrough"
          style={{ scale, filter }}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

        <div className="container-page absolute inset-0 flex items-center">
          <div className="max-w-2xl">
            <p className="c-eyebrow mb-4">Walkthrough</p>
            <h2 className="c-display text-4xl text-white sm:text-6xl md:text-7xl">
              Every room, <br />
              <span className="italic text-[hsl(var(--c-gold))]">a story.</span>
            </h2>
            <p className="mt-6 max-w-md text-lg text-[hsl(var(--c-muted))]">
              Living rooms that breathe. Bedrooms that hush. Kitchens that compose. We design interiors that move with you.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

/* =========================================================
   5 — BEFORE / AFTER (drag slider)
   ========================================================= */
const BeforeAfter = () => {
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const p = ((clientX - rect.left) / rect.width) * 100;
      setPos(Math.max(0, Math.min(100, p)));
    };
    const onUp = () => (dragging.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <section className="relative bg-black py-32">
      <div className="container-page mb-12 max-w-3xl">
        <p className="c-eyebrow mb-4">Transformation</p>
        <h2 className="c-display text-4xl text-white sm:text-6xl">
          From empty rooms <br />
          <span className="italic text-[hsl(var(--c-gold))]">to lived dreams.</span>
        </h2>
      </div>

      <div className="container-page">
        <div
          ref={wrapRef}
          className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl ring-1 ring-white/10 select-none"
        >
          <img src={afterImg} alt="After" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <div
            className="absolute inset-y-0 left-0 overflow-hidden"
            style={{ width: `${pos}%` }}
          >
            <img
              src={beforeImg}
              alt="Before"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ width: `${(100 / pos) * 100}%`, maxWidth: "none" }}
              loading="lazy"
            />
          </div>

          {/* Handle */}
          <div
            className="absolute inset-y-0 z-10 w-px bg-[hsl(var(--c-gold))]"
            style={{ left: `${pos}%` }}
          >
            <button
              type="button"
              onMouseDown={() => (dragging.current = true)}
              onTouchStart={() => (dragging.current = true)}
              className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-[hsl(var(--c-gold))] bg-black/70 backdrop-blur"
              aria-label="Drag to compare"
            >
              <ArrowRight className="h-4 w-4 -translate-x-1 text-[hsl(var(--c-gold))]" />
              <ArrowRight className="h-4 w-4 translate-x-1 rotate-180 text-[hsl(var(--c-gold))]" />
            </button>
          </div>

          {/* Labels */}
          <span className="absolute left-5 top-5 rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur">Before</span>
          <span className="absolute right-5 top-5 rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-[hsl(var(--c-gold))] backdrop-blur">After</span>
        </div>
      </div>
    </section>
  );
};

/* =========================================================
   6 — WHY HITECH (glass stat cards)
   ========================================================= */
const stats = [
  { n: "14+", label: "Years of craftsmanship" },
  { n: "5,000+", label: "Bespoke pieces delivered" },
  { n: "100%", label: "Made-to-order" },
  { n: "1:1", label: "Designer consultations" },
];

const WhyHitech = () => (
  <section className="relative overflow-hidden bg-black py-32">
    <div className="absolute inset-0 opacity-50">
      <img src={bgDark} alt="" className="h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-black/60" />
    </div>

    <div className="container-page relative">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <p className="c-eyebrow mb-4">Why Hitech</p>
        <h2 className="c-display text-4xl text-white sm:text-6xl">
          Built on <span className="italic text-[hsl(var(--c-gold))]">obsession.</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.1 }}
            className="c-glass relative overflow-hidden p-6 md:p-8"
          >
            <p className="c-display bg-gradient-to-br from-white to-[hsl(var(--c-gold))] bg-clip-text text-4xl text-transparent md:text-6xl">
              {s.n}
            </p>
            <p className="mt-3 text-sm text-[hsl(var(--c-muted))]">{s.label}</p>
            <Sparkles className="absolute right-4 top-4 h-4 w-4 text-[hsl(var(--c-gold)/0.4)]" />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* =========================================================
   7 — TESTIMONIALS (floating glass)
   ========================================================= */
const testimonials = [
  { name: "Anita Menon", place: "Kalpetta", quote: "Walking in felt like a film set. Every joint, every finish — uncompromising." },
  { name: "Rohit Kapoor", place: "Mananthavady", quote: "They built our entire villa interior. Six months later, it still feels brand new." },
  { name: "Priya Thomas", place: "Sulthan Bathery", quote: "The custom emerald sectional is the heart of our home. Worth every rupee." },
];

const Testimonials = () => (
  <section className="relative bg-black py-32">
    <div className="container-page">
      <div className="mb-16 max-w-2xl">
        <p className="c-eyebrow mb-4">Voices</p>
        <h2 className="c-display text-4xl text-white sm:text-6xl">
          Loved by <span className="italic text-[hsl(var(--c-gold))]">people of taste.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: i * 0.1 }}
            className="c-glass relative p-8"
          >
            <Quote className="mb-4 h-6 w-6 text-[hsl(var(--c-gold))]" />
            <blockquote className="text-base leading-relaxed text-[hsl(var(--c-fg))] md:text-lg">
              "{t.quote}"
            </blockquote>
            <figcaption className="mt-6 border-t border-white/10 pt-4 text-sm text-[hsl(var(--c-muted))]">
              <span className="text-[hsl(var(--c-fg))]">{t.name}</span> · {t.place}
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </div>
  </section>
);

/* =========================================================
   8 — REEL GALLERY (horizontal scroll)
   ========================================================= */
const reels = [collSofa, collBedroom, collDining, collOffice, collKitchen, interiorLiving];

const ReelGallery = () => (
  <section className="bg-black py-32">
    <div className="container-page mb-12">
      <p className="c-eyebrow mb-4">@hitech.furniture</p>
      <h2 className="c-display text-4xl text-white sm:text-6xl">
        On the <span className="italic text-[hsl(var(--c-gold))]">feed.</span>
      </h2>
    </div>

    <div className="overflow-x-auto pb-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-5 px-6 md:px-12">
        {reels.map((src, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -8 }}
            className="relative h-[460px] w-[280px] flex-shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10"
          >
            <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-700 hover:scale-110" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* =========================================================
   9 — FOOTER CTA
   ========================================================= */
const FooterCta = () => (
  <section className="relative overflow-hidden bg-black py-32">
    <div className="absolute inset-0 opacity-40">
      <img src={bgDark} alt="" className="h-full w-full object-cover" loading="lazy" />
    </div>
    <div className="container-page relative">
      <div className="mx-auto max-w-3xl text-center">
        <p className="c-eyebrow mb-6">Begin</p>
        <h2 className="c-display text-5xl text-white sm:text-7xl md:text-8xl">
          Design your <br />
          <span className="italic text-[hsl(var(--c-gold))]">forever space.</span>
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-lg text-[hsl(var(--c-muted))]">
          Book a free consultation with our design team. We'll bring the cinematic showroom to your home.
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <a href="https://wa.me/919526610404" target="_blank" rel="noopener" className="c-btn-gold">
            <MessageCircle className="h-4 w-4" /> WhatsApp consultation
          </a>
          <Link to="/catalog" className="c-btn-ghost">
            Browse the catalog <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  </section>
);

/* =========================================================
   Floating top nav (cinematic)
   ========================================================= */
const FloatingNav = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${scrolled ? "py-3" : "py-6"}`}
    >
      <div className="container-page flex items-center justify-between">
        <Link to="/" className="c-display text-lg tracking-tight text-white">
          HITECH<span className="text-[hsl(var(--c-gold))]">.</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[hsl(var(--c-muted))] md:flex">
          <Link to="/catalog" className="transition hover:text-white">Catalog</Link>
          <Link to="/about" className="transition hover:text-white">Story</Link>
          <a href="https://wa.me/919526610404" target="_blank" rel="noopener" className="transition hover:text-white">Contact</a>
        </nav>
        <Link to="/catalog" className="c-btn-ghost !px-5 !py-2 text-xs">Explore</Link>
      </div>
    </header>
  );
};

/* =========================================================
   ROOT
   ========================================================= */
const CinematicHome = () => {
  useLenis();

  return (
    <div className="cinema-scope min-h-screen">
      <Seo
        title="Hitech Furniture & Interiors — Cinematic Luxury Showroom"
        description="Step inside a cinematic luxury furniture showroom. Custom sofas, bedrooms, dining, office and modular kitchen interiors crafted in Wayanad."
      />
      <FloatingNav />
      <HeroDoorReveal />
      <InteriorReveal />
      <Collections />
      <Walkthrough />
      <BeforeAfter />
      <WhyHitech />
      <Testimonials />
      <ReelGallery />
      <FooterCta />

      {/* Floating WhatsApp */}
      <a
        href="https://wa.me/919526610404"
        target="_blank"
        rel="noopener"
        aria-label="WhatsApp consultation"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--c-emerald))] text-white shadow-[0_10px_40px_-10px_hsl(var(--c-emerald-glow)/0.7)] transition hover:scale-110"
      >
        <MessageCircle className="h-6 w-6" />
      </a>

      <Suspense fallback={null}>
        <div className="bg-black [&_*]:!text-white/70">
          <SiteFooter />
        </div>
      </Suspense>
    </div>
  );
};

export default CinematicHome;