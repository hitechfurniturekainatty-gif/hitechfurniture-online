import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { openWhatsAppApp } from "@/lib/whatsapp";
import { Phone, MessageCircle, Trash2, ShieldAlert, Loader2, Sparkles } from "lucide-react";

/**
 * Admin-only Accounts Receivable parser for Busy Accounting paste-ins.
 * Data is held in component state ONLY — never sent to the database, never
 * written to localStorage. Refresh = clean slate. This satisfies the
 * "Strictly Admin-Only" requirement without any new RLS surface.
 *
 * Expected row format (whitespace/tabs/symbols tolerated):
 *   [Bill/Quotation No]  [Customer Name]  [Place]  [Pending Amount]  [10-digit Phone]
 *
 * Heuristic: phone = last 10-digit run in the line. Amount = last numeric
 * token before the phone (commas/decimals allowed). Bill no = first token.
 * Everything in between = customer name + place (split on the last single
 * word if a clear gap exists, otherwise place is left blank).
 */

type ParsedRow = {
  id: string;
  batch: number;
  billNo: string;
  customer: string;
  place: string;
  amount: number | null;
  amountRaw: string;
  phone: string;
  raw: string;
};

const PHONE_RE = /(\d{10})(?!\d)/g;
const AMOUNT_RE = /-?\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

function cleanLine(line: string) {
  return line
    .replace(/\u00A0/g, " ") // nbsp
    .replace(/[\t\r]+/g, " ")
    .replace(/[|;]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractPhone(line: string): { phone: string; rest: string } {
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(line)) !== null) lastMatch = m;
  if (!lastMatch) return { phone: "", rest: line };
  const phone = lastMatch[1];
  const rest = (line.slice(0, lastMatch.index) + line.slice(lastMatch.index + phone.length)).trim();
  return { phone, rest };
}

function extractAmount(rest: string): { amount: number | null; amountRaw: string; rest: string } {
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(rest)) !== null) {
    // skip pure 1-2 digit tokens that look like serial numbers in the middle
    const t = m[0].replace(/[,\s]/g, "");
    if (t.length >= 2 || t.includes(".")) lastMatch = m;
  }
  if (!lastMatch) return { amount: null, amountRaw: "", rest };
  const raw = lastMatch[0];
  const numeric = parseFloat(raw.replace(/[,\s]/g, ""));
  const stripped = (rest.slice(0, lastMatch.index) + rest.slice(lastMatch.index + raw.length)).trim().replace(/\s{2,}/g, " ");
  return { amount: Number.isFinite(numeric) ? numeric : null, amountRaw: raw.trim(), rest: stripped };
}

function splitCustomerPlace(rest: string): { billNo: string; customer: string; place: string } {
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { billNo: "", customer: "", place: "" };
  const billNo = tokens.shift() ?? "";
  if (tokens.length === 0) return { billNo, customer: "", place: "" };
  if (tokens.length === 1) return { billNo, customer: tokens[0], place: "" };
  // Heuristic: last token is the place, everything else is the customer name.
  const place = tokens.pop() as string;
  const customer = tokens.join(" ");
  return { billNo, customer, place };
}

