import { refLabel, monthRef } from "./schemeAttribution";
import { invoiceRows } from "./periodBenefits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Receipt, Trash2 } from "lucide-react";
import { Stat } from "./Stat";
import { fmt, matchesSchemeRule } from "./utils";
import type { Invoice, Row, SchemeKind, SchemeRow } from "./types";

const norm = (value: unknown) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export function InvoiceCard({ index, invoice, savedSchemes: _savedSchemes, fallbackScheme, onChange, onPersist, onRemove, onEdit }: {
  index: number;
  invoice: Invoice;
  savedSchemes: SchemeRow[];
  fallbackScheme: { kind: SchemeKind; config: any };
  onChange: (patch: Partial<Invoice>) => void;
  onPersist: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  onEdit: () => void;
}) {
  const rows = invoice.rows;
  void _savedSchemes;
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const valuedRows = invoiceRows([{...invoice,document_kind:"purchase"}]);
  const totalCost = valuedRows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
  const totalMrp = valuedRows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
  const discountAmount = Math.max(0, totalMrp - totalCost);
  const discountPct = totalMrp > 0 ? (discountAmount / totalMrp) * 100 : 0;

  const updateRow = (id: string, patch: Partial<Row>) => onChange({ rows: rows.map((r) => r.id === id ? { ...r, ...patch } : r) });

  const matchInfo = (row: Row) => {
    if(row.reward) return {matched:false,label:"Reward · "+refLabel(row.reward.scheme_period||monthRef(row.reward.scheme_month))};
    if (fallbackScheme.kind === "percent") return { matched: true, label: "Percentage scheme" };
    if (fallbackScheme.kind !== "bogo") return { matched: false, label: "No scheme" };
    const rules: any[] = Array.isArray(fallbackScheme.config?.rules) ? fallbackScheme.config.rules : [];
    const itemName = norm(row.item);
    for (const rule of rules) {
      const purchaseItem = String(rule?.purchaseItem || "").trim();
      const needle = norm(purchaseItem);
      if (!needle && !Array.isArray(rule.purchaseItems)) continue;
      const family = rule?.matchMode === "family" && rule?.familyExplicit === true;
      const matched = matchesSchemeRule(rule, row.item);
      if (matched) return { matched: true, label: Array.isArray(rule.purchaseItems) ? `${purchaseItem || "Combo"} · Pooled` : family ? `${purchaseItem} · Family` : `${purchaseItem} · Exact` };
    }
    return { matched: false, label: "No scheme" };
  };

  const matchedCount = rows.filter((r) => matchInfo(r).matched).length;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="admin-accent-tile admin-accent-mint flex h-9 w-9 items-center justify-center rounded-lg"><Receipt className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="font-semibold">{invoice.document_kind === "purchase_return" ? "Return / Debit note · " : ""}{invoice.label || `Invoice ${index + 1}`}</div>
          <div className="text-xs text-muted-foreground">{invoice.invoice_no ? `No. ${invoice.invoice_no}` : "No invoice number"}{invoice.date ? ` · ${invoice.date}` : ""}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit invoice</Button>
          <Button size="sm" variant="ghost" onClick={() => void onRemove()} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
        </div>
      </div>

      <details className="p-3"><summary className="cursor-pointer text-xs font-medium">Items / MRP details ({rows.length})</summary><div className="overflow-x-auto">
        <Table className="w-full table-fixed text-xs">
          <TableHeader><TableRow className="bg-muted/15">
            <TableHead className="w-[24%]">Item</TableHead><TableHead className="w-[12%]">Type</TableHead>
            <TableHead className="w-[17%] text-right">MRP / Unit</TableHead>
            <TableHead className="w-[7%] text-right">Qty</TableHead>
            <TableHead className="w-[18%] text-right">Amount incl. Tax</TableHead>
            <TableHead className="w-[12%] text-right">Discount</TableHead>
            <TableHead className="w-[18%]">Scheme</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">No invoice items.</TableCell></TableRow>}
            {rows.map((r) => {
              const match = matchInfo(r);
              const mrpValue = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
              const cost = Number(r.amountWithTax) || 0;
              const disc = mrpValue > 0 ? ((mrpValue - cost) / mrpValue) * 100 : 0;
              return <TableRow key={r.id}>
                <TableCell className="font-medium">{r.item || "—"}</TableCell><TableCell><span className={r.reward?"rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900":"text-[11px] text-muted-foreground"}>{r.reward?"Free / scheme":invoice.document_kind==="purchase_return"?"Return":"Purchase"}</span></TableCell>
                <TableCell>
                  <Input type="number" min={0} inputMode="decimal" value={r.mrp || ""} onChange={(e) => updateRow(r.id, { mrp: e.target.value === "" ? 0 : Number(e.target.value) })} onBlur={() => void onPersist()} className="ml-auto h-9 w-full min-w-0 border-primary/30 bg-primary/[0.04] text-right font-semibold" placeholder="Enter MRP" aria-label={`MRP for ${r.item}`} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(r.qty) || 0)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">₹{fmt(cost)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{mrpValue > 0 ? `${fmt(disc)}%` : "—"}</TableCell>
                <TableCell><span className={match.matched ? "inline-flex rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-foreground" : "inline-flex rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"}>{match.label}</span></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>

      </details>
      {(invoice.discount_amount || rows.some(r=>r.reward)) ? <div className="border-t bg-primary/5 p-3 text-xs space-y-1"><p>Items ₹{fmt(rows.reduce((s,r)=>s+r.amountWithTax,0))} − Invoice discount ₹{fmt(invoice.discount_amount||0)} = Payable ₹{fmt(totalCost)}</p>{rows.filter(r=>r.reward).map(r=><p key={r.id}>{r.item} · {r.qty} free pcs · Scheme {refLabel(r.reward!.scheme_period||monthRef(r.reward!.scheme_month))} · {r.reward!.scheme_label||"No target linked"}</p>)}<p className="text-muted-foreground">Invoice discount benefit-ൽ ഉൾപ്പെട്ടിട്ടുണ്ട്. Additional benefits-ൽ വീണ്ടും ചേർക്കേണ്ടതില്ല.</p></div> : null}
      {(invoice.benefit_receipts||[]).map(c=><div key={c.id} className="border-t px-3 py-2 text-xs">Credit note · ₹{fmt(c.amount||0)} · {c.reference||"—"} · {c.scheme_period?refLabel(c.scheme_period):"This month"}{c.included_in_invoice?" · Included in bill discount":""}</div>)}
      <div className="border-t bg-muted/10 px-3 py-2 text-xs">{fmt(totalQty)} qty · Net payable <b>₹{fmt(totalCost)}</b></div>
    </div>
  );
}
