import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { parseDebtorSheets, planRefresh, type ExistingReceivable, type ParsedDebtors, type RefreshPlan } from "@/lib/busyDebtorExcel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));
const CHUNK = 200;
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const chunks = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / CHUNK) }, (_, i) => a.slice(i * CHUNK, (i + 1) * CHUNK));

async function fetchExisting(): Promise<ExistingReceivable[]> {
  const out: ExistingReceivable[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("receivables")
      .select("id, account_key, phone, salesman, closed_at")
      .not("account_key", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) out.push({ id: r.id, key: r.account_key, phone: r.phone, salesman: r.salesman, closed: !!r.closed_at });
    if ((data?.length ?? 0) < 1000) break;
  }
  return out;
}

export default function BusyExcelRefreshCard({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedDebtors | null>(null);
  const [plan, setPlan] = useState<RefreshPlan | null>(null);
  const [existingOpen, setExistingOpen] = useState(0);
  const [working, setWorking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reset = () => { setParsed(null); setPlan(null); setFileName(""); if (input.current) input.current.value = ""; };

  const onFile = async (file?: File) => {
    if (!file) return;
    setWorking(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheets = wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "" }) }));
      const p = parseDebtorSheets(sheets);
      const existing = await fetchExisting();
      setFileName(file.name);
      setParsed(p);
      setExistingOpen(existing.filter((e) => !e.closed).length);
      setPlan(planRefresh(existing, p.rows));
    } catch (e: unknown) {
      reset();
      toast({ title: "Could not read the Excel file", description: msg(e), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  const apply = async () => {
    if (!plan) return;
    setConfirmOpen(false);
    setWorking(true);
    try {
      const now = new Date().toISOString();
      const { data: auth } = await supabase.auth.getUser();
      const { data: last } = await db.from("receivables").select("batch").eq("source", "manual").order("batch", { ascending: false }).limit(1);
      const batch = ((last?.[0]?.batch as number | undefined) ?? 0) + 1;

      for (const part of chunks(plan.inserts)) {
        const { error } = await db.from("receivables").upsert(
          part.map((r) => ({ account_key: r.key, customer_name: r.customer, phone: r.phone, salesman: r.salesman, pending_amount: r.balance, original_amount: r.balance, source: "manual", raw_text: "Busy Excel refresh", batch, last_upload_at: now })),
          { onConflict: "account_key" },
        );
        if (error) throw error;
      }
      for (const part of chunks(plan.updates)) {
        const { error } = await db.from("receivables").upsert(
          part.map((r) => ({ account_key: r.key, customer_name: r.customer, phone: r.phone, salesman: r.salesman, pending_amount: r.balance, closed_at: null, closed_by: null, source: "manual", last_upload_at: now })),
          { onConflict: "account_key" },
        );
        if (error) throw error;
      }
      for (const part of chunks(plan.closeIds)) {
        const { error } = await db.from("receivables").update({ pending_amount: 0, closed_at: now, closed_by: auth.user?.id ?? null, last_upload_at: now }).in("id", part);
        if (error) throw error;
      }
      toast({ title: "Balances refreshed", description: `${plan.inserts.length} new · ${plan.updates.length} updated · ${plan.closeIds.length} closed` });
      reset();
      onDone();
    } catch (e: unknown) {
      toast({ title: "Refresh stopped part-way", description: `${msg(e)}. Upload the same file again to finish; already-saved rows are safe.`, variant: "destructive" });
      onDone();
    } finally {
      setWorking(false);
    }
  };

  const bigDrop = !!plan && plan.closedBecauseMissing > Math.max(20, existingOpen * 0.3);

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="h-4 w-4" /> Refresh balances from Busy Excel</CardTitle>
        <p className="text-xs text-muted-foreground">Upload the Busy debtors Excel (Account, Balance; Sales Man and Mobile No. if you have them). Balances are replaced with the file. Customers are never deleted, so call notes, promise dates and payments stay. A customer who is no longer in the file, or is at zero, is closed.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" className="gap-2" disabled={working} onClick={() => input.current?.click()}>
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Choose Excel file
          </Button>
          {fileName && <span className="text-xs text-muted-foreground">{fileName} · sheet “{parsed?.sheetName}”</span>}
        </div>

        {plan && parsed && (
          <div className="space-y-3 rounded-lg border bg-background p-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Customers with balance</p><p className="text-lg font-semibold">{plan.inserts.length + plan.updates.length}</p></div>
              <div><p className="text-xs text-muted-foreground">Total balance</p><p className="text-lg font-semibold">{money(plan.totalBalance)}</p></div>
              <div><p className="text-xs text-muted-foreground">New / updated</p><p className="text-lg font-semibold">{plan.inserts.length} / {plan.updates.length}</p></div>
              <div><p className="text-xs text-muted-foreground">Will be closed</p><p className="text-lg font-semibold">{plan.closeIds.length}</p></div>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>{plan.withoutPhone} without a mobile number (no WhatsApp/call) · {plan.withoutSalesman} without a salesman</li>
              {parsed.duplicates > 0 && <li>{parsed.duplicates} account(s) appeared twice; the last row was used.</li>}
              {parsed.skipped > 0 && <li>{parsed.skipped} row(s) skipped: balance could not be read.</li>}
              <li>Closed: {plan.closedBecauseZero} at zero balance · {plan.closedBecauseMissing} not in this file.</li>
            </ul>
            {bigDrop && (
              <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {plan.closedBecauseMissing} open customers are missing from this file ({existingOpen} are open now). Check this is the full debtors list before applying.
              </p>
            )}
            <div className="flex gap-2">
              <Button disabled={working} onClick={() => setConfirmOpen(true)}>Apply refresh</Button>
              <Button variant="outline" disabled={working} onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this refresh?</AlertDialogTitle>
            <AlertDialogDescription>
              {plan?.inserts.length} new and {plan?.updates.length} existing customers get the balance from the file. {plan?.closeIds.length} customers will be closed. Nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
