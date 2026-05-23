import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { openWhatsAppApp } from "@/lib/whatsapp";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Phone, MessageCircle, Trash2, ShieldAlert, Loader2, Sparkles, Save, Download, Lock, Copy, StickyNote, CheckCircle2, RotateCcw, FileText } from "lucide-react";
import { lockBacklog } from "@/components/admin/BacklogGate";
import { useNavigate } from "react-router-dom";
import { BANK_DETAILS, COMPANY } from "@/lib/companyInfo";
import ReceivableCallLogWindow from "@/components/admin/ReceivableCallLogWindow";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import jsPDF from "jspdf";

const GPAY_NUMBER = "9895134482";
const GPAY_NAME = "Abdul Raheem";

/**
 * Receivables — confidential admin-only ledger. Persisted in DB.
 *
 * Fixed-format parser (one record per line):
 *  - Bill No: 2 digits + 2 letters + up to 6 digits (e.g. 26HT123456)
 *  - Phone: 10-digit number near the END of the line, immediately before the amount
 *  - Amount: final numeric value on the line
 *  - Customer Details: everything between Bill No and Phone (name + place, single field)
 */

type DraftRow = {
  id: string;
  billNo: string;
  customer: string; // combined "Customer Details" (name + place)
  phone: string;
  amount: number | null;
  amountRaw: string;
  raw: string;
};

type ServerRow = {
  id: string;
  bill_no: string | null;
  customer_name: string | null;
  place: string | null;
  phone: string | null;
  pending_amount: number;
  raw_text: string | null;
  batch: number;
  created_at: string;
  closed_at?: string | null;
};

const BILL_RE = /\b(\d{2}[A-Za-z]{2}\d{1,6})\b/;
const PHONE_RE = /(?:\d[\s\-.]*){10}/g;
const AMOUNT_RE = /-?\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

function cleanLine(line: string) {
  return line
    .replace(/\u00A0/g, " ")
    .replace(/[\r]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function takeBillNo(line: string): { billNo: string; rest: string } {
  // Fixed format: 2 digits + 2 letters + up to 6 digits (e.g. 26HT123456)
  const m = line.match(BILL_RE);
  if (!m) {
    // Fallback: first alphanumeric token
    const f = line.match(/[A-Za-z0-9]+/);
    return { billNo: f ? f[0] : "", rest: f ? line.slice((f.index ?? 0) + f[0].length).trim() : line };
  }
  const billNo = m[1].toUpperCase();
  const start = m.index ?? 0;
  const rest = (line.slice(0, start) + line.slice(start + m[1].length)).trim();
  return { billNo, rest };
}

function extractTrailingPhone(rest: string): { phone: string; before: string; after: string } {
  let last: { start: number; end: number; digits: string } | null = null;
  let m: RegExpExecArray | null;
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(rest)) !== null) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length === 10) last = { start: m.index, end: m.index + m[0].length, digits };
  }
  if (!last) return { phone: "", before: rest, after: "" };
  return {
    phone: last.digits,
    before: rest.slice(0, last.start).trim().replace(/[,\-|;]+$/, "").trim(),
    after: rest.slice(last.end).trim(),
  };
}

function extractLastAmount(text: string): { amount: number | null; raw: string; rest: string } {
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(text)) !== null) {
    const t = m[0].replace(/[,\s]/g, "");
    if (t.length >= 1) last = m;
  }
  if (!last) return { amount: null, raw: "", rest: text };
  const raw = last[0];
  const numeric = parseFloat(raw.replace(/[,\s]/g, ""));
  const rest = (text.slice(0, last.index) + text.slice(last.index + raw.length)).replace(/\s{2,}/g, " ").trim();
  return { amount: Number.isFinite(numeric) ? numeric : null, raw: raw.trim(), rest };
}

function parseFreeLine(raw: string): DraftRow {
  const line = cleanLine(raw);
  const { billNo, rest: r1 } = takeBillNo(line);
  const { phone, before, after } = extractTrailingPhone(r1);
  // Amount appears AFTER phone per spec; fall back to last number if not found.
  let amountInfo = extractLastAmount(after);
  let customerText = before;
  if (amountInfo.amount == null) {
    amountInfo = extractLastAmount(before);
    customerText = amountInfo.rest;
  }
  const customer = customerText.replace(/[,|;]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return {
    id: crypto.randomUUID(),
    billNo,
    customer,
    phone,
    amount: amountInfo.amount,
    amountRaw: amountInfo.raw,
    raw: line,
  };
}

function autoParse(text: string): DraftRow[] {
  // Normalize tabs/commas to spaces so the same fixed-format parser works for pasted spreadsheet rows.
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((l) => parseFreeLine(l.replace(/\t/g, " ")));
}

const fmtAmount = (n: number | null) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
};

