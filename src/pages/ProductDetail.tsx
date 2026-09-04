import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, ClipboardList, ShieldCheck, Truck, Sparkles } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { formatINR } from "@/lib/brand";
import { openEnquiryForm } from "@/lib/enquiryForm";
import { toTitleCase } from "@/lib/textCase";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { Seo } from "@/components/Seo";

type Product = {
  id: string;
  product_name: string;
  product_code: string;
  description: string | null;
  mrp: number;
  offer_price: number | null;
  discount_percent: number | null;
  availability_status: string | null;
  primary_image_url: string | null;
  primary_material: string | null;
  color_finish: string | null;
  available_colors: string[] | null;
  material: string | null;
  dimensions: string | null;
  stock_quantity: number;
  main_category_id: string;
  product_images: { image_url: string; display_order: number }[];
  main_categories: { name: string; slug: string } | null;
};

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const homepage = useHomepageSettings();
  const hidePrices = !!homepage?.hide_public_prices;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveImg(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => emblaApi.off("select", onSelect);
  }, [emblaApi]);

  const scrollTo = useCallback((i: number) => {
    emblaApi?.scrollTo(i);
    setActiveImg(i);
  }, [emblaApi]);

  useEffect(() => {
    if (!id) return;
    (supabase as any)
      .from("products_safe_search")
      .select("id, product_name, product_code, description, mrp, offer_price, discount_percent, availability_status, primary_image_url, primary_material, color_finish, available_colors, material, dimensions, stock_quantity, main_category_id, product_images(image_url, display_order), main_categories(name, slug)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setProduct(data as Product | null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container-page py-32 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading product details…</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="container-page py-32 text-center">
          <h1 className="font-display text-3xl">Product not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">This product may have been removed or is no longer public.</p>
          <Button asChild className="mt-6"><Link to="/catalog">Back to catalog</Link></Button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const rawImages = [...product.product_images].sort((a, b) => a.display_order - b.display_order);
  const images = product.primary_image_url && !rawImages.some((i) => i.image_url === product.primary_image_url)
    ? [{ image_url: product.primary_image_url, display_order: -1 }, ...rawImages]
    : rawImages;
  const cover = images[activeImg]?.image_url ?? images[0]?.image_url;
  const onOffer = !!product.offer_price && product.offer_price < product.mrp;
  const inStock = product.stock_quantity > 0;
  const productUrl = `${window.location.origin}/product/${product.id}`;

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${product.product_name} — ${product.main_categories?.name ?? "Furniture"} | Hitech Furniture`}
        description={(product.description?.slice(0, 155)) || `${product.product_name} (Code ${product.product_code}) by Hitech Furniture & Interiors, Wayanad. Enquire for availability and delivery.`}
        image={cover}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.product_name,
          sku: product.product_code,
          description: product.description ?? undefined,
          image: images.map((i) => i.image_url),
          brand: { "@type": "Brand", name: "Hitech Furniture & Interiors" },
          category: product.main_categories?.name,
          material: product.material ?? undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: Number(product.offer_price ?? product.mrp),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: productUrl,
          },
        }}
      />
      <SiteHeader />

      <div className="border-b border-border bg-muted/25">
        <div className="container-page py-4">
          <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back to furniture collection
          </Link>
        </div>
      </div>

      <main className="container-page py-8 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <div>
            {images.length === 0 ? (
              <div className="flex aspect-square items-center justify-center rounded-3xl border border-border bg-muted/30 text-muted-foreground">Image coming soon</div>
            ) : (
              <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                <div className="overflow-hidden" ref={emblaRef}>
                  <div className="flex">
                    {images.map((img, i) => (
                      <div key={i} className="min-w-0 flex-[0_0_100%]">
                        <div className="aspect-square bg-muted/20 p-4 sm:p-7">
                          <img
                            src={img.image_url}
                            alt={`${product.product_name} — view ${i + 1}`}
                            loading={i === 0 ? "eager" : "lazy"}
                            {...({ fetchpriority: i === 0 ? "high" : "low" } as Record<string, string>)}
                            decoding="async"
                            className="h-full w-full object-contain object-center"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {images.length > 1 && (
                  <>
                    <button type="button" onClick={() => scrollTo(Math.max(0, activeImg - 1))} disabled={activeImg === 0} aria-label="Previous image" className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/95 p-2.5 text-slate-900 shadow-lg transition hover:scale-105 disabled:opacity-30 sm:block">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => scrollTo(Math.min(images.length - 1, activeImg + 1))} disabled={activeImg === images.length - 1} aria-label="Next image" className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/95 p-2.5 text-slate-900 shadow-lg transition hover:scale-105 disabled:opacity-30 sm:block">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
                      {images.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${activeImg === i ? "w-7 bg-primary" : "w-1.5 bg-foreground/25"}`} />)}
                    </div>
                  </>
                )}
              </div>
            )}

            {images.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
                {images.slice(0, 10).map((img, i) => (
                  <button key={i} onClick={() => scrollTo(i)} className={`aspect-square overflow-hidden rounded-xl bg-muted/20 p-1 transition ${activeImg === i ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border border-border hover:border-primary/40"}`} aria-label={`Show image ${i + 1}`}>
                    <img src={img.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            {product.main_categories && (
              <Link to={`/catalog?cat=${product.main_categories.slug}`} className="text-xs font-bold uppercase tracking-[0.24em] text-accent hover:underline">
                {toTitleCase(product.main_categories.name)}
              </Link>
            )}

            <h1 className="mt-3 max-w-xl font-display text-3xl leading-tight text-foreground sm:text-4xl md:text-5xl">{toTitleCase(product.product_name)}</h1>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Product code · {product.product_code}</p>

            {!hidePrices && (
              <div className="mt-7 flex flex-wrap items-center gap-3">
                {onOffer ? (
                  <>
                    <span className="font-display text-3xl font-semibold text-primary sm:text-4xl">{formatINR(product.offer_price!)}</span>
                    <span className="text-base text-muted-foreground line-through">{formatINR(product.mrp)}</span>
                    <Badge className="rounded-full bg-accent px-3 py-1 text-accent-foreground">Special price</Badge>
                  </>
                ) : (
                  <span className="font-display text-3xl font-semibold text-primary sm:text-4xl">{formatINR(product.mrp)}</span>
                )}
              </div>
            )}

            <div className="mt-4">
              {inStock ? (
                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-primary">Available now · {product.stock_quantity} in stock</Badge>
              ) : (
                <Badge variant="secondary" className="rounded-full px-3 py-1">Made to order / enquire for availability</Badge>
              )}
            </div>

            {product.description && <p className="mt-7 max-w-xl text-sm leading-7 text-foreground/75 md:text-base">{product.description}</p>}

            <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Product details</p>
              <dl className="mt-4 divide-y divide-border">
                {(product.primary_material || product.material) && <DetailRow label="Material" value={product.primary_material || product.material || ""} />}
                {product.dimensions && <DetailRow label="Dimensions" value={product.dimensions} />}
                {product.color_finish && <DetailRow label="Color / Finish" value={product.color_finish} />}
              </dl>

              {product.available_colors && product.available_colors.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available colors</p>
                  <div className="flex flex-wrap gap-2">
                    {product.available_colors.map((c) => <span key={c} className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium">{c}</span>)}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <TrustPoint icon={ShieldCheck} label="Trusted" text="14+ years" />
              <TrustPoint icon={Sparkles} label="Custom" text="Options available" />
              <TrustPoint icon={Truck} label="Wayanad" text="Local delivery" />
            </div>

            <div className="mt-7 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg sm:p-6">
              <p className="text-sm font-bold">Interested in this product?</p>
              <p className="mt-1 text-xs leading-5 text-primary-foreground/75">Send the product directly with your enquiry and our team can assist with availability, options and delivery.</p>
              <Button size="lg" variant="secondary" className="mt-5 w-full font-bold" onClick={() => openEnquiryForm({ productName: product.product_name, productId: product.id })}>
                <ClipboardList className="mr-2 h-5 w-5" /> Enquire about this product
              </Button>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[110px_1fr] gap-4 py-3 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-semibold text-foreground">{value}</dd>
  </div>
);

const TrustPoint = ({ icon: Icon, label, text }: { icon: typeof ShieldCheck; label: string; text: string }) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <Icon className="h-4 w-4 text-primary" />
    <p className="mt-2 text-xs font-bold text-foreground">{label}</p>
    <p className="mt-0.5 text-[10px] text-muted-foreground">{text}</p>
  </div>
);

export default ProductDetail;
