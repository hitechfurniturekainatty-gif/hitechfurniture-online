import { Link } from "react-router-dom";
import { memo, useMemo } from "react";
import { formatINR } from "@/lib/brand";
import { Badge } from "./ui/badge";

export type ProductCardData = {
  id: string;
  product_name: string;
  product_code: string;
  mrp: number;
  offer_price: number | null;
  available_colors: string[] | null;
  stock_quantity: number;
  product_images?: { image_url: string; display_order: number }[];
};

const ProductCardInner = ({ product }: { product: ProductCardData }) => {
  // Pick the lowest display_order image without mutating the source array
  // and request a small WebP-rendered variant from Supabase Storage so mobile
  // visitors download ~10–20 KB instead of the full original.
  const cover = useMemo(() => {
    const raw = product.product_images
      ?.slice()
      .sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
    if (!raw) return undefined;
    // Only transform Supabase-hosted images (public bucket urls).
    if (raw.includes("/storage/v1/object/public/")) {
      return raw.replace("/object/public/", "/render/image/public/")
        + (raw.includes("?") ? "&" : "?")
        + "width=480&quality=72&resize=contain&format=origin";
    }
    return raw;
  }, [product.product_images]);
  const onOffer = product.offer_price && product.offer_price < product.mrp;

  return (
    <Link to={`/product/${product.id}`} className="product-card group block">
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
        {product.stock_quantity <= 0 && (
          <Badge variant="secondary" className="absolute right-3 top-3 z-10">Out of stock</Badge>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg leading-snug text-foreground line-clamp-2">
            {product.product_name}
          </h3>
        </div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Code · {product.product_code}</p>
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
        {product.available_colors && product.available_colors.length > 0 && (
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
      </div>
    </Link>
  );
};

// Memoized — the catalog re-renders on every search keystroke; without this every
// card re-runs sort + DOM diff for nothing. Big win on mobile with 50+ products.
export const ProductCard = memo(ProductCardInner);
