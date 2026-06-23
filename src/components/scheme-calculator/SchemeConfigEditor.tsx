import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { SchemeKind } from "./types";

function SchemeConfigEditorImpl({ scheme, onChange }: { scheme: { kind: SchemeKind; config: any }; onChange: (c: any) => void }) {
  const { kind, config } = scheme;
  const set = (patch: any) => onChange({ ...config, ...patch });

  if (kind === "company") return (
    <div><Label className="text-xs">1 free per N qty</Label>
      <Input type="number" min={1} value={config.everyQty} onChange={(e) => set({ everyQty: Number(e.target.value) || 1 })} className="w-32" />
    </div>
  );
  if (kind === "own") return (
    <div><Label className="text-xs">Target margin %</Label>
      <Input type="number" min={0} value={config.targetMargin} onChange={(e) => set({ targetMargin: Number(e.target.value) || 0 })} className="w-32" />
    </div>
  );
  if (kind === "slab") {
    const slabs: any[] = config.slabs || [];
    return (
      <div className="space-y-2">
        <Label className="text-xs">Slabs (min qty → free items)</Label>
        {slabs.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input type="number" value={s.minQty} onChange={(e) => { const arr = slabs.slice(); arr[i] = { ...s, minQty: Number(e.target.value) || 0 }; set({ slabs: arr }); }} className="w-28" placeholder="Min qty" />
            <span className="text-muted-foreground">→</span>
            <Input type="number" value={s.free} onChange={(e) => { const arr = slabs.slice(); arr[i] = { ...s, free: Number(e.target.value) || 0 }; set({ slabs: arr }); }} className="w-28" placeholder="Free" />
            <Button size="icon" variant="ghost" onClick={() => set({ slabs: slabs.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => set({ slabs: [...slabs, { minQty: 0, free: 0 }] })}><Plus className="h-4 w-4" /> Add slab</Button>
      </div>
    );
  }
  if (kind === "bogo") return (
    <div className="flex gap-3">
      <div><Label className="text-xs">Buy qty</Label><Input type="number" value={config.buyQty} onChange={(e) => set({ buyQty: Number(e.target.value) || 1 })} className="w-24" /></div>
      <div><Label className="text-xs">Get free</Label><Input type="number" value={config.getQty} onChange={(e) => set({ getQty: Number(e.target.value) || 0 })} className="w-24" /></div>
    </div>
  );
  if (kind === "percent") return (
    <div><Label className="text-xs">Discount %</Label>
      <Input type="number" value={config.percent} onChange={(e) => set({ percent: Number(e.target.value) || 0 })} className="w-32" />
    </div>
  );
  if (kind === "cashback") return (
    <div className="flex gap-3">
      <div><Label className="text-xs">Min total ₹</Label><Input type="number" value={config.minAmount} onChange={(e) => set({ minAmount: Number(e.target.value) || 0 })} className="w-32" /></div>
      <div><Label className="text-xs">Cashback ₹</Label><Input type="number" value={config.cashback} onChange={(e) => set({ cashback: Number(e.target.value) || 0 })} className="w-32" /></div>
    </div>
  );
  if (kind === "custom") {
    const groups: any[] = config.groups || [];
    const updateG = (i: number, patch: any) => { const arr = groups.slice(); arr[i] = { ...arr[i], ...patch }; set({ groups: arr }); };
    const removeG = (i: number) => set({ groups: groups.filter((_, j) => j !== i) });
    const addG = () => set({ groups: [...groups, { name: `Group ${groups.length + 1}`, slabs: [{ minQty: 10, free: 2 }], rows: [{ pattern: "", freeProduct: "" }] }] });
    return (
      <div className="space-y-4">
        <Label className="text-xs">
          Product groups — bundle multiple variants (sizes/colours) under one slab. Quantities across all rows in a group are summed, then the slab unlocks the free product.
        </Label>
        {groups.map((g, gi) => {
          const slabs: any[] = g.slabs || [];
          const updateS = (si: number, patch: any) => { const arr = slabs.slice(); arr[si] = { ...arr[si], ...patch }; updateG(gi, { slabs: arr }); };
          const legacyRows = !Array.isArray(g.rows)
            ? String(g.patterns || "").split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean)
                .map((p: string) => ({ pattern: p, freeProduct: g.freeProduct || "" }))
            : null;
          const rows: { pattern: string; freeProduct: string }[] = Array.isArray(g.rows)
            ? g.rows
            : (legacyRows && legacyRows.length ? legacyRows : [{ pattern: "", freeProduct: "" }]);
          const writeRows = (next: any[]) => updateG(gi, { rows: next, patterns: undefined, freeProduct: undefined });
          const updateR = (ri: number, patch: any) => { const arr = rows.slice(); arr[ri] = { ...arr[ri], ...patch }; writeRows(arr); };
          const removeR = (ri: number) => writeRows(rows.filter((_, j) => j !== ri));
          const addR = () => writeRows([...rows, { pattern: "", freeProduct: "" }]);
          return (
            <div key={gi} className="rounded border p-3 space-y-3 bg-background/40">
              <div className="grid gap-2 md:grid-cols-[1fr_40px] items-end">
                <div><Label className="text-xs">Group name</Label>
                  <Input value={g.name || ""} onChange={(e) => updateG(gi, { name: e.target.value })} placeholder="e.g. Comfobond" /></div>
                <Button size="icon" variant="ghost" onClick={() => removeG(gi)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Slab — bundle total qty → free qty</Label>
                {slabs.map((s, si) => (
                  <div key={si} className="grid grid-cols-[1fr_1fr_40px] gap-2">
                    <Input type="number" value={s.minQty} onChange={(e) => updateS(si, { minQty: Number(e.target.value) || 0 })} placeholder="Buy qty (e.g. 10)" />
                    <Input type="number" value={s.free} onChange={(e) => updateS(si, { free: Number(e.target.value) || 0 })} placeholder="Free qty (e.g. 2)" />
                    <Button size="icon" variant="ghost" onClick={() => updateG(gi, { slabs: slabs.filter((_, j) => j !== si) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => updateG(gi, { slabs: [...slabs, { minQty: 0, free: 0 }] })}><Plus className="h-4 w-4" /> Add slab</Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bundle rows — invoice items whose quantities sum into this group</Label>
                {rows.map((r, ri) => (
                  <div key={ri} className="grid grid-cols-[2fr_2fr_40px] gap-2">
                    <Input value={r.pattern || ""} onChange={(e) => updateR(ri, { pattern: e.target.value })} placeholder="Match pattern (e.g. 75x72)" />
                    <Input value={r.freeProduct || ""} onChange={(e) => updateR(ri, { freeProduct: e.target.value })} placeholder="Free product reward" />
                    <Button size="icon" variant="ghost" onClick={() => removeR(ri)} disabled={rows.length <= 1}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={addR}><Plus className="h-4 w-4" /> Add product row</Button>
              </div>
            </div>
          );
        })}
        <Button size="sm" variant="outline" onClick={addG}><Plus className="h-4 w-4" /> Add group</Button>
      </div>
    );
  }
  return null;
}

export function SchemeConfigEditor({ scheme, onChange }: { scheme: { kind: SchemeKind; config: any }; onChange: (c: any) => void }) {
  return SchemeConfigEditorImpl({ scheme, onChange });
}
