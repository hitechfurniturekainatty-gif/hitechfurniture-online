import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Confirmed orders whose custom items have not been given to any worker yet.
// Source: view `production_waiting_items` (confirmed / receivable-pending, not delivered,
// custom route, not cancelled, not part of any job work order).
type WaitingItem = {
  item_id: string;
  quotation_id: string;
  quotation_code: string;
  party_name: string | null;
  party_place: string | null;
  expected_delivery_date: string | null;
  confirmed_at: string | null;
  description: string | null;
  quantity: number | null;
  display_order: number | null;
};

type Group = {
  quotation_id: string;
  quotation_code: string;
  party_name: string | null;
  party_place: string | null;
  expected_delivery_date: string | null;
  confirmed_at: string | null;
  items: WaitingItem[];
};

const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);

export const ProductionWaitingList = () => {
  const [rows, setRows] = useState<WaitingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("production_waiting_items")
        .select("item_id,quotation_id,quotation_code,party_name,party_place,expected_delivery_date,confirmed_at,description,quantity,display_order")
        .order("expected_delivery_date", { ascending: true, nullsFirst: false });
      if (!error) setRows((data ?? []) as WaitingItem[]);
      setLoading(false);
    })();
  }, []);

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    for (const r of rows) {
      const g = m.get(r.quotation_id) ?? {
        quotation_id: r.quotation_id,
        quotation_code: r.quotation_code,
        party_name: r.party_name,
        party_place: r.party_place,
        expected_delivery_date: r.expected_delivery_date,
        confirmed_at: r.confirmed_at,
        items: [],
      };
      g.items.push(r);
      m.set(r.quotation_id, g);
    }
    return [...m.values()].map((g) => ({ ...g, items: g.items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)) }));
  }, [rows]);

  if (loading || groups.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="border-amber-300 bg-amber-50/60 p-3 dark:bg-amber-950/20">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
        <span className="flex-1 font-semibold">
          വർക്കറെ ഏൽപ്പിക്കാൻ ബാക്കി · {groups.length} orders, {rows.length} custom items
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            കൺഫേം ആയ ഓർഡറുകളിലെ കസ്റ്റം ഇനങ്ങൾ — ഇതുവരെ ഒരു worker job-ലും ഇല്ല. ഓർഡർ തുറന്ന് worker, due date നൽകുക.
          </p>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {groups.map((g) => {
              const late = !!g.expected_delivery_date && g.expected_delivery_date < today;
              const waited = daysSince(g.confirmed_at);
              return (
                <div key={g.quotation_id} className="space-y-1.5 rounded-lg border bg-card p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {g.party_name || "—"} · {g.party_place || "—"}
                    </p>
                    <Button asChild size="sm">
                      <Link to={`/admin/quotations/${g.quotation_id}`}>Assign worker</Link>
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <span className="text-muted-foreground">{g.quotation_code}</span>
                    {g.expected_delivery_date ? (
                      <Badge variant={late ? "destructive" : "outline"}>
                        Delivery {new Date(g.expected_delivery_date).toLocaleDateString("en-IN")}
                        {late ? " · overdue" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No delivery date</Badge>
                    )}
                    {waited != null && waited > 0 && <Badge variant="secondary">Confirmed {waited}d ago</Badge>}
                  </div>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {g.items.slice(0, 4).map((i) => (
                      <li key={i.item_id} className="line-clamp-1">
                        {i.description || "Item"} × {i.quantity ?? 1}
                      </li>
                    ))}
                    {g.items.length > 4 && <li>+{g.items.length - 4} more</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
};

export default ProductionWaitingList;
