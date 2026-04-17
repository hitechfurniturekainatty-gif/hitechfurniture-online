import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, MessageCircle, Loader2 } from "lucide-react";
import { buildWhatsAppUrl, formatINR } from "@/lib/brand";
import { downloadBlob, generateProductPdf } from "@/lib/pdf";
import { toast } from "@/hooks/use-toast";

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
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("products")
      .select("id, product_name, product_code, description, mrp, offer_price, available_colors, material, dimensions, stock_quantity, main_category_id, product_images(image_url, display_order), main_categories(name, slug)")
      .eq("id", id)
      .eq("is_published", true)
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
  const cover = images[activeImg]?.image_url;
  const onOffer = product.offer_price && product.offer_price < product.mrp;
  const inStock = product.stock_quantity > 0;

  const whatsappMsg = `Hello, I'm interested in this product:

Product: ${product.product_name}
Code: ${product.product_code}
MRP: ${formatINR(onOffer ? product.offer_price! : product.mrp)}

Please share more details.`;

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const blob = await generateProductPdf({
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
      downloadBlob(blob, `${product.product_code}-brochure.pdf`);
      toast({ title: "Brochure downloaded", description: "You can now share it on WhatsApp." });
    } catch (e) {
      toast({ title: "PDF failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="container-page py-6">
        <Link to="/catalog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to catalog
        </Link>
      </div>

      <div className="container-page grid gap-10 pb-20 md:grid-cols-2 md:gap-14">
        {/* Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl bg-muted shadow-card-soft">
            {cover ? (
              <img src={cover} alt={product.product_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">No image</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-5 gap-3">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`aspect-square overflow-hidden rounded-xl border-2 transition-smooth ${
                    activeImg === i ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={img.image_url} alt="" className="h-full w-full object-cover" />
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
            <Button asChild size="lg" className="bg-[#25D366] text-white hover:bg-[#1ea855]">
              <a href={buildWhatsAppUrl(whatsappMsg)} target="_blank" rel="noopener">
                <MessageCircle className="mr-1 h-5 w-5" /> Inquire on WhatsApp
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={handleDownloadPdf} disabled={generatingPdf}>
              {generatingPdf ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Download brochure (PDF)
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: download the brochure and attach it in your WhatsApp chat for a quicker reply.
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
};

export default ProductDetail;
