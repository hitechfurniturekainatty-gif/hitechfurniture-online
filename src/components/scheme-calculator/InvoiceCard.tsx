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
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrp = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const discountAmount = Math.max(0, totalMrp - totalCost);
  const discountPct = totalMrp > 0 ? (discountAmount / totalMrp) * 100 : 0;

  const updateRow = (id: string, patch: Partial<Row>) => onChange({ rows: rows.map((r) => r.id === id ? { ...r, ...patch } : r) });

  const matchInfo = (row: Row) => {
    if (fallbackScheme.kind === "percent") return { matched: true, label: "Percentage scheme" };
    if (fallbackScheme.kind !== "bogo") return { matched: false, label: "No scheme" };
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
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="admin-accent-tile admin-accent-mint flex h-9 w-9 items-center justify-center rounded-lg"><Receipt className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="font-semibold">{invoice.label || `Invoice ${index + 1}`}</div>
          <div className="text-xs text-muted-foreground">{invoice.invoice_no ? `No. ${invoice.invoice_no}` : "No invoice number"}{invoice.date ? ` · ${invoice.date}` : ""}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit invoice</Button>
          <Button size="sm" variant="ghost" onClick={onRemove} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[980px] table-fixed">
          <TableHeader><TableRow className="bg-muted/15">
            <TableHead className="w-[300px]">Item</TableHead>
            <TableHead className="w-[90px] text-right">Qty</TableHead>
            <TableHead className="w-[135px] text-right">MRP / Unit</TableHead>
            <TableHead className="w-[155px] text-right">Amount incl. Tax</TableHead>
            <TableHead className="w-[135px] text-right">MRP Value</TableHead>
            <TableHead className="w-[105px] text-right">Discount</TableHead>
            <TableHead className="w-[170px]">Scheme</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">No invoice items.</TableCell></TableRow>}
            {rows.map((r) => {
              const match = matchInfo(r);
              const mrpValue = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
              const cost = Number(r.amountWithTax) || 0;
              const disc = mrpValue > 0 ? ((mrpValue - cost) / mrpValue) * 100 : 0;
              return <TableRow key={r.id}>
                <TableCell className="font-medium">{r.item || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(r.qty) || 0)}</TableCell>
                <TableCell>
                  <Input type="number" min={0} inputMode="decimal" value={r.mrp || ""} onChange={(e) => updateRow(r.id, { mrp: e.target.value === "" ? 0 : Number(e.target.value) })} className="ml-auto h-9 w-[120px] border-primary/25 bg-primary/[0.03] text-right font-semibold" placeholder="Enter MRP" aria-label={`MRP for ${r.item}`} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">₹{fmt(cost)}</TableCell>
                <TableCell className="text-right tabular-nums">₹{fmt(mrpValue)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{mrpValue > 0 ? `${fmt(disc)}%` : "—"}</TableCell>
                <TableCell><span className={match.matched ? "inline-flex rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-foreground" : "inline-flex rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"}>{match.label}</span></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>

      <div className="border-t bg-muted/10 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Stat label="Items" value={String(rows.length)} />
          <Stat label="Total Qty" value={fmt(totalQty)} />
          <Stat label="Total MRP" value={`₹${fmt(totalMrp)}`} />
          <Stat label="Cost incl. Tax" value={`₹${fmt(totalCost)}`} />
          <Stat label="Vendor Discount" value={totalMrp > 0 ? `${fmt(discountPct)}% · ₹${fmt(discountAmount)}` : "Add MRP"} />
          <Stat label="Scheme Items" value={String(matchedCount)} />
        </div>
      </div>
    </div>
  );
}
