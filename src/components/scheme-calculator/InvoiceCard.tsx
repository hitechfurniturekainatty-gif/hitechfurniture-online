import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Receipt, Trash2 } from "lucide-react";
import { Stat } from "./Stat";
import { fmt } from "./utils";
import type { Invoice, Row, SchemeKind, SchemeRow } from "./types";

const norm = (value: unknown) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export function InvoiceCard({ index, invoice, savedSchemes: _savedSchemes, fallbackScheme, onChange, onRemove, onEdit }: {
  index: number;
  invoice: Invoice;
  savedSchemes: SchemeRow[];
  fallbackScheme: { kind: SchemeKind; config: any };
  onChange: (patch: Partial<Invoice>) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const rows = invoice.rows;
  void _savedSchemes;
  const totalCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);

  const updateRow = (id: string, patch: Partial<Row>) => {
    const next = rows.map((r) => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      if (patch.qty !== undefined || patch.price !== undefined) {
        const q = Number(merged.qty) || 0;
        const p = Number(merged.price) || 0;
        if (patch.amountWithTax === undefined) merged.amountWithTax = q * p;
      }
      return merged;
    });
    onChange({ rows: next });
  };
  const removeRow = (id: string) => onChange({ rows: rows.filter((r) => r.id !== id) });

  const matchInfo = (row: Row) => {
    if (fallbackScheme.kind === "percent") return { matched: true, label: "Month percentage scheme" };
    if (fallbackScheme.kind !== "bogo") return { matched: false, label: "No item scheme" };
    const rules: any[] = Array.isArray(fallbackScheme.config?.rules) ? fallbackScheme.config.rules : [];
    const itemName = norm(row.item);
    for (const rule of rules) {
      const purchaseItem = String(rule?.purchaseItem || "").trim();
      const needle = norm(purchaseItem);
      if (!needle) continue;
      const family = rule?.matchMode === "family" && rule?.familyExplicit === true;
      const matched = family ? itemName.includes(needle) : itemName === needle;
      if (matched) return { matched: true, label: family ? `${purchaseItem} · Family` : `${purchaseItem} · Exact` };
    }
    return { matched: false, label: "No scheme" };
  };

  const matchedCount = rows.filter((r) => matchInfo(r).matched).length;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-2">
        <div className="admin-accent-tile admin-accent-mint flex h-8 w-8 items-center justify-center rounded-lg"><Receipt className="h-4 w-4" /></div>
        <Input value={invoice.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 max-w-[200px] text-sm font-medium" placeholder={`Invoice ${index + 1}`} />
        <Input value={invoice.invoice_no || ""} onChange={(e) => onChange({ invoice_no: e.target.value })} className="h-8 max-w-[160px] text-xs" placeholder="Invoice no." />
        <Input type="date" value={invoice.date || ""} onChange={(e) => onChange({ date: e.target.value })} className="h-8 max-w-[150px] text-xs" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          <Button size="sm" variant="ghost" onClick={onRemove} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
        </div>
      </div>

      <div className="border-b bg-background px-4 py-2 text-xs text-muted-foreground">
        Every invoice item is kept. Scheme matching comes only from the item rules configured for this month; old invoice-level scheme flags are ignored.
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-muted/20"><TableHead className="min-w-[220px]">Item Name</TableHead><TableHead className="w-20">Qty</TableHead><TableHead className="w-28">Purchase / Unit</TableHead><TableHead className="w-32">Total Cost</TableHead><TableHead className="min-w-[190px]">Scheme Match</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">No rows — add or paste invoice items.</TableCell></TableRow>}
            {rows.map((r) => {
              const match = matchInfo(r);
              return (
                <TableRow key={r.id}>
                  <TableCell><Input value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} className="h-8" placeholder="Item name" /></TableCell>
                  <TableCell><Input type="number" min={0} value={r.qty} onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                  <TableCell><Input type="number" min={0} value={r.price} onChange={(e) => updateRow(r.id, { price: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                  <TableCell><Input type="number" min={0} value={r.amountWithTax} onChange={(e) => updateRow(r.id, { amountWithTax: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                  <TableCell>
                    <span className={match.matched ? "inline-flex rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700" : "inline-flex rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"}>{match.label}</span>
                  </TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-4 py-2 text-xs sm:grid-cols-3">
        <Stat label="Items" value={String(rows.length)} />
        <Stat label="Invoice Cost" value={`₹${fmt(totalCost)}`} />
        <Stat label="Scheme-matched items" value={String(matchedCount)} tone="success" />
      </div>
    </div>
  );
}
