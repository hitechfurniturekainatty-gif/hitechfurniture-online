import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Calculator, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/brand";
import { estimate, estimateRange, measureFor, UNIT_LABEL, type RateUnit } from "@/lib/supplierOrders";

// Rate Card & Price Estimate: each supplier's rate per sq ft / running ft / piece, so staff
// can give a custom-furniture customer an approximate price on the spot instead of phoning
// suppliers. Staff see selling rates only (rate_card()); admins also manage cost rates.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables are newer than the generated types
const db = supabase as any;

type CardRow = { id: string; supplier_name: string; item_type: string; material: string | null; unit: RateUnit; sell_rate: number; days_to_make: number | null; note: string | null; updated_at: string };
type AdminRow = CardRow & { cost_rate: number; is_active: boolean };
type Edit = { id?: string; supplier_name: string; item_type: string; material: string; unit: RateUnit; cost_rate: string; sell_rate: string; days_to_make: string; note: string; is_active: boolean };

const UNITS: RateUnit[] = ["sqft", "rft", "piece", "seat", "set"];
const blank: Edit = { supplier_name: "", item_type: "", material: "", unit: "sqft", cost_rate: "", sell_rate: "", days_to_make: "", note: "", is_active: true };

function RateCardPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<CardRow[]>([]);
  const [all, setAll] = useState<AdminRow[]>([]);
  const [type, setType] = useState("");
  const [material, setMaterial] = useState("");
  const [w, setW] = useState(""); const [h, setH] = useState(""); const [len, setLen] = useState(""); const [count, setCount] = useState("1");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await db.rpc("rate_card");
    if (r.error) toast.error(r.error.message); else setCard(r.data ?? []);
    if (isAdmin) {
      const a = await db.from("supplier_rates").select("*").order("item_type").order("supplier_name");
      if (a.error) toast.error(a.error.message); else setAll(a.data ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const types = useMemo(() => Array.from(new Set(card.map((c) => c.item_type))).sort(), [card]);
  useEffect(() => { if (!type && types.length) setType(types[0]); }, [types, type]);
  const ofType = card.filter((c) => c.item_type === type);
  const materials = Array.from(new Set(ofType.map((c) => c.material ?? ""))).filter(Boolean).sort();
  const rows = ofType.filter((c) => !material || (c.material ?? "") === material);
  const units = Array.from(new Set(rows.map((r) => r.unit)));
  const unit: RateUnit = units[0] ?? "sqft";
  const mixedUnits = units.length > 1;
  const m = measureFor(unit, Number(w), Number(h), Number(len), Number(count));
  const range = mixedUnits ? null : estimateRange(rows.map((r) => Number(r.sell_rate)), m);
  const sizeText = unit === "sqft" ? `${w || "?"} × ${h || "?"} ft` : unit === "rft" ? `${len || "?"} running ft` : "";

  const copyForCustomer = async () => {
    if (!range) return;
    const price = range.low === range.high ? formatINR(range.low) : `${formatINR(range.low)} – ${formatINR(range.high)}`;
    const text = `${type}${material ? ` (${material})` : ""}${sizeText ? `, ${sizeText}` : ""}${Number(count) > 1 ? ` × ${count}` : ""}: approx ${price}. Final price after measurement and design. — Hitech Furniture`;
    try { await navigator.clipboard.writeText(text); toast.success("Copied. WhatsApp-ൽ paste ചെയ്യാം."); } catch { toast.error("Copy failed"); }
  };

  const save = async () => {
    if (!edit) return;
    if (!edit.supplier_name.trim() || !edit.item_type.trim()) return toast.error("Supplier and item type are required");
    if (!(Number(edit.sell_rate) > 0)) return toast.error("Enter the selling rate");
    if (edit.cost_rate === "" || Number(edit.cost_rate) < 0) return toast.error("Enter the cost rate");
    setBusy(true);
    const payload = {
      supplier_name: edit.supplier_name.trim(), item_type: edit.item_type.trim(), material: edit.material.trim() || null, unit: edit.unit,
      cost_rate: Number(edit.cost_rate), sell_rate: Number(edit.sell_rate), days_to_make: edit.days_to_make === "" ? null : Number(edit.days_to_make),
      note: edit.note.trim() || null, is_active: edit.is_active,
    };
    const res = edit.id ? await db.from("supplier_rates").update(payload).eq("id", edit.id) : await db.from("supplier_rates").insert(payload);
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Saved"); setEdit(null); void load();
  };

  const remove = async (r: AdminRow) => {
    if (!window.confirm(`Delete ${r.supplier_name} · ${r.item_type}? (Switching it off keeps the history.)`)) return;
    const res = await db.from("supplier_rates").delete().eq("id", r.id);
    if (res.error) return toast.error(res.error.message);
    void load();
  };

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="admin-page-head flex items-start gap-3 p-4">
          <div className="admin-accent-tile admin-accent-blush flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Calculator className="h-5 w-5" /></div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">Rate Card &amp; Price Estimate</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Custom item-ന് customer-നോട് ഉടനെ ഏകദേശ വില പറയാൻ. Supplier-നെ വിളിക്കാൻ കാത്തിരിക്കേണ്ട. Final വില measurement-നു ശേഷം.</p>
          </div>
        </div>

        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          : card.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Rate card ഇതുവരെ ഇട്ടിട്ടില്ല. {isAdmin ? "താഴെ 'Add rate' അമർത്തി supplier rates ചേർക്കുക." : "Admin supplier rates ചേർക്കണം."}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap gap-2">
                {types.map((t) => <Button key={t} size="sm" variant={t === type ? "default" : "outline"} onClick={() => { setType(t); setMaterial(""); }}>{t}</Button>)}
              </div>
              {materials.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={!material ? "secondary" : "ghost"} onClick={() => setMaterial("")}>All materials</Button>
                  {materials.map((mt) => <Button key={mt} size="sm" variant={mt === material ? "secondary" : "ghost"} onClick={() => setMaterial(mt)}>{mt}</Button>)}
                </div>
              )}
              {mixedUnits && <p className="text-xs text-amber-700">These rates use different units ({units.map((u) => UNIT_LABEL[u]).join(", ")}). Pick one material to estimate.</p>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {unit === "sqft" && <>
                  <div><Label htmlFor="rc-w">Width (ft)</Label><Input id="rc-w" type="number" inputMode="decimal" min="0" value={w} onChange={(e) => setW(e.target.value)} /></div>
                  <div><Label htmlFor="rc-h">Height (ft)</Label><Input id="rc-h" type="number" inputMode="decimal" min="0" value={h} onChange={(e) => setH(e.target.value)} /></div>
                </>}
                {unit === "rft" && <div><Label htmlFor="rc-l">Length (ft)</Label><Input id="rc-l" type="number" inputMode="decimal" min="0" value={len} onChange={(e) => setLen(e.target.value)} /></div>}
                <div><Label htmlFor="rc-n">How many</Label><Input id="rc-n" type="number" inputMode="numeric" min="1" value={count} onChange={(e) => setCount(e.target.value)} /></div>
              </div>

              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Approx price{unit === "sqft" && m > 0 ? ` · ${m} sq ft` : ""}</p>
                <p className="text-2xl font-semibold">{range ? (range.low === range.high ? formatINR(range.low) : `${formatINR(range.low)} – ${formatINR(range.high)}`) : "Enter the size"}</p>
                {range && <Button size="sm" variant="outline" className="mt-2" onClick={() => void copyForCustomer()}><Copy className="mr-1 h-4 w-4" />Copy for customer</Button>}
              </div>

              <div className="divide-y rounded-lg border text-sm">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.supplier_name}{r.material ? <span className="font-normal text-muted-foreground"> · {r.material}</span> : null}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatINR(Number(r.sell_rate))} {UNIT_LABEL[r.unit]}{r.days_to_make != null ? ` · ~${r.days_to_make} days to make` : ""}{r.note ? ` · ${r.note}` : ""}</p>
                    </div>
                    {!mixedUnits && m > 0 && <p className="shrink-0 font-semibold">{formatINR(estimate(Number(r.sell_rate), m))}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

        {isAdmin && (
          <div className="space-y-2 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div><h2 className="font-semibold">Manage rates (admin only)</h2><p className="text-xs text-muted-foreground">Cost rate is visible only to admins. Staff see the selling rate.</p></div>
              <Button size="sm" onClick={() => setEdit({ ...blank, item_type: type })}><Plus className="mr-1 h-4 w-4" />Add rate</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-2 py-2 text-left">Item / material</th><th className="px-2 py-2 text-left">Supplier</th><th className="px-2 py-2 text-right">Cost</th><th className="px-2 py-2 text-right">Selling</th><th className="px-2 py-2 text-right">Margin</th><th className="px-2 py-2" /></tr>
                </thead>
                <tbody>
                  {all.map((r) => {
                    const margin = Number(r.sell_rate) > 0 ? Math.round((1 - Number(r.cost_rate) / Number(r.sell_rate)) * 100) : 0;
                    return (
                      <tr key={r.id} className={`border-t ${r.is_active ? "" : "opacity-50"}`}>
                        <td className="px-2 py-2">{r.item_type}{r.material ? <span className="text-muted-foreground"> · {r.material}</span> : null} <span className="text-xs text-muted-foreground">({UNIT_LABEL[r.unit]})</span></td>
                        <td className="px-2 py-2">{r.supplier_name}</td>
                        <td className="px-2 py-2 text-right">{formatINR(Number(r.cost_rate))}</td>
                        <td className="px-2 py-2 text-right">{formatINR(Number(r.sell_rate))}</td>
                        <td className="px-2 py-2 text-right"><Badge variant={margin < 15 ? "destructive" : "secondary"}>{margin}%</Badge></td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ id: r.id, supplier_name: r.supplier_name, item_type: r.item_type, material: r.material ?? "", unit: r.unit, cost_rate: String(r.cost_rate), sell_rate: String(r.sell_rate), days_to_make: r.days_to_make == null ? "" : String(r.days_to_make), note: r.note ?? "", is_active: r.is_active })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => void remove(r)}><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                  {all.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">No rates yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => { if (!o && !busy) setEdit(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit rate" : "Add rate"}</DialogTitle><DialogDescription>One supplier, one item type and material.</DialogDescription></DialogHeader>
          {edit && (
            <div className="space-y-3 text-sm">
              <div><Label htmlFor="r-type">Item type</Label><Input id="r-type" list="r-types" value={edit.item_type} maxLength={80} placeholder="Wardrobe, Kitchen cabinet, Sofa…" onChange={(e) => setEdit({ ...edit, item_type: e.target.value })} />
                <datalist id="r-types">{types.map((t) => <option key={t} value={t} />)}</datalist></div>
              <div><Label htmlFor="r-mat">Material / finish</Label><Input id="r-mat" value={edit.material} maxLength={120} placeholder="Multiwood + laminate" onChange={(e) => setEdit({ ...edit, material: e.target.value })} /></div>
              <div><Label htmlFor="r-sup">Supplier</Label><Input id="r-sup" list="r-sups" value={edit.supplier_name} maxLength={120} onChange={(e) => setEdit({ ...edit, supplier_name: e.target.value })} />
                <datalist id="r-sups">{Array.from(new Set(all.map((a) => a.supplier_name))).map((s) => <option key={s} value={s} />)}</datalist></div>
              <div><Label htmlFor="r-unit">Rate is</Label>
                <select id="r-unit" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value as RateUnit })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label htmlFor="r-cost">Cost rate ₹</Label><Input id="r-cost" type="number" min="0" inputMode="decimal" value={edit.cost_rate} onChange={(e) => setEdit({ ...edit, cost_rate: e.target.value })} /></div>
                <div><Label htmlFor="r-sell">Selling rate ₹</Label><Input id="r-sell" type="number" min="0" inputMode="decimal" value={edit.sell_rate} onChange={(e) => setEdit({ ...edit, sell_rate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label htmlFor="r-days">Days to make</Label><Input id="r-days" type="number" min="0" max="365" value={edit.days_to_make} onChange={(e) => setEdit({ ...edit, days_to_make: e.target.value })} /></div>
                <label className="flex items-end gap-2 pb-2"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />Active</label>
              </div>
              <div><Label htmlFor="r-note">Note</Label><Input id="r-note" value={edit.note} maxLength={300} placeholder="e.g. hardware extra, min 20 sq ft" onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>Cancel</Button><Button onClick={() => void save()} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

export default function AdminRateCard() {
  const { loading, user, isOfficeStaff, isMeasurementStaff } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isOfficeStaff && !isMeasurementStaff) return <Navigate to="/admin" replace />;
  return <RateCardPage />;
}
