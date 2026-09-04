import { Link } from "react-router-dom";
import { memo, useMemo, useState } from "react";
import { formatINR } from "@/lib/brand";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/textCase";
import { ArrowUpRight, ClipboardList } from "lucide-react";
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
  primary_image_url?: string | null;
  discount_percent?: number | null;
  availability_status?: string | null;
  mrp: number;
  offer_price: number | null;
  available_colors: string[] | null;
  stock_quantity: number;
  product_images?: { image_url: string; display_order: number }[];
  product_variants?: ProductVariantData[];
};

const ProductCardInner = ({ product, hidePrice = false, linkPrefix = "product" }: { product: ProductCardData; hidePrice?: boolean; linkPrefix?: "product" | "bundle" }) => {
  const variants = useMemo(
    () => (product.product_variants ?? []).slice().sort((a, b) => a.display_order - b.display_order),
    [product.product_variants],
  );
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const activeVariant = variants.find((v) => v.id === activeVariantId) ?? null;

  const baseCover = useMemo(
    () =>
      product.product_images?.slice().sort((a, b) => a.display_order - b.display_order)[0]?.image_url
      ?? product.primary_image_url
      ?? undefined,
    [product.product_images, product.primary_image_url],
  );

  const cover = useMemo(() => {
    const raw = activeVariant?.image_url || baseCover;
    if (!raw) return undefined;
    if (raw.includes("/storage/v1/object/public/")) {
      return raw.replace("/object/public/", "/render/image/public/")
        + (raw.includes("?") ? "&" : "?")
        + "width=560&quality=76&resize=contain";
    }
    return raw;
  }, [activeVariant, baseCover]);

  const onOffer = !!product.offer_price && product.offer_price < product.mrp;
  const totalStock = variants.length > 0
    ? variants.reduce((sum, variant) => sum + (variant.stock_quantity || 0), 0)
    : product.stock_quantity;

  const openEnquiry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openEnquiryForm({ productName: product.product_name, productId: product.id });
  };

  return (
    <Link
      to={`/${linkPrefix}/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-product"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted/25">
        {cover ? (
          <img
            src={cover}
            alt={product.product_name}
            loading="lazy"
            decoding="async"
            width={480}
            height={600}
            className="h-full w-full object-contain object-center p-3 transition duration-500 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Image coming soon</div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/10 to-transparent" />

        {onOffer && (
          <Badge className="absolute left-3 top-3 z-10 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
            Special price
          </Badge>
        )}
        {totalStock <= 0 && (
          <Badge variant="secondary" className="absolute right-3 top-3 z-10 rounded-full">Made to order</Badge>
        )}

        <button
          type="button"
          onClick={openEnquiry}
          aria-label={`Enquire about ${product.product_name}`}
          className="absolute bottom-3 right-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg transition hover:scale-105 hover:bg-primary hover:text-primary-foreground"
        >
          <ClipboardList className="h-4 w-4" />
        </button>
      </div>

      {variants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
          {variants.slice(0, 6).map((v) => {
            const active = v.id === (activeVariantId ?? variants[0]?.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveVariantId(v.id);
                }}
                title={v.color_name}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition",
                  active ? "scale-110 border-primary shadow-sm" : "border-background ring-1 ring-border",
                  v.stock_quantity <= 0 && "opacity-45",
                )}
                style={{ backgroundColor: v.color_hex || "#cbd5e1" }}
                aria-label={`Show ${v.color_name}`}
              />
            );
          })}
          {variants.length > 6 && <span className="text-[10px] font-medium text-muted-foreground">+{variants.length - 6}</span>}
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Code {product.product_code}</p>
            <h3 className="line-clamp-2 font-display text-base leading-snug text-foreground sm:text-lg">
              {toTitleCase(product.product_name)}
            </h3>
          </div>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>

        {!hidePrice && (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {onOffer ? (
              <>
                <span className="font-display text-xl font-semibold text-primary">{formatINR(product.offer_price!)}</span>
                <span className="text-xs text-muted-foreground line-through">{formatINR(product.mrp)}</span>
              </>
            ) : (
              <span className="font-display text-xl font-semibold text-primary">{formatINR(product.mrp)}</span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
          <span className={cn("text-[11px] font-medium", totalStock > 0 ? "text-primary" : "text-muted-foreground")}> 
            {totalStock > 0 ? "Available now" : "Enquire for availability"}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground transition group-hover:text-primary">View details</span>
        </div>
      </div>
    </Link>
  );
};

export const ProductCard = memo(ProductCardInner);
