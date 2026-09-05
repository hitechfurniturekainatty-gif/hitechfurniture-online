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
      <div className="space-y-3">
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-sm font-semibold text-[#303a3b]">Scheme items</Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Only items you add below are calculated. Exact item matching is the default; nothing else is grouped automatically.</p>
            </div>
            <span className="admin-accent-tile admin-accent-mint rounded-lg px-2.5 py-1 text-[11px] font-medium">Exact by default</span>
          </div>
          {legacy && <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">Old Buy X Get Y rule detected. Add the exact purchase item below to convert it safely to item-based calculation.</p>}
        </div>

        {rules.map((rule, i) => {
          const explicitFamily = rule.matchMode === "family" && rule.familyExplicit === true;
          return (
            <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="admin-accent-tile admin-accent-sage flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold">{i + 1}</span>
                  <div>
                    <div className="text-sm font-semibold text-[#303a3b]">Scheme item rule</div>
                    <div className="text-[11px] text-muted-foreground">Purchase item → qualification → free item</div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => write(rules.filter((_, j) => j !== i))} disabled={rules.length <= 1} aria-label="Remove scheme item"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1.25fr_100px_100px_2fr]">
                <div><Label className="text-xs">Purchase item</Label><Input className="mt-1" value={rule.purchaseItem || ""} onChange={(e) => updateRule(i, { purchaseItem: e.target.value })} placeholder="e.g. Comfobond 75x60" /></div>
                <div><Label className="text-xs">Match rule</Label><Select value={explicitFamily ? "family" : "exact"} onValueChange={(v) => updateRule(i, { matchMode: v, familyExplicit: v === "family" })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exact">Exact item only</SelectItem><SelectItem value="family">Family / contains</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Buy Qty</Label><Input className="mt-1" type="number" min={1} value={rule.buyQty ?? 10} onChange={(e) => updateRule(i, { buyQty: Math.max(1, Number(e.target.value) || 1) })} /></div>
                <div><Label className="text-xs">Free Qty</Label><Input className="mt-1" type="number" min={0} value={rule.freeQty ?? 1} onChange={(e) => updateRule(i, { freeQty: Math.max(0, Number(e.target.value) || 0) })} /></div>
                <div><Label className="text-xs">Free item</Label><Input className="mt-1" value={rule.freeItem || ""} onChange={(e) => updateRule(i, { freeItem: e.target.value })} placeholder="Same item or different free item" /></div>
              </div>

              {rule.purchaseItem && (
                <div className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-5 ${explicitFamily ? "border-amber-500/20 bg-amber-500/5 text-amber-700" : "border-emerald-500/20 bg-emerald-500/5 text-[#55766b]"}`}>
                  {explicitFamily ? "Family / contains was explicitly selected, so matching variants can be combined." : "Exact only: other sizes, models or similar names will not be included."} Buy {Math.max(1, Number(rule.buyQty) || 1)} → {Math.max(0, Number(rule.freeQty) || 0)} free {rule.freeItem || rule.purchaseItem}.
                </div>
              )}
            </div>
          );
        })}

        <Button size="sm" variant="outline" className="gap-1.5" onClick={addRule}><Plus className="h-4 w-4" /> Add Scheme Item</Button>
      </div>
    );
  }

  if (kind === "percent") return <div className="rounded-xl border bg-white p-4"><Label className="text-xs">Discount percentage</Label><Input type="number" min={0} max={100} value={config.percent} onChange={(e) => set({ percent: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-32" placeholder="e.g. 5" /></div>;
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
