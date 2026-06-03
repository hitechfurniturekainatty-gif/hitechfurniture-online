import { Link } from "react-router-dom";
import { memo, useMemo, useState } from "react";
import { formatINR, buildWhatsAppUrl } from "@/lib/brand";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/textCase";
import { MessageCircle, ClipboardList } from "lucide-react";
import { openEnquiryForm } from "@/lib/enquiryForm";

export type ProductVariantData = {
  id: string;
  color_name: string;
  color_hex: string | null;
  image_url: string | null;
  stock_quantity: number;
  display_order: number;
};

export type ProductCardData = {
  id: string;
  product_name: string;
  product_code: string;
  mrp: number;
  offer_price: number | null;
  available_colors: string[] | null;
  stock_quantity: number;
  product_images?: { image_url: string; display_order: number }[];
  product_variants?: ProductVariantData[];
};

const ProductCardInner = ({ product, hidePrice = false, linkPrefix = "product" }: { product: ProductCardData; hidePrice?: boolean; linkPrefix?: "product" | "bundle" }) => {
  const variants = useMemo(
    () =>
      (product.product_variants ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order),
    [product.product_variants],
  );
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const activeVariant = variants.find((v) => v.id === activeVariantId) ?? null;

  const baseCover = useMemo(
    () =>
      product.product_images
        ?.slice()
        .sort((a, b) => a.display_order - b.display_order)[0]?.image_url,
    [product.product_images],
  );
  // Pick the lowest display_order image without mutating the source array
  // and request a small WebP-rendered variant from Supabase Storage so mobile
  // visitors download ~10–20 KB instead of the full original.
  const cover = useMemo(() => {
    const raw = activeVariant?.image_url || baseCover;
    if (!raw) return undefined;
    // Only transform Supabase-hosted images (public bucket urls).
    if (raw.includes("/storage/v1/object/public/")) {
      // Supabase image render endpoint will auto-negotiate webp via Accept header
      return raw.replace("/object/public/", "/render/image/public/")
        + (raw.includes("?") ? "&" : "?")
        + "width=480&quality=72&resize=contain";
    }
    return raw;
  }, [activeVariant, baseCover]);
  const onOffer = product.offer_price && product.offer_price < product.mrp;
  const totalStock = variants.length > 0
    ? variants.reduce((s, v) => s + (v.stock_quantity || 0), 0)
    : product.stock_quantity;

  const inquireOnWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const colorLine = activeVariant
      ? `*Color:* ${activeVariant.color_name}`
      : product.available_colors && product.available_colors.length > 0
        ? `*Colors available:* ${product.available_colors.join(", ")}`
        : "";
    const priceLine = !hidePrice
      ? onOffer
        ? `*Price:* ${formatINR(product.offer_price!)}  ( *MRP:* ${formatINR(product.mrp)} )`
        : `*MRP:* ${formatINR(product.mrp)}`
      : "";
    const productUrl = `${window.location.origin}/${linkPrefix}/${product.id}`;
    const imgUrl = activeVariant?.image_url || baseCover || "";
    const msg = [
      "*New Catalog Inquiry*",
      "Hello, I'm interested in this product:",
      "",
      `*Product:* ${product.product_name}`,
      `*Code:* ${product.product_code}`,
      priceLine,
      colorLine,
      "",
      imgUrl ? `*Photo:* ${imgUrl}` : "",
      `*View Product:* ${productUrl}`,
      "",
      "Please share more details.",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(buildWhatsAppUrl(msg), "_blank", "noopener");
  };

  const openEnquiry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openEnquiryForm({ productName: product.product_name });
  };

  return (
    <Link to={`/${linkPrefix}/${product.id}`} className="product-card group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-transparent">
        {cover ? (
          <img
            src={cover}
            alt={product.product_name}
            loading="lazy"
            decoding="async"
            width={400}
            height={500}
            className="h-full w-full object-contain object-center transition-smooth group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        {onOffer && (
          <Badge className="absolute left-3 top-3 z-10 bg-accent text-accent-foreground">Offer</Badge>
        )}
        {totalStock <= 0 && (
          <Badge variant="secondary" className="absolute right-3 top-3 z-10">Out of stock</Badge>
        )}
        <button
          type="button"
          onClick={inquireOnWhatsApp}
          aria-label="Inquire on WhatsApp"
          title="Inquire on WhatsApp"
          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Inquire
        </button>
        <button
          type="button"
          onClick={openEnquiry}
          aria-label="Send enquiry"
          title="Send enquiry"
          className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:scale-105 hover:shadow-lg"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Enquiry
        </button>
      </div>
      {variants.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
          {variants.map((v) => {
            const active = v.id === (activeVariantId ?? variants[0]?.id);
            const out = v.stock_quantity <= 0;
            return (
              <button
                key={v.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveVariantId(v.id);
                }}
                title={`${v.color_name} · ${out ? "Out" : `${v.stock_quantity} in stock`}`}
                className={cn(
                  "relative h-6 w-6 rounded-full border-2 transition-all",
                  active ? "border-primary scale-110 shadow-md" : "border-border hover:border-foreground/40",
                  out && "opacity-50",
                )}
                style={{ backgroundColor: v.color_hex || "#cbd5e1" }}
                aria-label={`Show ${v.color_name}`}
              >
                {!out && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-foreground px-1 text-[8px] font-bold leading-tight text-background">
                    {v.stock_quantity}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-snug text-foreground line-clamp-2">
            {toTitleCase(product.product_name)}
          </h3>
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Code · {product.product_code}</p>
        {!hidePrice && (
        <div className="flex items-baseline gap-2 pt-1">
          {onOffer ? (
            <>
              <span className="font-display text-xl font-semibold text-primary">
                {formatINR(product.offer_price!)}
              </span>
              <span className="text-sm text-muted-foreground line-through">{formatINR(product.mrp)}</span>
            </>
          ) : (
            <span className="font-display text-xl font-semibold text-primary">{formatINR(product.mrp)}</span>
          )}
        </div>
        )}
        {variants.length === 0 && product.available_colors && product.available_colors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {product.available_colors.slice(0, 4).map((c) => (
              <span key={c} className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {c}
              </span>
            )).reduce<React.ReactNode[]>((acc, el, i, arr) => {
              acc.push(el);
              if (i < arr.length - 1) acc.push(<span key={`d${i}`} className="text-muted-foreground/60">·</span>);
              return acc;
            }, [])}
          </div>
        )}
        {activeVariant && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{activeVariant.color_name}</span>
            {" · "}
            {activeVariant.stock_quantity > 0
              ? `${activeVariant.stock_quantity} in stock`
              : "Out of stock"}
          </p>
        )}
      </div>
    </Link>
  );
};

// Memoized — the catalog re-renders on every search keystroke; without this every
// card re-runs sort + DOM diff for nothing. Big win on mobile with 50+ products.
export const ProductCard = memo(ProductCardInner);
