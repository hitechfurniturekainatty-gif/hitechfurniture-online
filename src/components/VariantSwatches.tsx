import { cn } from "@/lib/utils";

export type Swatch = {
  id: string;
  color_name: string;
  color_hex: string | null;
  image_url: string | null;
  stock_quantity: number;
};

/**
 * Compact color-swatch row used in catalog cards.
 * Clicking a swatch is intercepted (no nav) and notifies the parent so it
 * can switch the cover photo and show per-color stock.
 */
export const VariantSwatches = ({
  variants,
  activeId,
  onPick,
  size = "sm",
}: {
  variants: Swatch[];
  activeId: string | null;
  onPick: (v: Swatch) => void;
  size?: "sm" | "md";
}) => {
  if (variants.length === 0) return null;
  const dim = size === "md" ? "h-7 w-7" : "h-5 w-5";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {variants.map((v) => {
        const active = v.id === activeId;
        const out = v.stock_quantity <= 0;
        return (
          <button
            key={v.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPick(v);
            }}
            title={`${v.color_name} · ${out ? "Out of stock" : `${v.stock_quantity} in stock`}`}
            className={cn(
              "relative shrink-0 rounded-full border-2 transition-all",
              dim,
              active ? "border-primary scale-110 shadow-md" : "border-border hover:border-foreground/40",
              out && "opacity-50",
            )}
            style={{ backgroundColor: v.color_hex || "#cbd5e1" }}
            aria-label={`${v.color_name} variant`}
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
  );
};