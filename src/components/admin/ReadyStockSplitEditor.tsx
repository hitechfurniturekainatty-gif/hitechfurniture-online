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
  onRouteChange?: (route: "ready_stock" | "custom", readyQty: number, decision: "ready_stock" | "custom") => void;
}) => {
  const [ready, setReady] = useState(0);
  const [decision, setDecision] = useState<"ready_stock" | "custom" | null>(null);
  const [draft, setDraft] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!itemId || itemId.startsWith("tmp-")) return;
    setLoading(true);
    const db = supabase as any;
    const { data } = await db
      .from("quotation_items")
      .select("ready_stock_qty, stock_decision")
      .eq("id", itemId)
      .maybeSingle();
    const value = Number(data?.ready_stock_qty ?? 0);
    setReady(value);
    setDecision((data?.stock_decision as "ready_stock" | "custom" | null) ?? null);
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

  const persist = async (nextReady: number, nextDecision: "ready_stock" | "custom") => {
    const next = Math.max(0, Math.min(total, nextReady));
    const route: "ready_stock" | "custom" = next >= total ? "ready_stock" : "custom";
    setSaving(true);
    const db = supabase as any;
    const { error } = await db
      .from("quotation_items")
      .update({
        ready_stock_qty: next,
        fulfillment_route: route,
        stock_decision: nextDecision,
      })
      .eq("id", itemId);
    setSaving(false);

    if (error) {
      toast({ title: "Stock status update failed", description: error.message, variant: "destructive" });
      return;
    }

    setReady(next);
    setDecision(nextDecision);
    setDraft(String(next));
    onRouteChange?.(route, next, nextDecision);
    toast({
      title: nextDecision === "ready_stock" ? "Marked Ready Stock" : "Marked Customize",
      description: `Ready ${next} · Customize ${Math.max(0, total - next)}`,
    });
  };

  const save = async () => {
    const next = Math.max(0, Math.min(total, Number(draft) || 0));
    await persist(next, next >= total ? "ready_stock" : "custom");
  };

  return (
    <div className="rounded-lg border-2 border-primary/25 bg-background p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Stock status</p>
          <p className="text-[11px] text-muted-foreground">
            {decision
              ? `Total ${total} · Ready ${ready} · Customize ${pending}`
              : "Save completed. Now choose Ready Stock or Customize."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant={decision === "ready_stock" && ready >= total ? "default" : "outline"}
            className="h-9"
            disabled={saving}
            onClick={() => void persist(total, "ready_stock")}
          >
            ✓ Ready Stock
          </Button>
          <Button
            type="button"
            size="sm"
            variant={decision === "custom" ? "default" : "outline"}
            className="h-9"
            disabled={saving}
            onClick={() => void persist(0, "custom")}
          >
            Customize
          </Button>
        </div>
      </div>

      {total > 1 && decision === "custom" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
          <span className="text-[11px] font-medium">Ready Qty</span>
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
          <span className="text-[11px] text-muted-foreground">Customize {Math.max(0, total - (Number(draft) || 0))}</span>
          <Button type="button" size="sm" className="h-8" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            Save Split
          </Button>
        </div>
      )}
    </div>
  );
};
