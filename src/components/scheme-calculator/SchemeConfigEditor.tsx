import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { SchemeKind } from "./types";

function SchemeConfigEditorImpl({ scheme, onChange }: { scheme: { kind: SchemeKind; config: any }; onChange: (c: any) => void }) {
  const { kind, config } = scheme;
  const set = (patch: any) => onChange({ ...config, ...patch });

  // Safety rule: family/contains matching is NEVER assumed automatically.
  // Rules created by the previous UI used family as a default. Unless the user
  // explicitly selected family matching, convert those implicit rules to exact.
  useEffect(() => {
    if (kind !== "bogo" || !Array.isArray(config?.rules)) return;
    const needsNormalising = config.rules.some((r: any) => r?.matchMode !== "exact" && r?.familyExplicit !== true);
    if (!needsNormalising) return;
    onChange({
      ...config,
      rules: config.rules.map((r: any) => r?.familyExplicit === true ? r : { ...r, matchMode: "exact", familyExplicit: false }),
    });
  }, [kind, config, onChange]);

  if (kind === "company") return <div><Label className="text-xs">1 free per N qty</Label><Input type="number" min={1} value={config.everyQty} onChange={(e) => set({ everyQty: Number(e.target.value) || 1 })} className="w-32" /></div>;
  if (kind === "own") return <div><Label className="text-xs">Target margin %</Label><Input type="number" min={0} value={config.targetMargin} onChange={(e) => set({ targetMargin: Number(e.target.value) || 0 })} className="w-32" /></div>;
  if (kind === "slab") {
    const slabs: any[] = config.slabs || [];
    return <div className="space-y-2"><Label className="text-xs">Slabs (min qty → free items)</Label>{slabs.map((s, i) => <div key={i} className="flex items-center gap-2"><Input type="number" value={s.minQty} onChange={(e) => { const arr = slabs.slice(); arr[i] = { ...s, minQty: Number(e.target.value) || 0 }; set({ slabs: arr }); }} className="w-28" placeholder="Min qty" /><span className="text-muted-foreground">→</span><Input type="number" value={s.free} onChange={(e) => { const arr = slabs.slice(); arr[i] = { ...s, free: Number(e.target.value) || 0 }; set({ slabs: arr }); }} className="w-28" placeholder="Free" /><Button size="icon" variant="ghost" onClick={() => set({ slabs: slabs.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}<Button size="sm" variant="outline" onClick={() => set({ slabs: [...slabs, { minQty: 0, free: 0 }] })}><Plus className="h-4 w-4" /> Add slab</Button></div>;
  }
  if (kind === "bogo") {
    const legacy = !Array.isArray(config?.rules);
    const rules: any[] = Array.isArray(config?.rules)
      ? config.rules
      : [{ purchaseItem: "", matchMode: "exact", familyExplicit: false, buyQty: Math.max(1, Number(config?.buyQty) || 10), freeQty: Math.max(0, Number(config?.getQty) || 1), freeItem: "" }];
    const write = (next: any[]) => onChange({ rules: next });
    const updateRule = (i: number, patch: any) => { const next = rules.slice(); next[i] = { ...next[i], ...patch }; write(next); };
    const addRule = () => write([...rules, { purchaseItem: "", matchMode: "exact", familyExplicit: false, buyQty: 10, freeQty: 1, freeItem: "" }]);
    return (
      <div className="space-y-3 rounded-md border bg-muted/20 p-3">
        <div>
          <Label className="text-sm font-semibold">Scheme items</Label>
          <p className="mt-1 text-xs text-muted-foreground">Only the item rules you add are calculated. Exact item matching is the default. Nothing else is grouped automatically.</p>
          {legacy && <p className="mt-1 text-xs text-amber-700">Old Buy X Get Y rule detected. Add the exact purchase item name below to convert it to item-based calculation.</p>}
        </div>
        {rules.map((rule, i) => {
          const explicitFamily = rule.matchMode === "family" && rule.familyExplicit === true;
          return (
            <div key={i} className="rounded-lg border bg-background p-3 space-y-3">
              <div className="grid gap-2 md:grid-cols-[2fr_1fr_90px_90px_2fr_40px] items-end">
                <div><Label className="text-xs">Purchase item</Label><Input value={rule.purchaseItem || ""} onChange={(e) => updateRule(i, { purchaseItem: e.target.value })} placeholder="e.g. Comfobond 75x60" /></div>
                <div><Label className="text-xs">Match rule</Label><Select value={explicitFamily ? "family" : "exact"} onValueChange={(v) => updateRule(i, { matchMode: v, familyExplicit: v === "family" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exact">Exact item only</SelectItem><SelectItem value="family">Family / contains — only when I choose</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Buy Qty</Label><Input type="number" min={1} value={rule.buyQty ?? 10} onChange={(e) => updateRule(i, { buyQty: Math.max(1, Number(e.target.value) || 1) })} /></div>
                <div><Label className="text-xs">Free Qty</Label><Input type="number" min={0} value={rule.freeQty ?? 1} onChange={(e) => updateRule(i, { freeQty: Math.max(0, Number(e.target.value) || 0) })} /></div>
                <div><Label className="text-xs">Free item</Label><Input value={rule.freeItem || ""} onChange={(e) => updateRule(i, { freeItem: e.target.value })} placeholder="Same item or different free item" /></div>
                <Button size="icon" variant="ghost" onClick={() => write(rules.filter((_, j) => j !== i))} disabled={rules.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              {rule.purchaseItem && <div className="text-xs text-muted-foreground">{explicitFamily ? "Only because you selected Family / contains: matching variants will be combined" : "Exact only: no other size, model or similar name will be included"} · Buy {Math.max(1, Number(rule.buyQty) || 1)} → {Math.max(0, Number(rule.freeQty) || 0)} free {rule.freeItem || rule.purchaseItem}</div>}
            </div>
          );
        })}
        <Button size="sm" variant="outline" onClick={addRule}><Plus className="h-4 w-4" /> Add Scheme Item</Button>
      </div>
    );
  }
  if (kind === "percent") return <div className="rounded-md border bg-muted/20 p-3"><Label className="text-xs">Discount percentage</Label><Input type="number" min={0} max={100} value={config.percent} onChange={(e) => set({ percent: Math.max(0, Number(e.target.value) || 0) })} className="w-32 mt-1" placeholder="e.g. 5" /></div>;
  if (kind === "cashback") return <div className="flex gap-3"><div><Label className="text-xs">Min total ₹</Label><Input type="number" value={config.minAmount} onChange={(e) => set({ minAmount: Number(e.target.value) || 0 })} className="w-32" /></div><div><Label className="text-xs">Cashback ₹</Label><Input type="number" value={config.cashback} onChange={(e) => set({ cashback: Number(e.target.value) || 0 })} className="w-32" /></div></div>;
  if (kind === "custom") {
    const groups: any[] = config.groups || [];
    const updateG = (i: number, patch: any) => { const arr = groups.slice(); arr[i] = { ...arr[i], ...patch }; set({ groups: arr }); };
    const removeG = (i: number) => set({ groups: groups.filter((_, j) => j !== i) });
    const addG = () => set({ groups: [...groups, { name: `Group ${groups.length + 1}`, slabs: [{ minQty: 10, free: 2 }], rows: [{ pattern: "", freeProduct: "" }] }] });
    return <div className="space-y-4"><Label className="text-xs">Legacy grouped scheme. Existing saved schemes remain editable.</Label>{groups.map((g, gi) => { const slabs: any[] = g.slabs || []; const updateS = (si: number, patch: any) => { const arr = slabs.slice(); arr[si] = { ...arr[si], ...patch }; updateG(gi, { slabs: arr }); }; const legacyRows = !Array.isArray(g.rows) ? String(g.patterns || "").split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean).map((p: string) => ({ pattern: p, freeProduct: g.freeProduct || "" })) : null; const rows: { pattern: string; freeProduct: string }[] = Array.isArray(g.rows) ? g.rows : (legacyRows && legacyRows.length ? legacyRows : [{ pattern: "", freeProduct: "" }]); const writeRows = (next: any[]) => updateG(gi, { rows: next, patterns: undefined, freeProduct: undefined }); const updateR = (ri: number, patch: any) => { const arr = rows.slice(); arr[ri] = { ...arr[ri], ...patch }; writeRows(arr); }; return <div key={gi} className="rounded border p-3 space-y-3 bg-background/40"><div className="grid gap-2 md:grid-cols-[1fr_40px] items-end"><div><Label className="text-xs">Group name</Label><Input value={g.name || ""} onChange={(e) => updateG(gi, { name: e.target.value })} /></div><Button size="icon" variant="ghost" onClick={() => removeG(gi)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>{slabs.map((s, si) => <div key={si} className="grid grid-cols-2 gap-2"><Input type="number" value={s.minQty} onChange={(e) => updateS(si, { minQty: Number(e.target.value) || 0 })} placeholder="Buy qty" /><Input type="number" value={s.free} onChange={(e) => updateS(si, { free: Number(e.target.value) || 0 })} placeholder="Free qty" /></div>)}{rows.map((r, ri) => <div key={ri} className="grid grid-cols-2 gap-2"><Input value={r.pattern || ""} onChange={(e) => updateR(ri, { pattern: e.target.value })} placeholder="Item match" /><Input value={r.freeProduct || ""} onChange={(e) => updateR(ri, { freeProduct: e.target.value })} placeholder="Free product" /></div>)}</div>; })}<Button size="sm" variant="outline" onClick={addG}><Plus className="h-4 w-4" /> Add group</Button></div>;
  }
  return null;
}

export function SchemeConfigEditor({ scheme, onChange }: { scheme: { kind: SchemeKind; config: any }; onChange: (c: any) => void }) { return SchemeConfigEditorImpl({ scheme, onChange }); }
