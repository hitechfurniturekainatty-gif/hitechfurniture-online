import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { formatINR } from "@/lib/brand";

type Row = {
  id: string;
  cost_price: number | null;
  selling_price: number | null;
  mrp: number | null;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
};

export function PriceHistorySection({
  productId,
  showCost,
  reloadKey = 0,
}: {
  productId: string;
  showCost: boolean;
  reloadKey?: number;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("product_price_history")
      .select("id, cost_price, selling_price, mrp, effective_from, effective_to, note")
      .eq("product_id", productId)
      .order("effective_from", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, reloadKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading price history…
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">No price changes recorded yet.</p>;
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left">From</th>
            <th className="px-2 py-1.5 text-left">To</th>
            {showCost && <th className="px-2 py-1.5 text-right">Cost</th>}
            <th className="px-2 py-1.5 text-right">Selling</th>
            <th className="px-2 py-1.5 text-right">MRP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={i === 0 ? "bg-primary/5 font-medium" : ""}>
              <td className="px-2 py-1.5">{fmtDate(r.effective_from)}</td>
              <td className="px-2 py-1.5">{r.effective_to ? fmtDate(r.effective_to) : <span className="text-primary">Current</span>}</td>
              {showCost && <td className="px-2 py-1.5 text-right">{r.cost_price != null ? formatINR(Number(r.cost_price)) : "—"}</td>}
              <td className="px-2 py-1.5 text-right">{r.selling_price != null ? formatINR(Number(r.selling_price)) : "—"}</td>
              <td className="px-2 py-1.5 text-right">{r.mrp != null ? formatINR(Number(r.mrp)) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
