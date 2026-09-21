import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const ReadyStockSplitEditor = ({
  itemId,
  quantity,
  onRouteChange,
}: {
  itemId: string;
  quantity: number;
  onRouteChange?: (route: "ready_stock" | "custom") => void;
}) => {
  const [ready, setReady] = useState(0);
  const [draft, setDraft] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!itemId || itemId.startsWith("tmp-")) return;
    setLoading(true);
    const db = supabase as any;
    const { data } = await db
      .from("quotation_items")
      .select("ready_stock_qty")
      .eq("id", itemId)
      .maybeSingle();
    const value = Number(data?.ready_stock_qty ?? 0);
    setReady(value);
    setDraft(String(value));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [itemId, quantity]);

  if (!itemId || itemId.startsWith("tmp-")) return null;
  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  const total = Math.max(0, Number(quantity) || 0);
  const pending = Math.max(0, total - ready);

  const save = async () => {
    const next = Math.max(0, Math.min(total, Number(draft) || 0));
    const route: "ready_stock" | "custom" = next >= total ? "ready_stock" : "custom";
    setSaving(true);
    const db = supabase as any;
    const { error } = await db
      .from("quotation_items")
      .update({ ready_stock_qty: next, fulfillment_route: route })
      .eq("id", itemId);
    setSaving(false);
    if (error) {
      toast({ title: "Stock split update failed", description: error.message, variant: "destructive" });
      return;
    }
    setReady(next);
    setDraft(String(next));
    onRouteChange?.(route);
    toast({
      title: "Item stock split updated",
      description: `Ready ${next} · Custom pending ${Math.max(0, total - next)}`,
    });
  };

  return (
    <div className="rounded-md border border-border/60 bg-background p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Stock split</p>
          <p className="text-[11px] text-muted-foreground">
            Total {total} · Ready {ready} · Custom pending {pending}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={total}
            step="1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-20"
            aria-label="Ready stock quantity"
          />
          <Button type="button" size="sm" className="h-8" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
