import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowDownToLine, ArrowUpFromLine, History, AlertTriangle } from "lucide-react";

type Product = {
  id: string;
  product_name: string;
  product_code: string;
  stock_quantity: number;
  reorder_level: number;
};

type Movement = {
  id: string;
  change_qty: number;
  reason: string;
  note: string | null;
  resulting_stock: number;
  created_at: string;
};

const REASONS = [
  { value: "purchase", label: "Purchase / stock-in", direction: "in" },
  { value: "production", label: "Production finished", direction: "in" },
  { value: "return", label: "Customer return", direction: "in" },
  { value: "sale", label: "Sale / dispatch", direction: "out" },
  { value: "damage", label: "Damaged / written off", direction: "out" },
  { value: "adjustment", label: "Adjustment (count fix)", direction: "any" },
] as const;

const reasonLabel = (r: string) => REASONS.find((x) => x.value === r)?.label ?? r;

export const StockMovementDialog = ({
  product,
  open,
  onOpenChange,
  onChanged,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) => {
  const [tab, setTab] = useState<"in" | "out" | "history">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<string>("purchase");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Movement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setTab("in");
    setQty("");
    setReason("purchase");
    setNote("");
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  useEffect(() => {
    // Pick a sensible default reason when switching tab
    if (tab === "in") setReason("purchase");
    else if (tab === "out") setReason("sale");
  }, [tab]);

  const loadHistory = async () => {
    if (!product) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("stock_movements")
      .select("id, change_qty, reason, note, resulting_stock, created_at")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as Movement[]);
    setLoadingHistory(false);
  };

  const submit = async () => {
    if (!product) return;
    const n = Math.abs(parseInt(qty, 10));
    if (!n || isNaN(n)) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }
    const change = tab === "out" ? -n : n;
    if (tab === "out" && product.stock_quantity + change < 0) {
      toast({
        title: "Not enough stock",
        description: `Only ${product.stock_quantity} available.`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("stock_movements").insert({
      product_id: product.id,
      change_qty: change,
      reason,
      note: note.trim() || null,
      resulting_stock: 0, // overwritten by trigger
    });
    setSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: tab === "in" ? "Stock added" : "Stock removed" });
    setQty("");
    setNote("");
    void loadHistory();
    onChanged();
  };

  if (!product) return null;

  const lowStock = product.stock_quantity <= product.reorder_level;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-full flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="font-display text-xl">Inventory · {product.product_name}</DialogTitle>
          <p className="text-xs text-muted-foreground">{product.product_code}</p>
        </DialogHeader>

        <div className="border-b bg-muted/30 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Current stock</p>
              <p className={`font-display text-3xl ${lowStock ? "text-destructive" : "text-primary"}`}>
                {product.stock_quantity}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Reorder at</p>
              <p className="text-lg font-semibold">{product.reorder_level}</p>
            </div>
          </div>
          {lowStock && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {product.stock_quantity === 0 ? "Out of stock" : "Stock at or below reorder level"}
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "in" | "out" | "history")} className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 grid grid-cols-3 sm:mx-6">
            <TabsTrigger value="in" className="gap-1.5">
              <ArrowDownToLine className="h-3.5 w-3.5" /> In
            </TabsTrigger>
            <TabsTrigger value="out" className="gap-1.5">
              <ArrowUpFromLine className="h-3.5 w-3.5" /> Out
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="in" className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <MovementForm
              direction="in"
              qty={qty}
              setQty={setQty}
              reason={reason}
              setReason={setReason}
              note={note}
              setNote={setNote}
            />
          </TabsContent>
          <TabsContent value="out" className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <MovementForm
              direction="out"
              qty={qty}
              setQty={setQty}
              reason={reason}
              setReason={setReason}
              note={note}
              setNote={setNote}
            />
          </TabsContent>
          <TabsContent value="history" className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {loadingHistory ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : history.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No stock movements yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((m) => (
                  <li key={m.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {m.change_qty > 0 ? (
                            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">+{m.change_qty}</Badge>
                          ) : (
                            <Badge variant="destructive">{m.change_qty}</Badge>
                          )}
                          <span className="text-sm font-medium">{reasonLabel(m.reason)}</span>
                        </div>
                        {m.note && <p className="mt-1 text-xs text-muted-foreground">{m.note}</p>}
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <p>{new Date(m.created_at).toLocaleDateString()}</p>
                        <p className="mt-0.5">→ {m.resulting_stock} in stock</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {tab !== "history" && (
          <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:px-6 sm:py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Close</Button>
            <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tab === "in" ? "Add stock" : "Remove stock"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

const MovementForm = ({
  direction,
  qty,
  setQty,
  reason,
  setReason,
  note,
  setNote,
}: {
  direction: "in" | "out";
  qty: string;
  setQty: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
}) => {
  const reasons = REASONS.filter((r) => r.direction === direction || r.direction === "any");
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Quantity</Label>
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="e.g. 10"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {reasons.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Note (optional)</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier name, invoice #, batch…" />
      </div>
    </div>
  );
};