import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Receipt, Trash2 } from "lucide-react";
import { Stat } from "./Stat";
import { fmt } from "./utils";
import type { Invoice, Row } from "./types";

export function InvoiceCard({ index, invoice, onChange, onRemove, onEdit }: {
  index: number;
  invoice: Invoice;
  onChange: (patch: Partial<Invoice>) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const rows = invoice.rows;
  const totalCost = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrp = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const avgDiscount = totalMrp > 0 ? ((totalMrp - totalCost) / totalMrp) * 100 : 0;

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

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Receipt className="h-4 w-4" />
        </div>
        <Input
          value={invoice.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-8 max-w-[200px] text-sm font-medium"
          placeholder={`Invoice ${index + 1}`}
        />
        <Input
          value={invoice.invoice_no || ""}
          onChange={(e) => onChange({ invoice_no: e.target.value })}
          className="h-8 max-w-[160px] text-xs"
          placeholder="Invoice no."
        />
        <Input
          type="date"
          value={invoice.date || ""}
          onChange={(e) => onChange({ date: e.target.value })}
          className="h-8 max-w-[150px] text-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} title="Edit invoice (re-paste / add items)">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} title="Delete invoice" className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="min-w-[200px]">Item Name</TableHead>
              <TableHead className="w-20">Qty</TableHead>
              <TableHead className="w-28">Purchase Price / Unit</TableHead>
              <TableHead className="w-32">Total Cost (incl. tax)</TableHead>
              <TableHead className="w-28">MRP / Unit</TableHead>
              <TableHead className="w-28 text-right">Discount %</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-xs text-muted-foreground">
                  No rows — paste invoice text above or click “Row” to add manually.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const mrpValue = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
              const discountPct = mrpValue > 0
                ? ((mrpValue - (Number(r.amountWithTax) || 0)) / mrpValue) * 100
                : 0;
              const positive = discountPct > 0;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Input value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} className="h-8" placeholder="Item name" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.qty} onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.price} onChange={(e) => updateRow(r.id, { price: Number(e.target.value) || 0 })} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.amountWithTax} onChange={(e) => updateRow(r.id, { amountWithTax: Number(e.target.value) || 0 })} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} value={r.mrp} onChange={(e) => updateRow(r.id, { mrp: Number(e.target.value) || 0 })} className="h-8" placeholder="MRP" />
                  </TableCell>
                  <TableCell className={`text-right text-sm font-semibold ${r.mrp > 0 ? (positive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400") : "text-muted-foreground"}`}>
                    {r.mrp > 0 ? `${discountPct.toFixed(2)}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-4 py-2 text-xs sm:grid-cols-4">
        <Stat label="Rows" value={String(rows.length)} />
        <Stat label="Invoice Cost" value={`₹${fmt(totalCost)}`} />
        <Stat label="Invoice MRP" value={`₹${fmt(totalMrp)}`} />
        <Stat label="Avg Discount" value={`${avgDiscount.toFixed(2)}%`} tone={avgDiscount > 0 ? "success" : undefined} />
      </div>
    </div>
  );
}
