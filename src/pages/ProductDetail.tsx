import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageCircle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { buildWhatsAppUrl, formatINR } from "@/lib/brand";
// PDF libs (@react-pdf/renderer is ~700KB) are loaded on-demand inside the
// handlers below — keeping them out of the main bundle dramatically improves
// first paint on the catalog/product pages.
import { toast } from "@/hooks/use-toast";
import { DownloadShareMenu } from "@/components/admin/DownloadShareMenu";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { openWhatsAppApp } from "@/lib/whatsapp";
import { Seo } from "@/components/Seo";

type Product = {
  id: string;
  product_name: string;
  product_code: string;
  description: string | null;
  mrp: number;
  offer_price: number | null;
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
  const [generatingJpg, setGeneratingJpg] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const homepage = useHomepageSettings();
  const waNumber = (homepage?.whatsapp_number ?? "").replace(/[^0-9]/g, "");
  // Embla carousel — provides native-feel swipe on mobile, click-drag on desktop.
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveImg(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollTo = useCallback(
    (i: number) => {
      emblaApi?.scrollTo(i);
      setActiveImg(i);
    },
    [emblaApi],
  );

  useEffect(() => {
    if (!id) return;
    supabase
      .from("products")
      .select("id, product_name, product_code, description, mrp, offer_price, available_colors, material, dimensions, stock_quantity, main_category_id, product_images(image_url, display_order), main_categories(name, slug)")
      .eq("id", id)
      .eq("is_published", true)
      .is("deleted_at", null)
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
          <Button asChild className="mt-6"><Link to="/catalog">Back to catalog</Link></Button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const images = [...product.product_images].sort((a, b) => a.display_order - b.display_order);
  const cover = images[activeImg]?.image_url ?? images[0]?.image_url;
  const onOffer = product.offer_price && product.offer_price < product.mrp;
  const inStock = product.stock_quantity > 0;

  // Public product URL — WhatsApp shows a rich link preview with the product image,
  // which is the closest we can get to "auto-sending an image" via wa.me (the WhatsApp
  // platform does NOT allow attaching files via a URL scheme — only the native Share
  // Sheet on the user's device can attach files to a chat).
  const productUrl = `${window.location.origin}/product/${product.id}`;
  const priceLine = onOffer
    ? `Price: ${formatINR(product.offer_price!)} (MRP ${formatINR(product.mrp)})`
    : `MRP: ${formatINR(product.mrp)}`;
  const descLine = product.description ? `\n${product.description}\n` : "";
  const whatsappMsg = `Hello, I'm interested in this product:

Product: ${product.product_name}
Code: ${product.product_code}
${priceLine}
${descLine}
View / brochure: ${productUrl}

Please share more details.`;

  const openWaChat = () => {
    if (waNumber) {
      openWhatsAppApp(waNumber, whatsappMsg);
    } else {
      window.open(buildWhatsAppUrl(whatsappMsg), "_blank", "noopener");
    }
  };

  const buildBrochureJpgBlob = async (): Promise<Blob> => {
    const [{ generateProductPdf }, { pdfBlobToJpgBlob }] = await Promise.all([
      import("@/lib/pdf"),
      import("@/lib/pdfToJpg"),
    ]);
    const pdfBlob = await generateProductPdf({
      product_name: product.product_name,
      product_code: product.product_code,
      description: product.description,
      mrp: Number(product.mrp),
      offer_price: product.offer_price ? Number(product.offer_price) : null,
      available_colors: product.available_colors,
      material: product.material,
      dimensions: product.dimensions,
      cover_image: cover ?? null,
    });
    return await pdfBlobToJpgBlob(pdfBlob);
  };

  const handleDownloadJpg = async () => {
    setGeneratingJpg(true);
    try {
      const blob = await buildBrochureJpgBlob();
      const { downloadBlob } = await import("@/lib/downloadBlob");
      downloadBlob(blob, `${product.product_code}-brochure.jpg`);
      toast({ title: "Brochure downloaded", description: "You can now share it on WhatsApp." });
    } catch (e) {
      toast({ title: "Image generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setGeneratingJpg(false);
    }
  };

  // Generates the *raw* multi-page brochure PDF (no JPG rasterization).
  // Customers usually prefer the crisp PDF; the JPG is offered alongside for
  // workers / casual WhatsApp sharing.
  const handleDownloadPdf = async () => {
    setGeneratingJpg(true);
    try {
      const [{ generateProductPdf }, { downloadBlob }] = await Promise.all([
        import("@/lib/pdf"),
        import("@/lib/downloadBlob"),
      ]);
      const pdfBlob = await generateProductPdf({
        product_name: product.product_name,
        product_code: product.product_code,
        description: product.description,
        mrp: Number(product.mrp),
        offer_price: product.offer_price ? Number(product.offer_price) : null,
        available_colors: product.available_colors,
        material: product.material,
        dimensions: product.dimensions,
        cover_image: cover ?? null,
      });
      downloadBlob(pdfBlob, `${product.product_code}-brochure.pdf`);
      toast({ title: "Brochure PDF downloaded" });
    } catch (e) {
      toast({ title: "PDF generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setGeneratingJpg(false);
    }
  };

  /**
   * One-click inquiry: build the brochure JPG and try to share it via the native
   * Web Share API. On mobile the user picks WhatsApp from the share sheet and the
   * image + message are attached in one tap. On desktop we fall back to a normal
   * download + opening wa.me with the pre-filled message.
   */
  const handleInquireOnWhatsApp = async () => {
    setSendingWa(true);
    try {
      const blob = await buildBrochureJpgBlob();
      const filename = `${product.product_code}-brochure.jpg`;
      const file = new File([blob], filename, { type: "image/jpeg" });

      const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      const canShareFiles =
        typeof navigator.share === "function" &&
        typeof navAny.canShare === "function" &&
        navAny.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: product.product_name,
            text: whatsappMsg,
          });
          toast({
            title: "Ready to send",
            description: "Choose WhatsApp from the share sheet to deliver the brochure.",
          });
          return;
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          console.warn("[WhatsApp inquiry] navigator.share failed, falling back:", err);
        }
      }

      // Desktop fallback: download JPG + open WhatsApp chat
      const { downloadBlob } = await import("@/lib/downloadBlob");
      downloadBlob(blob, filename);
      await new Promise((r) => setTimeout(r, 250));
      openWaChat();

      toast({
        title: "Brochure ready ✓",
        description:
          "Image saved to Downloads. Drag it into the WhatsApp chat that just opened, then press send.",
        duration: 8000,
      });
    } catch (e) {
      console.error("[WhatsApp inquiry] failed:", e);
      toast({
        title: "Couldn't prepare brochure",
        description: "Opening WhatsApp without the image — please try again to attach it.",
        variant: "destructive",
      });
      openWaChat();
    } finally {
      setSendingWa(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${product.product_name} — ${product.main_categories?.name ?? "Furniture"} | Hitech Furniture`}
        description={
          (product.description?.slice(0, 155)) ||
          `${product.product_name} (Code ${product.product_code}) by Hitech Furniture & Interiors, Wayanad. Enquire on WhatsApp for price and delivery.`
        }
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

      <div className="container-page py-6">
        <Link to="/catalog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to catalog
        </Link>
      </div>

      <div className="container-page grid gap-10 pb-20 md:grid-cols-2 md:gap-14">
        {/* Gallery */}
        <div>
          {images.length === 0 ? (
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              No image
            </div>
          ) : (
            <div className="relative">
              {/* Swipeable carousel — touch + mouse drag, lazy-loads non-cover slides. */}
              <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
                <div className="flex">
                  {images.map((img, i) => (
                    <div key={i} className="relative min-w-0 flex-[0_0_100%]">
                      <div className="aspect-square">
                        <img
                          src={img.image_url}
                          alt={`${product.product_name} — view ${i + 1}`}
                          // Cover loads eagerly; extra angles wait until the
                          // user swipes or the browser idles.
                          loading={i === 0 ? "eager" : "lazy"}
                          fetchPriority={i === 0 ? "high" : "low"}
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
                  {/* Desktop arrows — hidden on touch where swipe is natural. */}
                  <button
                    type="button"
                    onClick={() => scrollTo(Math.max(0, activeImg - 1))}
                    disabled={activeImg === 0}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-md transition-smooth hover:bg-background disabled:opacity-30 sm:block"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollTo(Math.min(images.length - 1, activeImg + 1))}
                    disabled={activeImg === images.length - 1}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-md transition-smooth hover:bg-background disabled:opacity-30 sm:block"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  {/* Pagination dots — quick visual feedback during swipes. */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                    {images.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          activeImg === i ? "w-6 bg-primary" : "w-1.5 bg-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-5 gap-3">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  className={`relative aspect-square overflow-hidden rounded-xl bg-transparent transition-smooth ${
                    activeImg === i ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "ring-1 ring-border/40"
                  }`}
                  aria-label={`Show image ${i + 1}`}
                >
                  <img
                    src={img.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain object-center"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="md:pt-4">
          {product.main_categories && (
            <Link
              to={`/catalog?cat=${product.main_categories.slug}`}
              className="text-xs font-semibold uppercase tracking-[0.25em] text-accent hover:underline"
            >
              {product.main_categories.name}
            </Link>
          )}
          <h1 className="mt-3 font-display text-3xl text-foreground md:text-5xl">{product.product_name}</h1>
          <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">Code · {product.product_code}</p>

          <div className="mt-6 flex items-baseline gap-3">
            {onOffer ? (
              <>
                <span className="font-display text-4xl font-semibold text-primary">{formatINR(product.offer_price!)}</span>
                <span className="text-lg text-muted-foreground line-through">{formatINR(product.mrp)}</span>
                <Badge className="bg-accent text-accent-foreground">Offer</Badge>
              </>
            ) : (
              <span className="font-display text-4xl font-semibold text-primary">{formatINR(product.mrp)}</span>
            )}
          </div>

          <div className="mt-3">
            {inStock ? (
              <Badge variant="outline" className="border-primary/40 text-primary">
                In stock · {product.stock_quantity} available
              </Badge>
            ) : (
              <Badge variant="secondary">Out of stock — inquire for ETA</Badge>
            )}
          </div>

          {product.description && (
            <p className="mt-6 leading-relaxed text-foreground/80">{product.description}</p>
          )}

          <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {product.material && (
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Material</dt>
                <dd className="mt-1 font-medium">{product.material}</dd>
              </div>
            )}
            {product.dimensions && (
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Dimensions</dt>
                <dd className="mt-1 font-medium">{product.dimensions}</dd>
              </div>
            )}
          </dl>

          {product.available_colors && product.available_colors.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Available colors</p>
              <div className="flex flex-wrap gap-2">
                {product.available_colors.map((c) => (
                  <span key={c} className="rounded-full border border-border bg-card px-3 py-1 text-sm">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="bg-[#25D366] text-white hover:bg-[#1ea855]"
              onClick={handleInquireOnWhatsApp}
              disabled={sendingWa}
            >
              {sendingWa ? (
                <Loader2 className="mr-1 h-5 w-5 animate-spin" />
              ) : (
                <MessageCircle className="mr-1 h-5 w-5" />
              )}
              Inquire on WhatsApp
            </Button>
            <DownloadShareMenu
              busy={generatingJpg}
              onPdf={handleDownloadPdf}
              onJpg={handleDownloadJpg}
              triggerVariant="outline"
              triggerSize="lg"
              label="Download brochure"
              pdfTooltip="PDF — print-quality brochure"
              jpgTooltip="JPG — image for WhatsApp"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            On mobile, tap "Inquire on WhatsApp" → pick WhatsApp from the share sheet to send the brochure image + message in one step.
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default ProductDetail;
