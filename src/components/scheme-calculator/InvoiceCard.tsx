import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Receipt, Trash2 } from "lucide-react";
import { Stat } from "./Stat";
import { computeFreeReport, fmt } from "./utils";
import type { Invoice, Row, SchemeKind, SchemeRow } from "./types";

export function InvoiceCard({ index, invoice, savedSchemes, fallbackScheme, onChange, onRemove, onEdit }: {
  index: number;
  invoice: Invoice;
  savedSchemes: SchemeRow[];
  fallbackScheme: { kind: SchemeKind; config: any };
  onChange: (patch: Partial<Invoice>) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const rows = invoice.rows;
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

  const applyRowScheme = (row: Row, value: string) => {
    if (value === "month") {
      updateRow(row.id, { scheme_rule_id: undefined, scheme_name: undefined, scheme_kind: undefined, scheme_config: undefined });
      return;
    }
    const scheme = savedSchemes.find((s) => s.id === value);
    if (!scheme) return;
    updateRow(row.id, {
      scheme_rule_id: scheme.id,
      scheme_name: scheme.name,
      scheme_kind: scheme.kind,
      scheme_config: scheme.config,
    });
  };

  const eligibleForRow = (r: Row) => {
    const kind = r.scheme_kind || fallbackScheme.kind;
    const config = r.scheme_config || fallbackScheme.config;
    const rep: any = computeFreeReport({ kind, config }, [r]);
    return (rep.rep || []).reduce((s: number, x: any) => s + (Number(x.free) || 0), 0);
  };

  const invoiceEligible = rows.reduce((s, r) => s + eligibleForRow(r), 0);

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Receipt className="h-4 w-4" /></div>
        <Input value={invoice.label} onChange={(e) => onChange({ label: e.target.value })} className="h-8 max-w-[200px] text-sm font-medium" placeholder={`Invoice ${index + 1}`} />
        <Input value={invoice.invoice_no || ""} onChange={(e) => onChange({ invoice_no: e.target.value })} className="h-8 max-w-[160px] text-xs" placeholder="Invoice no." />
        <Input type="date" value={invoice.date || ""} onChange={(e) => onChange({ date: e.target.value })} className="h-8 max-w-[150px] text-xs" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          <Button size="sm" variant="ghost" onClick={onRemove} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-muted/20"><TableHead className="min-w-[200px]">Item Name</TableHead><TableHead className="w-20">Qty</TableHead><TableHead className="w-28">Purchase / Unit</TableHead><TableHead className="w-32">Total Cost</TableHead><TableHead className="min-w-[190px]">Scheme</TableHead><TableHead className="w-24 text-right">Eligible Free</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground">No rows — paste invoice text above or click “Row” to add manually.</TableCell></TableRow>}
            {rows.map((r) => {
              const eligible = eligibleForRow(r);
              return (
                <TableRow key={r.id}>
                  <TableCell><Input value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} className="h-8" placeholder="Item name" /></TableCell>
                  <TableCell><Input type="number" min={0} value={r.qty} onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                  <TableCell><Input type="number" min={0} value={r.price} onChange={(e) => updateRow(r.id, { price: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                  <TableCell><Input type="number" min={0} value={r.amountWithTax} onChange={(e) => updateRow(r.id, { amountWithTax: Number(e.target.value) || 0 })} className="h-8" /></TableCell>
                  <TableCell>
                    <Select value={r.scheme_rule_id || "month"} onValueChange={(v) => applyRowScheme(r, v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Month scheme" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Use month scheme</SelectItem>
                        {savedSchemes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="mt-1 text-[10px] text-muted-foreground">{r.scheme_name ? `${r.scheme_name} · item only` : "Using default month scheme"}</div>
                  </TableCell>
                  <TableCell className="text-right"><span className={eligible > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"}>{fmt(eligible)}</span></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-4 py-2 text-xs sm:grid-cols-4">
        <Stat label="Rows" value={String(rows.length)} />
        <Stat label="Invoice Cost" value={`₹${fmt(totalCost)}`} />
        <Stat label="Item-wise schemes" value={String(rows.filter((r) => r.scheme_rule_id).length)} />
        <Stat label="Eligible Free" value={fmt(invoiceEligible)} tone="success" />
      </div>
    </div>
  );
}
