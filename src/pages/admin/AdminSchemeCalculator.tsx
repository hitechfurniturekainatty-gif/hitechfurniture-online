import { useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, Upload, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Row = {
  id: string;
  item: string;
  qty: number;
  price: number;
  amountWithTax: number;
  mrp: number;
};

type SchemeKind = "company" | "own";
type Period = "monthly" | "quarterly" | "yearly";

const newRow = (): Row => ({
  id: crypto.randomUUID(),
  item: "",
  qty: 1,
  price: 0,
  amountWithTax: 0,
  mrp: 0,
});

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "0");

const AdminSchemeCalculator = () => {
  const [scheme, setScheme] = useState<SchemeKind>("company");
  const [period, setPeriod] = useState<Period>("monthly");
  const [party, setParty] = useState("");
  const [partyQuery, setPartyQuery] = useState("");
  const [partyOptions, setPartyOptions] = useState<{ id: string; label: string }[]>([]);
  const [loadingParties, setLoadingParties] = useState(false);

  // Company scheme: every N qty → 1 free
  const [companyEveryQty, setCompanyEveryQty] = useState(10);
  // Own scheme: target margin %; system computes free items it can afford
  const [ownTargetMargin, setOwnTargetMargin] = useState(15);

  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [autofill, setAutofill] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const totalAmount = rows.reduce((s, r) => s + (Number(r.amountWithTax) || 0), 0);
    const totalMrp = rows.reduce((s, r) => s + (Number(r.mrp) || 0) * (Number(r.qty) || 0), 0);
    return { totalQty, totalAmount, totalMrp };
  }, [rows]);

  // Free-item report
  const freeReport = useMemo(() => {
    if (scheme === "company") {
      const per = Math.max(1, companyEveryQty);
      return rows
        .filter((r) => r.item && r.qty > 0)
        .map((r) => ({
          item: r.item,
          qty: r.qty,
          free: Math.floor(r.qty / per),
          note: `1 free per ${per} qty`,
        }));
    }
    // own scheme: compute total free budget from margin
    const totalMargin = rows.reduce((s, r) => {
      const mrpAmt = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
      return s + Math.max(0, mrpAmt - (Number(r.amountWithTax) || 0));
    }, 0);
    const target = (totals.totalAmount * ownTargetMargin) / 100;
    const budget = Math.max(0, totalMargin - target);
    return rows
      .filter((r) => r.item && r.qty > 0)
      .map((r) => {
        const unit = Number(r.price) || 0;
        const free = unit > 0 ? Math.floor(budget / unit / Math.max(1, rows.length)) : 0;
        return { item: r.item, qty: r.qty, free, note: `Within ${ownTargetMargin}% margin` };
      });
  }, [scheme, rows, companyEveryQty, ownTargetMargin, totals.totalAmount]);

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const removeRow = (id: string) => setRows((rs) => (rs.length === 1 ? [newRow()] : rs.filter((r) => r.id !== id)));

  const searchParties = async (q: string) => {
    setPartyQuery(q);
    if (!q || q.length < 2) {
      setPartyOptions([]);
      return;
    }
    setLoadingParties(true);
    const { data } = await supabase
      .from("quotations")
      .select("party_name, party_place, party_phone")
      .ilike("party_name", `%${q}%`)
      .limit(20);
    const uniq = new Map<string, { id: string; label: string }>();
    (data || []).forEach((d: any) => {
      const key = `${d.party_name}|${d.party_phone || ""}`;
      if (!uniq.has(key)) {
        uniq.set(key, {
          id: key,
          label: `${d.party_name} — ${d.party_place || ""}${d.party_phone ? ` · ${d.party_phone}` : ""}`,
        });
      }
    });
    setPartyOptions(Array.from(uniq.values()));
    setLoadingParties(false);
  };

  const parseText = async (text: string) => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-extract-items", {
        body: { text, kind: "quotation" },
      });
      if (error) throw error;
      const items: any[] = data?.items || [];
      if (!items.length) {
        toast({ title: "No rows found", description: "AI couldn't extract any items." });
        return;
      }
      const parsed: Row[] = items.map((it) => {
        const qty = Number(it.quantity) || 1;
        const price = Number(it.unit_price) || 0;
        return {
          id: crypto.randomUUID(),
          item: [it.description, it.measurement].filter(Boolean).join(" — "),
          qty,
          price,
          amountWithTax: price * qty,
          mrp: price,
        };
      });
      setRows((rs) => {
        const empty = rs.length === 1 && !rs[0].item;
        return empty ? parsed : [...rs, ...parsed];
      });
      toast({ title: `Added ${parsed.length} rows` });
      setAutofill("");
    } catch (e: any) {
      toast({ title: "Auto-fill failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const onUpload = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let text = "";
      if (ext === "txt" || ext === "csv") {
        text = await file.text();
      } else if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        text = wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
      } else {
        toast({ title: "Paste text instead", description: "For PDF/Word, copy text into the box below." });
        return;
      }
      await parseText(text);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const onAttach = (file: File) => {
    const url = URL.createObjectURL(file);
    setAttachments((a) => [...a, { name: file.name, url }]);
  };

  return (
    <AdminShell title="Scheme Calculator">
      <div className="space-y-6">
        {/* Header controls */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <Tabs value={scheme} onValueChange={(v) => setScheme(v as SchemeKind)}>
            <TabsList>
              <TabsTrigger value="company">Company Scheme</TabsTrigger>
              <TabsTrigger value="own">Own Scheme</TabsTrigger>
            </TabsList>
            <TabsContent value="company" className="pt-3">
              <div className="flex items-end gap-3">
                <div>
                  <Label className="text-xs">1 free for every N qty</Label>
                  <Input
                    type="number" min={1} value={companyEveryQty}
                    onChange={(e) => setCompanyEveryQty(Number(e.target.value) || 1)}
                    className="w-32"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="own" className="pt-3">
              <div className="flex items-end gap-3">
                <div>
                  <Label className="text-xs">Target margin %</Label>
                  <Input
                    type="number" min={0} value={ownTargetMargin}
                    onChange={(e) => setOwnTargetMargin(Number(e.target.value) || 0)}
                    className="w-32"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label className="text-xs">Party / Client</Label>
              <Input
                value={partyQuery || party}
                placeholder="Search party (min 2 chars)…"
                onChange={(e) => searchParties(e.target.value)}
              />
              {partyOptions.length > 0 && (
                <div className="mt-1 max-h-48 overflow-auto rounded border bg-popover shadow">
                  {loadingParties && <div className="p-2 text-xs text-muted-foreground">Loading…</div>}
                  {partyOptions.map((o) => (
                    <button
                      key={o.id}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => { setParty(o.label); setPartyQuery(o.label); setPartyOptions([]); }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Auto-fill */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Auto-fill (paste / upload)</h2>
            <div className="flex gap-2">
              <input
                ref={fileRef} type="file" className="hidden"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload
              </Button>
              <Button size="sm" onClick={() => parseText(autofill)} disabled={parsing || !autofill.trim()}>
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Extract
              </Button>
            </div>
          </div>
          <Textarea
            rows={4}
            placeholder="Paste lines like:  Sofa 3-seater  2  12500   or upload a CSV/Excel sheet"
            value={autofill}
            onChange={(e) => setAutofill(e.target.value)}
          />
        </div>

        {/* Grid */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between p-3">
            <h2 className="font-medium">Items</h2>
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4" /> Add row</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Sl</TableHead>
                  <TableHead>Item & Size</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-28">Price</TableHead>
                  <TableHead className="w-32">Amount + Tax</TableHead>
                  <TableHead className="w-28">MRP</TableHead>
                  <TableHead className="w-20">Margin %</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const mrpTotal = (Number(r.mrp) || 0) * (Number(r.qty) || 0);
                  const margin = mrpTotal > 0 ? ((mrpTotal - (Number(r.amountWithTax) || 0)) / mrpTotal) * 100 : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Input value={r.item} onChange={(e) => updateRow(r.id, { item: e.target.value })} placeholder="e.g. Sofa 3-seater 180x90" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={r.qty} onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={r.price} onChange={(e) => updateRow(r.id, { price: Number(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={r.amountWithTax} onChange={(e) => updateRow(r.id, { amountWithTax: Number(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={r.mrp} onChange={(e) => updateRow(r.id, { mrp: Number(e.target.value) || 0 })} />
                      </TableCell>
                      <TableCell className="text-sm font-medium">{margin.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-6 border-t p-3 text-sm">
            <div>Total Qty: <span className="font-semibold">{totals.totalQty}</span></div>
            <div>Total Amount: <span className="font-semibold">₹{fmt(totals.totalAmount)}</span></div>
            <div>Total MRP: <span className="font-semibold">₹{fmt(totals.totalMrp)}</span></div>
          </div>
        </div>

        {/* Notes & attachments */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Notes</h2>
            <div>
              <input
                ref={attachRef} type="file" className="hidden"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => e.target.files?.[0] && onAttach(e.target.files[0])}
              />
              <Button size="sm" variant="outline" onClick={() => attachRef.current?.click()}>
                <Paperclip className="h-4 w-4" /> Attach
              </Button>
            </div>
          </div>
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Specific window behavior, terms, etc." />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs">
                  <a href={a.url} target="_blank" rel="noreferrer" className="underline">{a.name}</a>
                  <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Free-item report */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Free Items Report</h2>
            <span className="text-xs text-muted-foreground">
              Scheme: {scheme === "company" ? "Company" : "Own"} · {period} · {party || "no party"}
            </span>
          </div>
          {freeReport.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add items to see eligibility.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-28">Free Items</TableHead>
                  <TableHead>Rule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freeReport.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell>{f.item}</TableCell>
                    <TableCell>{f.qty}</TableCell>
                    <TableCell className="font-semibold text-primary">{f.free}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-3 rounded bg-muted/50 p-3 text-sm">
            Total free items: <span className="font-semibold">{freeReport.reduce((s, f) => s + f.free, 0)}</span>
          </div>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminSchemeCalculator;