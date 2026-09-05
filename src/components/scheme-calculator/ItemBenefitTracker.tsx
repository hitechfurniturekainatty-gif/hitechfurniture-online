import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Gift, Plus, Trash2 } from "lucide-react";
import { aggregateRowsByItem, computeFreeReport, fmt } from "./utils";
import type { BenefitReceipt, Row, VendorMonth } from "./types";

const norm = (v: string | undefined) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
const ruleKey = (purchaseItem: string, freeItem: string, matchMode: string) => `${matchMode}:${norm(purchaseItem)}=>${norm(freeItem)}`;

export function ItemBenefitTracker({ vm, onChange }: {
  vm: VendorMonth;
  onChange: (receipts: BenefitReceipt[]) => void;
}) {
  const receipts = vm.benefit_receipts || [];
  const [qtyByRule, setQtyByRule] = useState<Record<string, string>>({});
  const rows: Row[] = vm.invoices?.length ? vm.invoices.flatMap((i) => i.rows) : vm.purchase_rows;

  const items = useMemo(() => {
    const report: any = computeFreeReport({ kind: vm.scheme_kind, config: vm.scheme_config }, aggregateRowsByItem(rows));
    const ruleRows = (report.rep || []).filter((r: any) => r.purchaseItem && r.freeItem);
    const duplicateFreeItems = new Set<string>();
    const counts = new Map<string, number>();
    ruleRows.forEach((r: any) => counts.set(norm(String(r.freeItem || r.purchaseItem)), (counts.get(norm(String(r.freeItem || r.purchaseItem))) || 0) + 1));
    counts.forEach((count, item) => { if (count > 1) duplicateFreeItems.add(item); });

    return ruleRows.map((r: any) => {
      const purchaseItem = String(r.purchaseItem);
      const freeItem = String(r.freeItem || r.purchaseItem);
      const matchMode = r.matchMode === "exact" ? "exact" : "family";
      const key = ruleKey(purchaseItem, freeItem, matchMode);
      const received = receipts.filter((x) => {
        if (x.kind !== "free_item") return false;
        if (x.scheme_rule_key) return x.scheme_rule_key === key;
        // Backward compatibility: an old receipt can be safely name-matched only
        // when that free item belongs to a single current rule.
        return !duplicateFreeItems.has(norm(freeItem)) && norm(x.item) === norm(freeItem);
      }).reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
      const eligible = Number(r.free) || 0;
      const purchased = Number(r.qty) || 0;
      const buyQty = Math.max(1, Number(r.buyQty) || 1);
      const completedSets = Math.floor(purchased / buyQty);
      const nextTarget = (completedSets + 1) * buyQty;
      return { key, purchaseItem, freeItem, purchased, buyQty, eligible, received, pending: Math.max(0, eligible - received), needMore: Math.max(0, nextTarget - purchased), matchMode };
    });
  }, [vm.invoices, vm.purchase_rows, vm.scheme_kind, vm.scheme_config, vm.benefit_receipts]);

  const addReceived = (x: typeof items[number]) => {
    const entered = Math.max(0, Number(qtyByRule[x.key]) || 0);
    if (!entered || x.pending <= 0) return;
    const qty = Math.min(entered, x.pending);
    const next: BenefitReceipt = {
      id: crypto.randomUUID(), kind: "free_item", item: x.freeItem, qty,
      scheme_rule_key: x.key, purchase_item: x.purchaseItem, free_item: x.freeItem,
      date: new Date().toISOString().slice(0, 10),
    };
    onChange([...receipts, next]);
    setQtyByRule((s) => ({ ...s, [x.key]: "" }));
  };

  const removeReceipt = (id: string) => onChange(receipts.filter((r) => r.id !== id));

  if (!items.length) return (
    <div className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">
      Add at least one Scheme Item with Purchase Item, Buy Qty, Free Qty and Free Item. Invoice items will then match automatically.
    </div>
  );

  return (
    <section className="rounded-xl border bg-background/50 p-4 space-y-3">
      <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /><div><h4 className="text-sm font-semibold">Item-wise Scheme Achievement</h4><p className="text-xs text-muted-foreground">Month-wide invoice quantities are combined per scheme rule. Received free goods stay linked to the correct purchase rule, even when two rules reward the same free item.</p></div></div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-muted/40 text-xs"><tr><th className="p-2 text-left">Purchase Item</th><th className="p-2 text-left">Match</th><th className="p-2 text-right">Purchased</th><th className="p-2 text-right">Buy Target</th><th className="p-2 text-left">Free Item</th><th className="p-2 text-right">Eligible</th><th className="p-2 text-right">Received</th><th className="p-2 text-right">Pending</th><th className="p-2 text-right">Need More</th><th className="p-2 text-left">Record Received</th></tr></thead>
          <tbody>{items.map((x) => <tr key={x.key} className="border-t"><td className="p-2 font-medium">{x.purchaseItem}</td><td className="p-2 text-xs text-muted-foreground">{x.matchMode === "exact" ? "Exact" : "Family"}</td><td className="p-2 text-right font-semibold">{fmt(x.purchased)}</td><td className="p-2 text-right">{fmt(x.buyQty)}</td><td className="p-2 font-medium">{x.freeItem}</td><td className="p-2 text-right font-semibold text-emerald-600">{fmt(x.eligible)}</td><td className="p-2 text-right text-emerald-600">{fmt(x.received)}</td><td className="p-2 text-right font-semibold">{fmt(x.pending)}</td><td className="p-2 text-right">{fmt(x.needMore)}</td><td className="p-2">{x.pending > 0 ? <div className="flex items-center gap-2"><Input type="number" min={0} max={x.pending} value={qtyByRule[x.key] || ""} onChange={(e) => setQtyByRule((s) => ({ ...s, [x.key]: e.target.value }))} placeholder={String(x.pending)} className="h-8 w-20" /><Button type="button" size="sm" onClick={() => addReceived(x)} disabled={!Number(qtyByRule[x.key])}><Plus className="h-3.5 w-3.5" /> Received</Button></div> : <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Fully received</span>}</td></tr>)}</tbody>
        </table>
      </div>
      {receipts.some((r) => r.kind === "free_item") && <div className="space-y-1"><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent free receipts</div>{receipts.filter((r) => r.kind === "free_item").slice(-5).reverse().map((r) => <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs"><span className="font-medium">{r.item || "Free item"}</span><span className="text-emerald-600">+{fmt(Number(r.qty) || 0)} received</span>{r.purchase_item && <span className="text-muted-foreground">for {r.purchase_item}</span>}<span className="text-muted-foreground">{r.date || ""}</span><Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => removeReceipt(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>}
    </section>
  );
}
