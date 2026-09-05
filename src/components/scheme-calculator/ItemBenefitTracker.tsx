import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Gift, Plus, Trash2 } from "lucide-react";
import { aggregateRowsByItem, computeFreeReport, fmt } from "./utils";
import type { BenefitReceipt, Row, VendorMonth } from "./types";

const norm = (v: string | undefined) => String(v || "").trim().toLowerCase();

export function ItemBenefitTracker({ vm, onChange }: {
  vm: VendorMonth;
  onChange: (receipts: BenefitReceipt[]) => void;
}) {
  const receipts = vm.benefit_receipts || [];
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});
  const rows: Row[] = vm.invoices?.length ? vm.invoices.flatMap((i) => i.rows) : vm.purchase_rows;

  const items = useMemo(() => {
    const report: any = computeFreeReport({ kind: vm.scheme_kind, config: vm.scheme_config }, aggregateRowsByItem(rows));
    return (report.rep || [])
      .filter((r: any) => r.purchaseItem && r.freeItem)
      .map((r: any) => {
        const freeItem = String(r.freeItem || r.purchaseItem);
        const received = receipts.filter((x) => x.kind === "free_item" && norm(x.item) === norm(freeItem)).reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
        const eligible = Number(r.free) || 0;
        const purchased = Number(r.qty) || 0;
        const buyQty = Math.max(1, Number(r.buyQty) || 1);
        const completedSets = Math.floor(purchased / buyQty);
        const nextTarget = (completedSets + 1) * buyQty;
        return { purchaseItem: String(r.purchaseItem), freeItem, purchased, buyQty, eligible, received, pending: Math.max(0, eligible - received), needMore: Math.max(0, nextTarget - purchased), matchMode: r.matchMode || "family" };
      });
  }, [vm.invoices, vm.purchase_rows, vm.scheme_kind, vm.scheme_config, vm.benefit_receipts]);

  const addReceived = (freeItem: string, pending: number) => {
    const key = norm(freeItem);
    const entered = Math.max(0, Number(qtyByItem[key]) || 0);
    if (!entered || pending <= 0) return;
    const qty = Math.min(entered, pending);
    const next: BenefitReceipt = { id: crypto.randomUUID(), kind: "free_item", item: freeItem, qty, date: new Date().toISOString().slice(0, 10) };
    onChange([...receipts, next]);
    setQtyByItem((s) => ({ ...s, [key]: "" }));
  };

  const removeReceipt = (id: string) => onChange(receipts.filter((r) => r.id !== id));

  if (!items.length) return (
    <div className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">
      Add at least one Scheme Item with Purchase Item, Buy Qty, Free Qty and Free Item. Invoice items will then match automatically.
    </div>
  );

  return (
    <section className="rounded-xl border bg-background/50 p-4 space-y-3">
      <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /><div><h4 className="text-sm font-semibold">Item-wise Scheme Achievement</h4><p className="text-xs text-muted-foreground">All invoice items are kept. Only configured scheme items are matched and counted.</p></div></div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/40 text-xs"><tr><th className="p-2 text-left">Purchase Item</th><th className="p-2 text-left">Match</th><th className="p-2 text-right">Purchased</th><th className="p-2 text-right">Buy Target</th><th className="p-2 text-left">Free Item</th><th className="p-2 text-right">Eligible</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Pending</th><th className="p-2 text-right">Need More</th><th className="p-2 text-left">Record Received</th></tr></thead>
          <tbody>{items.map((x, i) => { const key = norm(x.freeItem); return <tr key={`${x.purchaseItem}-${x.freeItem}-${i}`} className="border-t"><td className="p-2 font-medium">{x.purchaseItem}</td><td className="p-2 text-xs text-muted-foreground">{x.matchMode === "exact" ? "Exact" : "Family"}</td><td className="p-2 text-right font-semibold">{fmt(x.purchased)}</td><td className="p-2 text-right">{fmt(x.buyQty)}</td><td className="p-2 font-medium">{x.freeItem}</td><td className="p-2 text-right font-semibold text-emerald-600">{fmt(x.eligible)}</td><td className="p-2 text-right text-emerald-600">{fmt(x.received)}</td><td className="p-2 text-right font-semibold">{fmt(x.pending)}</td><td className="p-2 text-right">{fmt(x.needMore)}</td><td className="p-2">{x.pending > 0 ? <div className="flex items-center gap-2"><Input type="number" min={0} max={x.pending} value={qtyByItem[key] || ""} onChange={(e) => setQtyByItem((s) => ({ ...s, [key]: e.target.value }))} placeholder={String(x.pending)} className="h-8 w-20" /><Button type="button" size="sm" onClick={() => addReceived(x.freeItem, x.pending)} disabled={!Number(qtyByItem[key])}><Plus className="h-3.5 w-3.5" /> Received</Button></div> : <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Fully received</span>}</td></tr>; })}</tbody>
        </table>
      </div>
      {receipts.some((r) => r.kind === "free_item") && <div className="space-y-1"><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent free receipts</div>{receipts.filter((r) => r.kind === "free_item").slice(-5).reverse().map((r) => <div key={r.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"><span className="font-medium">{r.item || "Free item"}</span><span className="text-emerald-600">+{fmt(Number(r.qty) || 0)} received</span><span className="text-muted-foreground">{r.date || ""}</span><Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => removeReceipt(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>}
    </section>
  );
}
