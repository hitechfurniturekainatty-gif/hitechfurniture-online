import { Link } from "react-router-dom";
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

export const ProductCard = ({ product }: { product: ProductCardData }) => {
  const cover = product.product_images?.sort((a, b) => a.display_order - b.display_order)[0]?.image_url;
  const onOffer = product.offer_price && product.offer_price < product.mrp;

  return (
    <Link to={`/product/${product.id}`} className="product-card group block">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={product.product_name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain p-3 transition-smooth group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        {onOffer && (
          <Badge className="absolute left-3 top-3 bg-accent text-accent-foreground">Offer</Badge>
        )}
        {product.stock_quantity <= 0 && (
          <Badge variant="secondary" className="absolute right-3 top-3">Out of stock</Badge>
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
