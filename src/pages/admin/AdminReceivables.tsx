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
import { Phone, MessageCircle, Trash2, ShieldAlert, Loader2, Sparkles, Save, Download, Lock } from "lucide-react";
import { lockBacklog } from "@/components/admin/BacklogGate";
import { useNavigate } from "react-router-dom";

/**
 * Receivables — confidential admin-only ledger. Persisted in DB.
 *
 * Smart parser supports two paste shapes (auto-detected):
 *  1) TSV/CSV from spreadsheet → tab/comma separated columns
 *  2) Free text — one record per line
 *
 * Field rules (per spec):
 *  - Bill No: FIRST 9 ALPHANUMERIC characters (skip leading spaces/symbols).
 *  - Phone: 10-digit number near the END of the line.
 *  - Amount: LAST numeric token on the line.
 *  - Place: word(s) immediately before the phone.
 *  - Customer Name: text between bill no and place.
 */

type DraftRow = {
  id: string;
  billNo: string;
  customer: string;
  place: string;
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
};

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
  // Skip leading non-alphanumerics, then take up to 9 alphanumeric chars.
  const m = line.match(/^[^A-Za-z0-9]*([A-Za-z0-9]{1,})/);
  if (!m) return { billNo: "", rest: line };
  const head = m[1];
  const billNo = head.slice(0, 9);
  // Cut from original line: leading non-alnum + the alphanumeric run we partially consumed.
  const consumedLen = (m[0].length - head.length) + billNo.length;
  const rest = line.slice(consumedLen).trim();
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

function splitNamePlace(text: string): { name: string; place: string } {
  const tokens = text.replace(/[,|;]+/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { name: "", place: "" };
  if (tokens.length === 1) return { name: tokens[0], place: "" };
  const place = tokens.pop() as string;
  return { name: tokens.join(" "), place };
}

function parseFreeLine(raw: string): DraftRow {
  const line = cleanLine(raw);
  const { billNo, rest: r1 } = takeBillNo(line);
  const { phone, before, after } = extractTrailingPhone(r1);
  // Amount usually appears AFTER phone; if not, fall back to last number on the line.
  let amountInfo = extractLastAmount(after);
  let restForName = before;
  if (amountInfo.amount == null) {
    amountInfo = extractLastAmount(before);
    restForName = amountInfo.rest;
  }
  const { name, place } = splitNamePlace(restForName);
  return {
    id: crypto.randomUUID(),
    billNo,
    customer: name,
    place,
    phone,
    amount: amountInfo.amount,
    amountRaw: amountInfo.raw,
    raw: line,
  };
}

function parseTabular(text: string): DraftRow[] {
  // Auto-detect TSV/CSV: split on tabs primarily, fall back to commas.
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const cells = line.includes("\t") ? line.split("\t") : line.split(",");
    const trimmed = cells.map((c) => c.trim());
    // Heuristic mapping: try to find phone & amount by content; bill no = first cell trimmed to 9 alnum.
    const billHead = trimmed[0]?.match(/[A-Za-z0-9]+/)?.[0] ?? "";
    const billNo = billHead.slice(0, 9);
    let phone = "";
    let amount: number | null = null;
    let amountRaw = "";
    const remaining: string[] = [];
    for (let i = 1; i < trimmed.length; i++) {
      const cell = trimmed[i];
      const digits = cell.replace(/\D/g, "");
      if (!phone && digits.length === 10) { phone = digits; continue; }
      const num = parseFloat(cell.replace(/[,\s₹]/g, ""));
      if (!isNaN(num) && /\d/.test(cell)) { amount = num; amountRaw = cell; continue; }
      remaining.push(cell);
    }
    const { name, place } = splitNamePlace(remaining.join(" "));
    return {
      id: crypto.randomUUID(),
      billNo,
      customer: name,
      place,
      phone,
      amount,
      amountRaw,
      raw: line,
    };
  });
}

function autoParse(text: string): DraftRow[] {
  // Detect tabular: any line containing tabs, OR most lines containing 3+ commas.
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const tabLines = lines.filter((l) => l.includes("\t")).length;
  const csvLines = lines.filter((l) => (l.match(/,/g)?.length ?? 0) >= 3).length;
  if (tabLines / lines.length >= 0.5 || csvLines / lines.length >= 0.7) {
    return parseTabular(text);
  }
  return lines.map(parseFreeLine);
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

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.pending_amount ?? 0), 0), [rows]);

  const load = async () => {
    setLoadingRows(true);
    const { data, error } = await supabase
      .from("receivables")
      .select("id, bill_no, customer_name, place, phone, pending_amount, raw_text, batch, created_at")
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
      place: d.place || null,
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

  const exportCSV = () => {
    const header = ["Bill No", "Customer", "Place", "Phone", "Pending Amount", "Created At"].join(",");
    const body = rows
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
    a.download = `receivables-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const callPhone = (p: string) => { if (p) window.location.href = `tel:+91${p}`; };
  const wa = (p: string, amt: number) => {
    if (!p) return;
    const msg = `Hello sir/madam, this is Hitech Furniture and Interiors. Your pending balance is ${fmtAmount(amt)}. Kindly settle this at your earliest convenience. Thank you!`;
    openWhatsAppApp(`91${p}`, msg);
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Backlog · Receivables</h1>
          <p className="text-sm text-muted-foreground">
            Paste rows from Busy Accounting or Excel. Bill No auto-trimmed to first 9 alphanumeric characters.
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
            onClick={() => { lockBacklog(); navigate("/admin"); }}
            title="Lock and exit"
          >
            <Lock className="h-4 w-4" /> Lock
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Paste & parse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste rows — one per line. Free text or tab/CSV both work.\nQ20250001A Rahul Kumar Kalpetta 9876543210 12500\nQ20250002B Anjali Menon Sulthan Bathery 9988776655 8200.50`}
            className="min-h-[140px] font-mono text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Auto-detects TSV/CSV vs free text. Phone = trailing 10 digits, Amount = last number, Place = before phone, Name = between bill & place.
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Place</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell><input className="w-28 rounded border bg-background px-2 py-1 font-mono text-xs" value={r.billNo} onChange={(e) => updateDraft(r.id, { billNo: e.target.value.slice(0, 9) })} /></TableCell>
                      <TableCell><input className="w-44 rounded border bg-background px-2 py-1 text-sm" value={r.customer} onChange={(e) => updateDraft(r.id, { customer: e.target.value })} /></TableCell>
                      <TableCell><input className="w-32 rounded border bg-background px-2 py-1 text-sm" value={r.place} onChange={(e) => updateDraft(r.id, { place: e.target.value })} /></TableCell>
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
            <CardTitle className="text-base">Saved receivables</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {rows.length} record{rows.length === 1 ? "" : "s"} · Pending total: <span className="font-semibold text-foreground">{fmtAmount(total)}</span>
              {selected.size > 0 && <> · <span className="font-medium text-foreground">{selected.size} selected</span></>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={exportCSV} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
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
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" /> Clear all
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
          ) : rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No saved records yet.</p>
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Place</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="w-32 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
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
                      <TableCell className="font-medium">{r.customer_name || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{r.place || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtAmount(Number(r.pending_amount))}</TableCell>
                      <TableCell className="font-mono text-xs">{r.phone || <span className="text-destructive">missing</span>}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="default" className="h-9 w-9" disabled={!r.phone} onClick={() => callPhone(r.phone!)} title="Call">
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-9 w-9 text-emerald-600 hover:text-emerald-700" disabled={!r.phone} onClick={() => wa(r.phone!, Number(r.pending_amount))} title="WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