function parseText(text: string, batch: number): ParsedRow[] {
  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => l.length > 0)
    .map((raw, i) => {
      const { phone, rest: r1 } = extractPhone(raw);
      const { amount, amountRaw, rest: r2 } = extractAmount(r1);
      const { billNo, customer, place } = splitCustomerPlace(r2);
      return {
        id: `${batch}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        batch,
        billNo,
        customer,
        place,
        amount,
        amountRaw,
        phone,
        raw,
      };
    });
}

const fmtAmount = (n: number | null, raw: string) => {
  if (n == null) return raw || "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
};

export default function AdminReceivables() {
  const { isAdmin, loading } = useAuth();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [batchCount, setBatchCount] = useState(0);

  const total = useMemo(
    () => rows.reduce((s, r) => s + (r.amount ?? 0), 0),
    [rows],
  );

  if (loading) {
    return (
      <AdminShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  if (!isAdmin) {
    return (
      <AdminShell>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Admin only
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The Accounts Receivable parser is restricted to admin accounts.
          </CardContent>
        </Card>
      </AdminShell>
    );
  }

  const handleProcess = () => {
    if (!text.trim()) {
      toast({ title: "Nothing to parse", description: "Paste rows from Busy first." });
      return;
    }
    const nextBatch = batchCount + 1;
    const parsed = parseText(text, nextBatch);
    if (parsed.length === 0) {
      toast({ title: "No rows detected", variant: "destructive" });
      return;
    }
    // FIFO: oldest batch first, newest appended at the end.
    setRows((prev) => [...prev, ...parsed]);
    setBatchCount(nextBatch);
    setText("");
    toast({
      title: `Batch ${nextBatch} processed`,
      description: `${parsed.length} row${parsed.length === 1 ? "" : "s"} added.`,
    });
  };

  const handleClearAll = () => {
    if (rows.length === 0) return;
    if (!confirm("Clear all parsed rows? This cannot be undone.")) return;
    setRows([]);
    setBatchCount(0);
  };

  const handleRemoveRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const handleCall = (phone: string) => {
    if (!phone) return;
    window.location.href = `tel:+91${phone}`;
  };

  const handleWhatsApp = (phone: string, customer: string, amount: string) => {
    if (!phone) return;
    const greeting = customer ? `Hello ${customer}` : "Hello sir/madam";
    const msg = `${greeting}, this is Hitech Furniture. Your remaining balance is ${amount}. Please settle it at your earliest convenience. Thank you!`;
    openWhatsAppApp(`91${phone}`, msg);
  };

  return (
    <AdminShell>
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Accounts Receivable</h1>
            <p className="text-sm text-muted-foreground">
              Paste rows directly from Busy Accounting. Data stays in this session only — refresh clears it.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <ShieldAlert className="h-3.5 w-3.5" /> Admin-only · Session data
          </Badge>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Paste data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste rows here, one per line. Example:\nQ-2025-001    Rahul Kumar    Kalpetta    12,500.00    9876543210`}
              className="min-h-[140px] font-mono text-sm"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Order: <span className="font-medium">Bill No → Customer → Place → Amount → 10-digit Phone</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setText("")} disabled={!text}>Clear input</Button>
                <Button onClick={handleProcess} className="gap-2">
                  <Sparkles className="h-4 w-4" /> Process Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">Parsed receivables</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {rows.length} row{rows.length === 1 ? "" : "s"} across {batchCount} batch{batchCount === 1 ? "" : "es"} ·
                Pending total: <span className="font-semibold text-foreground">{fmtAmount(total, "")}</span>
              </p>
            </div>
            {rows.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="gap-1 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Clear all
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {rows.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No data yet. Paste from Busy and click <span className="font-medium">Process Data</span>.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-16">Batch</TableHead>
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
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">B{r.batch}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.billNo || "—"}</TableCell>
                        <TableCell className="font-medium">{r.customer || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{r.place || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {fmtAmount(r.amount, r.amountRaw)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.phone || <span className="text-destructive">missing</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="default"
                              className="h-9 w-9 bg-primary hover:bg-primary/90"
                              disabled={!r.phone}
                              onClick={() => handleCall(r.phone)}
                              aria-label={`Call ${r.customer}`}
                              title="Call (mobile dialer)"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 text-emerald-600 hover:text-emerald-700"
                              disabled={!r.phone}
                              onClick={() => handleWhatsApp(r.phone, r.customer, fmtAmount(r.amount, r.amountRaw))}
                              aria-label={`WhatsApp ${r.customer}`}
                              title="WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveRow(r.id)}
                              aria-label="Remove row"
                              title="Remove row"
                            >
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
    </AdminShell>
  );
}