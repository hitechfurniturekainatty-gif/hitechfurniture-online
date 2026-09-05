import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { SchemeKind } from "./types";

const blankRule = () => ({ purchaseItem: "", matchMode: "exact", familyExplicit: false, buyQty: 10, freeQty: 1, freeItem: "" });

export function SchemeConfigEditor({ scheme, onChange }: { scheme: { kind: SchemeKind; config: any }; onChange: (c: any) => void }) {
  const kind = scheme?.kind || "bogo";
  const config = scheme?.config && typeof scheme.config === "object" ? scheme.config : {};
  const set = (patch: any) => onChange({ ...config, ...patch });

  if (kind === "bogo") {
    const sourceRules: any[] = Array.isArray(config.rules) ? config.rules : [];
    const rules = sourceRules.length ? sourceRules.map((r) => ({
      ...blankRule(),
      ...(r || {}),
      matchMode: r?.matchMode === "family" && r?.familyExplicit === true ? "family" : "exact",
      familyExplicit: r?.matchMode === "family" && r?.familyExplicit === true,
    })) : [blankRule()];
    const write = (next: any[]) => onChange({ ...config, rules: next.length ? next : [blankRule()] });
    const updateRule = (index: number, patch: any) => write(rules.map((r, i) => i === index ? { ...r, ...patch } : r));

    return <div className="space-y-3">
      <div className="rounded-xl border bg-white px-4 py-3">
        <Label className="text-sm font-semibold text-[#303a3b]">Scheme items</Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Enter only items that actually have a scheme. Exact item is the safe default. Choose Family / contains only when variants must be combined.</p>
      </div>
      {rules.map((rule, i) => {
        const family = rule.matchMode === "family" && rule.familyExplicit === true;
        return <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><div className="text-sm font-semibold">Scheme item {i + 1}</div><div className="text-[11px] text-muted-foreground">Purchase item → Buy Qty → Free Qty → Free item</div></div>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={rules.length === 1} onClick={() => write(rules.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1.25fr_100px_100px_2fr]">
            <div><Label className="text-xs">Purchase item</Label><Input className="mt-1" value={rule.purchaseItem || ""} onChange={(e) => updateRule(i, { purchaseItem: e.target.value })} placeholder="e.g. Comfobond 75x60" /></div>
            <div><Label className="text-xs">Match</Label><Select value={family ? "family" : "exact"} onValueChange={(v) => updateRule(i, { matchMode: v, familyExplicit: v === "family" })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exact">Exact item only</SelectItem><SelectItem value="family">Family / contains</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Buy Qty</Label><Input className="mt-1" type="number" min={1} value={Math.max(1, Number(rule.buyQty) || 1)} onChange={(e) => updateRule(i, { buyQty: Math.max(1, Number(e.target.value) || 1) })} /></div>
            <div><Label className="text-xs">Free Qty</Label><Input className="mt-1" type="number" min={0} value={Math.max(0, Number(rule.freeQty ?? rule.getQty) || 0)} onChange={(e) => updateRule(i, { freeQty: Math.max(0, Number(e.target.value) || 0) })} /></div>
            <div><Label className="text-xs">Free item</Label><Input className="mt-1" value={rule.freeItem || ""} onChange={(e) => updateRule(i, { freeItem: e.target.value })} placeholder="Blank = same item" /></div>
          </div>
          {String(rule.purchaseItem || "").trim() && <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${family ? "border-amber-500/20 bg-amber-500/5 text-amber-700" : "border-[#b9d6cd] bg-[#f2f8f5] text-[#55766b]"}`}>{family ? "Family matching is ON: matching variants are combined." : "Exact matching: similar names and other sizes are not combined."}</div>}
        </div>;
      })}
      <Button type="button" size="sm" variant="outline" onClick={() => write([...rules, blankRule()])}><Plus className="h-4 w-4" /> Add Scheme Item</Button>
    </div>;
  }

  if (kind === "percent") return <div className="rounded-xl border bg-white p-4"><Label className="text-xs">Discount percentage</Label><Input type="number" min={0} max={100} value={Number(config.percent) || 0} onChange={(e) => set({ percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="mt-1 w-32" /></div>;

  if (kind === "company") return <div className="rounded-xl border bg-white p-4"><Label className="text-xs">1 free per N qty</Label><Input type="number" min={1} value={Math.max(1, Number(config.everyQty) || 10)} onChange={(e) => set({ everyQty: Math.max(1, Number(e.target.value) || 1) })} className="mt-1 w-32" /></div>;
  if (kind === "own") return <div className="rounded-xl border bg-white p-4"><Label className="text-xs">Target margin %</Label><Input type="number" min={0} value={Number(config.targetMargin) || 0} onChange={(e) => set({ targetMargin: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-32" /></div>;
  if (kind === "cashback") return <div className="grid gap-3 sm:grid-cols-2"><div><Label className="text-xs">Minimum purchase ₹</Label><Input type="number" min={0} value={Number(config.minAmount) || 0} onChange={(e) => set({ minAmount: Math.max(0, Number(e.target.value) || 0) })} /></div><div><Label className="text-xs">Cashback ₹</Label><Input type="number" min={0} value={Number(config.cashback) || 0} onChange={(e) => set({ cashback: Math.max(0, Number(e.target.value) || 0) })} /></div></div>;

  if (kind === "slab") {
    const slabs: any[] = Array.isArray(config.slabs) ? config.slabs : [];
    return <div className="space-y-2"><Label className="text-xs">Legacy slabs</Label>{slabs.map((s, i) => <div key={i} className="flex gap-2"><Input type="number" min={0} value={Number(s?.minQty) || 0} onChange={(e) => { const next = slabs.slice(); next[i] = { ...s, minQty: Number(e.target.value) || 0 }; set({ slabs: next }); }} placeholder="Min qty" /><Input type="number" min={0} value={Number(s?.free) || 0} onChange={(e) => { const next = slabs.slice(); next[i] = { ...s, free: Number(e.target.value) || 0 }; set({ slabs: next }); }} placeholder="Free" /><Button type="button" size="icon" variant="ghost" onClick={() => set({ slabs: slabs.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>)}<Button type="button" size="sm" variant="outline" onClick={() => set({ slabs: [...slabs, { minQty: 10, free: 1 }] })}><Plus className="h-4 w-4" /> Add slab</Button></div>;
  }

  return <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-700">This is an older saved scheme type. It remains preserved, but new monthly setup should use Item-wise Quantity Scheme.</div>;
}
