import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Gift, Plus, Trash2 } from "lucide-react";
import { aggregateRowsByItem, computeFreeReport, fmt } from "./utils";
import type { BenefitReceipt, Row, SchemeKind, VendorMonth } from "./types";

const norm = (v: string | undefined) => String(v || "").trim().toLowerCase();

/**
 * Calculate eligibility correctly across the whole month.
 * The same item may appear in multiple invoices; quantity-scheme eligibility
 * must use the combined quantity, not calculate each invoice row separately.
 * Rows are first grouped by the applied scheme, then aggregated by item.
 */
function eligibleByItem(vm: VendorMonth) {
  const rows: Row[] = vm.invoices?.length ? vm.invoices.flatMap((i) => i.rows) : vm.purchase_rows;
  const schemeGroups = new Map<string, { kind: SchemeKind; config: any; rows: Row[] }>();

  for (const row of rows) {
    if (!row.item?.trim() || Number(row.qty) <= 0) continue;
    const kind: SchemeKind = row.scheme_kind || vm.scheme_kind;
    const config = row.scheme_config || vm.scheme_config;
    const schemeKey = row.scheme_rule_id || `${kind}:${JSON.stringify(config)}`;
    const existing = schemeGroups.get(schemeKey);
    if (existing) existing.rows.push(row);
    else schemeGroups.set(schemeKey, { kind, config, rows: [row] });
  }

  const result = new Map<string, { item: string; purchaseQty: number; eligible: number }>();

  for (const group of schemeGroups.values()) {
    const aggregated = aggregateRowsByItem(group.rows);
    for (const row of aggregated) {
      const report: any = computeFreeReport({ kind: group.kind, config: group.config }, [row]);
      const eligible = (report.rep || []).reduce((sum: number, x: any) => sum + (Number(x.free) || 0), 0);
      const key = norm(row.item);
      const current = result.get(key);
      if (current) {
        current.purchaseQty += Number(row.qty) || 0;
        current.eligible += eligible;
      } else {
        result.set(key, { item: row.item.trim(), purchaseQty: Number(row.qty) || 0, eligible });
      }
    }
  }

  return Array.from(result.values()).filter((x) => x.eligible > 0);
}

export function ItemBenefitTracker({ vm, onChange }: {
  vm: VendorMonth;
  onChange: (receipts: BenefitReceipt[]) => void;
}) {
  const receipts = vm.benefit_receipts || [];
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});

  const items = useMemo(() => {
    const eligible = eligibleByItem(vm);
    return eligible.map((x) => {
      const received = receipts
        .filter((r) => r.kind === "free_item" && norm(r.item) === norm(x.item))
        .reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
      return { ...x, received, pending: Math.max(0, x.eligible - received) };
    });
  }, [vm.invoices, vm.purchase_rows, vm.scheme_kind, vm.scheme_config, vm.benefit_receipts]);

  const linkedReceived = items.reduce((sum, x) => sum + x.received, 0);
  const allFreeReceived = receipts.filter((r) => r.kind === "free_item").reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  const unassigned = Math.max(0, allFreeReceived - linkedReceived);

  const addReceived = (item: string, pending: number) => {
    const key = norm(item);
    const entered = Math.max(0, Number(qtyByItem[key]) || 0);
    if (!entered || pending <= 0) return;
    const qty = Math.min(entered, pending);
    const next: BenefitReceipt = {
      id: crypto.randomUUID(),
      kind: "free_item",
      item,
      qty,
      date: new Date().toISOString().slice(0, 10),
    };
    onChange([...receipts, next]);
    setQtyByItem((s) => ({ ...s, [key]: "" }));
  };

  const removeReceipt = (id: string) => onChange(receipts.filter((r) => r.id !== id));

  if (!items.length) return (
    <div className="rounded-xl border bg-background/50 p-4 text-sm text-muted-foreground">
      Add invoice quantities and a quantity scheme to see item-wise free eligibility.
    </div>
  );

  return (
    <section className="rounded-xl border bg-background/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Item-wise Free Tracking</h4></div>
          <p className="mt-1 text-xs text-muted-foreground">Same item quantities across all invoices are combined automatically before free eligibility is calculated.</p>
        </div>
        {unassigned > 0 && <div className="rounded-md border px-2 py-1 text-xs text-amber-700">{fmt(unassigned)} received free not linked to an item</div>}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-xs">
            <tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Purchased Qty</th><th className="p-2 text-right">Eligible Free</th><th className="p-2 text-right">Received Free</th><th className="p-2 text-right">Pending Free</th><th className="p-2 text-left">Record received</th></tr>
          </thead>
          <tbody>
            {items.map((x) => {
              const key = norm(x.item);
              return <tr key={key} className="border-t">
                <td className="p-2 font-medium">{x.item}</td>
                <td className="p-2 text-right">{fmt(x.purchaseQty)}</td>
                <td className="p-2 text-right font-semibold">{fmt(x.eligible)}</td>
                <td className="p-2 text-right text-emerald-600">{fmt(x.received)}</td>
                <td className="p-2 text-right font-semibold">{fmt(x.pending)}</td>
                <td className="p-2">
                  {x.pending > 0 ? <div className="flex items-center gap-2">
                    <Input type="number" min={0} max={x.pending} value={qtyByItem[key] || ""} onChange={(e) => setQtyByItem((s) => ({ ...s, [key]: e.target.value }))} placeholder={String(x.pending)} className="h-8 w-24" />
                    <Button type="button" size="sm" onClick={() => addReceived(x.item, x.pending)} disabled={!Number(qtyByItem[key])}><Plus className="h-3.5 w-3.5" /> Received</Button>
                  </div> : <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Fully received</span>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      {receipts.some((r) => r.kind === "free_item" && items.some((x) => norm(x.item) === norm(r.item))) && <div className="space-y-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent item receipts</div>
        {receipts.filter((r) => r.kind === "free_item" && items.some((x) => norm(x.item) === norm(r.item))).slice(-5).reverse().map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
            <span className="font-medium">{r.item}</span><span className="text-emerald-600">+{fmt(Number(r.qty) || 0)} received</span><span className="text-muted-foreground">{r.date || ""}</span>
            <Button type="button" size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => removeReceipt(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>}
    </section>
  );
}