const csvEscape = (v: string) => {
  if (v == null) return "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
};

export default function AdminReceivables() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingRows, setLoadingRows] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [noteFor, setNoteFor] = useState<ServerRow | null>(null);

  const visibleRows = useMemo(
    () => rows.filter((r) => (tab === "open" ? !r.closed_at : !!r.closed_at)),
    [rows, tab],
  );
  const total = useMemo(
    () => visibleRows.reduce((s, r) => s + Number(r.pending_amount ?? 0), 0),
    [visibleRows],
  );

  const load = async () => {
    setLoadingRows(true);
    const { data, error } = await supabase
      .from("receivables")
      .select("id, bill_no, customer_name, place, phone, pending_amount, raw_text, batch, created_at, closed_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setRows((data as ServerRow[]) ?? []);
    }
    setLoadingRows(false);
  };

  useEffect(() => { load(); }, []);

  const handleParse = () => {
    if (!text.trim()) {
      toast({ title: "Nothing to parse", description: "Paste receivable rows first." });
      return;
    }
    const parsed = autoParse(text);
    if (parsed.length === 0) {
      toast({ title: "No rows detected", variant: "destructive" });
      return;
    }
    setDraft(parsed);
    toast({ title: `${parsed.length} row${parsed.length === 1 ? "" : "s"} ready`, description: "Review then click Save." });
  };

  const handleSave = async () => {
    if (draft.length === 0) return;
    setSaving(true);
    // pick next batch number
    const { data: maxRow } = await supabase
      .from("receivables")
      .select("batch")
      .order("batch", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextBatch = ((maxRow?.batch as number | undefined) ?? 0) + 1;
    const payload = draft.map((d) => ({
      bill_no: d.billNo || null,
      customer_name: d.customer || null,
      place: null,
      phone: d.phone || null,
      pending_amount: d.amount ?? 0,
      raw_text: d.raw,
      batch: nextBatch,
    }));
    const { error } = await supabase.from("receivables").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Saved batch ${nextBatch}`, description: `${payload.length} record${payload.length === 1 ? "" : "s"} stored.` });
    setDraft([]);
    setText("");
    load();
  };

  const removeDraft = (id: string) => setDraft((d) => d.filter((r) => r.id !== id));

  const updateDraft = (id: string, patch: Partial<DraftRow>) =>
    setDraft((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const deleteOne = async (id: string) => {
    const { error } = await supabase.from("receivables").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("receivables").delete().in("id", ids);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows((r) => r.filter((x) => !selected.has(x.id)));
    setSelected(new Set());
    toast({ title: `Removed ${ids.length} record${ids.length === 1 ? "" : "s"}` });
  };

  const deleteAll = async () => {
    const { error } = await supabase.from("receivables").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast({ title: "Clear failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows([]);
    setSelected(new Set());
    toast({ title: "Receivables cleared" });
  };

  const closeRow = async (id: string) => {
    const { error } = await supabase.from("receivables").update({ closed_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, closed_at: new Date().toISOString() } : x)));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    toast({ title: "Moved to Closed" });
  };

  const reopenRow = async (id: string) => {
    const { error } = await supabase.from("receivables").update({ closed_at: null }).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, closed_at: null } : x)));
    toast({ title: "Reopened" });
  };

  const formatCopyLine = (r: ServerRow) => {
    // Format: BILL CUSTOMER PHONE AMOUNT  (customer_name already contains name + place)
    const parts = [
      r.bill_no || "",
      [r.customer_name, r.place].filter(Boolean).join(" "),
      r.phone || "",
      String(Math.round(Number(r.pending_amount ?? 0))),
    ].filter(Boolean);
    return parts.join(" ").replace(/\s{2,}/g, " ").trim();
  };

  const copyOne = async (r: ServerRow) => {
    try {
      await navigator.clipboard.writeText(formatCopyLine(r));
      toast({ title: "Copied", description: formatCopyLine(r) });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const copyAll = async () => {
    const text = visibleRows.map(formatCopyLine).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `Copied ${visibleRows.length} row(s)` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const exportCSV = () => {
    const header = ["Bill No", "Customer", "Place", "Phone", "Pending Amount", "Created At"].join(",");
    const body = visibleRows
      .map((r) =>
        [
          csvEscape(r.bill_no ?? ""),
          csvEscape(r.customer_name ?? ""),
          csvEscape(r.place ?? ""),
          csvEscape(r.phone ?? ""),
          String(r.pending_amount ?? 0),
          new Date(r.created_at).toISOString(),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receivables-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 32;
    let y = margin;
    doc.setFontSize(14);
    doc.text(`Receivables — ${tab === "open" ? "Pending" : "Closed"}`, margin, y);
    y += 16;
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}    Records: ${visibleRows.length}    Total: ₹${total.toFixed(0)}`, margin, y);
    y += 18;
    doc.setFontSize(9);
    const cols = [
      { h: "#", w: 24 },
      { h: "Bill No", w: 80 },
      { h: "Customer", w: 200 },
      { h: "Phone", w: 80 },
      { h: "Amount", w: 70 },
    ];
    let x = margin;
    cols.forEach((c) => { doc.text(c.h, x, y); x += c.w; });
    y += 12;
    doc.setLineWidth(0.5);
    doc.line(margin, y - 8, margin + cols.reduce((s, c) => s + c.w, 0), y - 8);
    visibleRows.forEach((r, i) => {
      if (y > 800) { doc.addPage(); y = margin; }
      x = margin;
      const vals = [
        String(i + 1),
        r.bill_no ?? "",
        [r.customer_name, r.place].filter(Boolean).join(" "),
        r.phone ?? "",
        `₹${Number(r.pending_amount ?? 0).toFixed(0)}`,
      ];
      vals.forEach((v, idx) => {
        const txt = doc.splitTextToSize(v, cols[idx].w - 4)[0] ?? "";
        doc.text(txt, x, y);
        x += cols[idx].w;
      });
      y += 14;
    });
    doc.save(`receivables-${tab}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const callPhone = (p: string) => { if (p) window.location.href = `tel:+91${p}`; };
  const wa = (p: string, amt: number) => {
    if (!p) return;
    const msg = [
      `Greetings from ${COMPANY.name}!`,
      ``,
      `Hope you are having a wonderful day. This is a friendly reminder regarding a pending balance of ${fmtAmount(amt)} on your account.`,
      ``,
      `For your convenience, you can settle the amount using either of the options below:`,
      ``,
      `🏦 Bank Transfer (NEFT/IMPS)`,
      `Bank: ${BANK_DETAILS.bankName}`,
      `A/c Name: ${BANK_DETAILS.accountName}`,
      `A/c No: ${BANK_DETAILS.accountNumber}`,
      `IFSC: ${BANK_DETAILS.ifsc}`,
      `Branch: ${BANK_DETAILS.branch}`,
      ``,
      `📱 Google Pay / UPI`,
      `${GPAY_NUMBER} (${GPAY_NAME})`,
      ``,
      `Kindly share the payment screenshot once done. Thank you for your continued support!`,
    ].join("\n");
    openWhatsAppApp(`91${p}`, msg);
  };

  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visibleRows.map((r) => r.id)));

  const openCount = rows.filter((r) => !r.closed_at).length;
  const closedCount = rows.length - openCount;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Backlog · Receivables</h1>
          <p className="text-sm text-muted-foreground">
            Paste rows from Busy Accounting or Excel. Bill No format: 2 digits + 2 letters + up to 6 digits (e.g. 26HT123456).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <ShieldAlert className="h-3.5 w-3.5" /> Confidential
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => { lockBacklog(); navigate("/admin", { replace: true }); }}
            title="Lock and exit"
          >
            <Lock className="h-4 w-4" /> Lock
          </Button>
        </div>
      </header>

      {/* Total Outstanding Header */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {tab === "open" ? "Total Pending Amount" : "Total Closed Amount"}
            </p>
            <p className="font-display text-2xl md:text-3xl font-semibold tabular-nums">{fmtAmount(total)}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {visibleRows.length} record{visibleRows.length === 1 ? "" : "s"} ·{" "}
            <span className="text-foreground">{openCount} open</span> · {closedCount} closed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paste & parse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste rows — one per line.\n26HT123456 Rahul Kumar Kalpetta 9876543210 12500\n26HT123457 Anjali Menon Sulthan Bathery 9988776655 8200`}
            className="min-h-[140px] font-mono text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Bill No (e.g. 26HT123456) → Customer Details → 10-digit Phone → Final Amount.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setText(""); setDraft([]); }} disabled={!text && draft.length === 0}>Clear</Button>
              <Button onClick={handleParse} className="gap-2"><Sparkles className="h-4 w-4" /> Parse</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {draft.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Preview ({draft.length}) — review then save</CardTitle>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save all
            </Button>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Customer Details</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell><input className="w-32 rounded border bg-background px-2 py-1 font-mono text-xs uppercase" value={r.billNo} onChange={(e) => updateDraft(r.id, { billNo: e.target.value.slice(0, 10) })} /></TableCell>
                      <TableCell><input className="w-64 rounded border bg-background px-2 py-1 text-sm" value={r.customer} onChange={(e) => updateDraft(r.id, { customer: e.target.value })} /></TableCell>
                      <TableCell><input className="w-32 rounded border bg-background px-2 py-1 font-mono text-xs" value={r.phone} onChange={(e) => updateDraft(r.id, { phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} /></TableCell>
                      <TableCell className="text-right">
                        <input
                          className="w-28 rounded border bg-background px-2 py-1 text-right font-mono text-sm"
                          value={r.amount ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9.-]/g, "");
                            const n = v === "" ? null : Number(v);
                            updateDraft(r.id, { amount: Number.isFinite(n as number) ? (n as number) : null, amountRaw: v });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeDraft(r.id)} aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Customer follow-ups</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {visibleRows.length} record{visibleRows.length === 1 ? "" : "s"} · Total: <span className="font-semibold text-foreground">{fmtAmount(total)}</span>
              {selected.size > 0 && <> · <span className="font-medium text-foreground">{selected.size} selected</span></>}
            </p>
            <Tabs value={tab} onValueChange={(v) => { setTab(v as "open" | "closed"); setSelected(new Set()); }} className="mt-2">
              <TabsList className="h-8">
                <TabsTrigger value="open" className="text-xs h-7">Open ({openCount})</TabsTrigger>
                <TabsTrigger value="closed" className="text-xs h-7">Closed ({closedCount})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={copyAll} disabled={visibleRows.length === 0}>
              <Copy className="h-4 w-4" /> Copy all
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={exportCSV} disabled={visibleRows.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={exportPDF} disabled={visibleRows.length === 0}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
            {selected.size > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1">
                    <Trash2 className="h-4 w-4" /> Delete selected ({selected.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete selected?</AlertDialogTitle>
                    <AlertDialogDescription>This permanently removes {selected.size} record(s).</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteSelected}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {rows.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1">
                    <Trash2 className="h-4 w-4" /> Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear ALL receivables?</AlertDialogTitle>
                    <AlertDialogDescription>This permanently removes all {rows.length} records. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAll}>Delete all</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loadingRows ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : visibleRows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {tab === "open" ? "No open receivables." : "No closed customers yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Bill No</TableHead>
                    <TableHead>Customer Details</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-56 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((r, idx) => (
                    <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={(c) => setSelected((s) => {
                            const n = new Set(s);
                            if (c) n.add(r.id); else n.delete(r.id);
                            return n;
                          })}
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{r.bill_no || "—"}</TableCell>
                      <TableCell className="font-medium">
                        {[r.customer_name, r.place].filter(Boolean).join(" ") || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.phone || <span className="text-destructive">missing</span>}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtAmount(Number(r.pending_amount))}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => copyOne(r)} title="Copy line">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-amber-600" onClick={() => setNoteFor(r)} title="Call notes">
                            <StickyNote className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="default" className="h-9 w-9" disabled={!r.phone} onClick={() => callPhone(r.phone!)} title="Call">
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-9 w-9 text-emerald-600 hover:text-emerald-700" disabled={!r.phone} onClick={() => wa(r.phone!, Number(r.pending_amount))} title="WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {tab === "open" ? (
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-emerald-600 hover:text-emerald-700" onClick={() => closeRow(r.id)} title="Mark as closed (paid)">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-primary" onClick={() => reopenRow(r.id)} title="Reopen">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => deleteOne(r.id)} title="Remove">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ReceivableCallLogWindow
        open={!!noteFor}
        receivableId={noteFor?.id ?? null}
        title={noteFor ? [noteFor.bill_no, noteFor.customer_name].filter(Boolean).join(" · ") : ""}
        onClose={() => setNoteFor(null)}
      />
    </div>
  );
}
