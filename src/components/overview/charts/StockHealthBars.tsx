import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export type LowStockProduct = { id: string; name: string; stock_quantity: number; reorder_level: number };

// Plain-HTML meter bars (not a recharts plot) — each row is a single
// product's stock-vs-reorder-level ratio, sorted worst-first. A bar chart
// library adds nothing here; a proportional fill + two numbers reads faster.
export const StockHealthBars = ({ products }: { products: LowStockProduct[] }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 font-display text-base sm:text-lg">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        Stock Health
      </CardTitle>
      <p className="text-xs text-muted-foreground">Lowest stock vs. each product's own reorder level.</p>
    </CardHeader>
    <CardContent>
      {products.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Nothing below reorder level. 🌿</p>
      ) : (
        <div className="space-y-2.5">
          {products.map((p) => {
            const ratio = p.reorder_level > 0 ? Math.min(1, p.stock_quantity / p.reorder_level) : p.stock_quantity > 0 ? 1 : 0;
            const critical = p.stock_quantity <= 0;
            return (
              <Link key={p.id} to="/admin/products" className="block rounded-lg px-1 py-1 transition-smooth hover:bg-muted/50">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{p.name}</span>
                  <span className={`shrink-0 tabular-nums ${critical ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                    {p.stock_quantity} / {p.reorder_level}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${critical ? "bg-rose-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.max(4, ratio * 100)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);
