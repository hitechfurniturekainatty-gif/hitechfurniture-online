import { useEffect, useState } from "react";
import type { VendorMonth } from "./types";
import { monthRows, type PeriodBenefitRecord } from "./periodBenefits";
import { allAttributedReceipts, attributedBalances, attributedSummary, refLabel } from "./schemeAttribution";
import { auditSchemeFy } from "./accountingAudit";
import { fmt } from "./utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const FY_MONTHS = [4,5,6,7,8,9,10,11,12,1,2,3];

const receiptFy = (month: string) => {
  const [year, mm] = month.split("-").map(Number);
  return mm >= 4 ? year : year - 1;
};

const money = (n: number) => `₹${fmt(n)}`;

export function SchemeReconciliation({
  months,
  records,
  fy,
}: {
  months: VendorMonth[];
  records: PeriodBenefitRecord[];
  fy: number;
}) {
  const fyMonths = months.filter((m) => m.fy_year === fy);
  const partyId = fyMonths[0]?.party_id || months.find((m) => m.party_id)?.party_id || "";
  const [closure, setClosure] = useState<any>(null);
  const [closing, setClosing] = useState(false);
  const total = attributedSummary(months, records, fy, FY_MONTHS);
  const balances = attributedBalances(months, records).filter((b) => b.ref.fy === fy);
  const receipts = allAttributedReceipts(months, records);
  const audit = auditSchemeFy(months, records, fy);

  const directMarginPct = total.mrp > 0 ? (total.base / total.mrp) * 100 : null;
  const marginFinal = audit.missingMrpRows === 0 && audit.unvaluedFreeReceipts === 0;
  const free = balances.filter((b) => b.unit !== "₹");
  const cash = balances.filter((b) => b.unit === "₹");

  const freeEligible = free.reduce((s, b) => s + (Number(b.eligible) || 0), 0);
  const freeReceived = free.reduce((s, b) => s + (Number(b.received) || 0), 0);
  const freePending = free.reduce((s, b) => s + (Number(b.pending) || 0), 0);
  const cashEligible = cash.reduce((s, b) => s + (Number(b.eligible) || 0), 0);
  const cashReceived = cash.reduce((s, b) => s + (Number(b.received) || 0), 0);
  const cashPending = cash.reduce((s, b) => s + (Number(b.pending) || 0), 0);

  const fyReceipts = receipts.filter((r) => r.source.fy === fy);
  const creditNotes = fyReceipts.filter((r) => r.kind === "credit_note");
  const freeGoods = fyReceipts.filter((r) => r.kind === "free_item");
  const creditNoteValue = creditNotes.reduce((s, r) => s + Math.max(0, r.net), 0);
  const freeGoodsValue = freeGoods.reduce((s, r) => s + Math.max(0, r.net), 0);
  const creditSettledQty = creditNotes.reduce((s, r) => s + Math.max(0, Number(r.replaces_free_qty) || 0), 0);

  const previousFyReceived = receipts.filter(
    (r) => r.source.fy < fy && receiptFy(r.received_month) === fy,
  );
  const previousFyReceivedValue = previousFyReceived.reduce((s, r) => s + r.net, 0);

  const purchaseQty = fyMonths
    .flatMap((m) => monthRows(m))
    .filter((r) => !r.reward)
    .reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const rows = balances
    .slice()
    .sort((a, b) => refLabel(a.ref).localeCompare(refLabel(b.ref)));

  useEffect(() => {
    let cancelled = false;
    if (!partyId) { setClosure(null); return; }
    (async () => {
      const { data, error } = await (supabase as any)
        .from("scheme_fy_closures")
        .select("*")
        .eq("party_id", partyId)
        .eq("fy_year", fy)
        .maybeSingle();
      if (!cancelled) {
        if (error) setClosure(null);
        else setClosure(data || null);
      }
    })();
    return () => { cancelled = true; };
  }, [partyId, fy]);

  const closeFy = async () => {
    if (!partyId || audit.criticalIssues > 0 || closing) return;
    setClosing(true);
    const payload = {
      party_id: partyId,
      fy_year: fy,
      status: audit.pendingFreeQty > 0 || audit.pendingCashValue > 0 ? "closed_with_pending" : "closed",
      closed_at: new Date().toISOString(),
      audit_snapshot: audit,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (supabase as any)
      .from("scheme_fy_closures")
      .upsert(payload, { onConflict: "party_id,fy_year" })
      .select()
      .single();
    setClosing(false);
    if (error) {
      toast({ title: "FY close failed", description: error.message, variant: "destructive" });
      return;
    }
    setClosure(data);
    toast({ title: "Financial year closed", description: payload.status === "closed_with_pending" ? "Vendor pending benefits remain tracked." : "Reconciliation checks passed." });
  };

  const reopenFy = async () => {
    if (!closure || closing) return;
    setClosing(true);
    const { error } = await (supabase as any).from("scheme_fy_closures").delete().eq("id", closure.id);
    setClosing(false);
    if (error) {
      toast({ title: "Could not reopen FY", description: error.message, variant: "destructive" });
      return;
    }
    setClosure(null);
    toast({ title: "Financial year reopened" });
  };

  const statusLabel =
    audit.status === "reconciled" ? "FY Reconciled" :
    audit.status === "reconciled_pending" ? "Reconciled · Vendor benefit pending" :
    "Needs attention before FY close";

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">FY {fy}–{String(fy + 1).slice(-2)} · Total Conclusion</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Purchase + company scheme eligibility + actually received + pending, എല്ലാം ഒരേ reconciliation view-ൽ.
            Benefit അടുത്ത FY-ൽ കിട്ടിയാലും original scheme FY-ലേക്ക് link ചെയ്താണ് കണക്ക്.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            closure ? "bg-slate-900 text-white" :
            audit.status === "reconciled" ? "bg-emerald-100 text-emerald-800" :
            audit.status === "reconciled_pending" ? "bg-amber-100 text-amber-800" :
            "bg-destructive/10 text-destructive"
          }`}>{closure ? (closure.status === "closed_with_pending" ? "FY Closed · Vendor pending tracked" : "FY Closed") : statusLabel}</span>
          {closure ? (
            <Button size="sm" variant="outline" onClick={reopenFy} disabled={closing}>Reopen FY</Button>
          ) : (
            <Button size="sm" onClick={closeFy} disabled={audit.criticalIssues > 0 || closing}>
              {closing ? "Closing…" : "Close FY"}
            </Button>
          )}
        </div>
      </div>

      {audit.criticalIssues > 0 && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
        <b>Accounting checks pending:</b>{" "}
        {audit.missingMrpRows > 0 && <span>{audit.missingMrpRows} purchase row(s) missing MRP (cost {money(audit.missingMrpCost)}). </span>}
        {audit.missingInvoiceDates > 0 && <span>{audit.missingInvoiceDates} invoice date(s) missing. </span>}
        {audit.invoiceDateMismatches > 0 && <span>{audit.invoiceDateMismatches} invoice date/month mismatch. </span>}
        {audit.missingReceiptDates > 0 && <span>{audit.missingReceiptDates} benefit receipt date(s) missing. </span>}
        {audit.missingReceiptReferences > 0 && <span>{audit.missingReceiptReferences} benefit reference(s) missing. </span>}
        {audit.duplicateReceiptReferences > 0 && <span>{audit.duplicateReceiptReferences} duplicate benefit reference(s). </span>}
        {audit.unlinkedReceipts > 0 && <span>{audit.unlinkedReceipts} benefit receipt(s) not linked to a scheme period. </span>}
        {audit.unvaluedFreeReceipts > 0 && <span>{audit.unvaluedFreeReceipts} free-item receipt(s) missing value. </span>}
      </div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {[
          ["Purchase / Landing", money(total.cost)],
          ["Purchase Qty", purchaseQty.toLocaleString("en-IN")],
          ["Total MRP", audit.missingMrpRows ? `${money(total.mrp)} · partial` : money(total.mrp)],
          ["Direct Margin", marginFinal && directMarginPct !== null ? `${directMarginPct.toFixed(2)}%` : "Provisional"],
          ["Scheme Received Value", money(total.extra)],
          ["Effective Margin", marginFinal && total.percent !== null ? `${total.percent.toFixed(2)}%` : "Provisional"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Free items · Eligible / Received / Pending</p>
          <p className="mt-1 text-lg font-semibold">{freeEligible} / {freeReceived} / {freePending}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Cash schemes · Eligible / Received / Pending</p>
          <p className="mt-1 text-lg font-semibold">{money(cashEligible)} / {money(cashReceived)} / {money(cashPending)}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Free goods received value</p>
          <p className="mt-1 text-lg font-semibold">{money(freeGoodsValue)}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Credit notes received</p>
          <p className="mt-1 text-lg font-semibold">{money(creditNoteValue)}</p>
          <p className="text-[11px] text-muted-foreground">{creditSettledQty} free unit(s) settled by credit note</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Previous-FY benefits received in this FY</p>
          <p className="mt-1 text-lg font-semibold">{money(previousFyReceivedValue)}</p>
          <p className="text-[11px] text-muted-foreground">{previousFyReceived.length} receipt(s), excluded from current-FY earned benefit.</p>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="border-b bg-muted/20 px-3 py-2">
          <p className="text-sm font-semibold">Company Scheme Check · Purchase → Required Target → Eligible Benefit → Received → Pending</p>
        </div>
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No configured scheme targets for this FY.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead>
                <tr className="border-b">
                  {["Period", "Scheme / Reward", "Qualifying Purchase", "Required Target", "Eligible Benefit", "Received Benefit", "Pending Benefit", "Status"].map((h) => (
                    <th key={h} className="p-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const target = Number(b.target) || 0;
                  const purchased = Number(b.purchased) || 0;
                  const eligible = Number(b.eligible) || 0;
                  const received = Number(b.received) || 0;
                  const pending = Number(b.pending) || 0;
                  const formatBenefit = (v: number) => b.unit === "₹" ? money(v) : `${v} pcs`;
                  const formatTarget = (v: number) => b.unit === "₹" ? money(v) : `${v} pcs`;
                  const status = eligible <= 0
                    ? (target > 0 && purchased < target ? "Not achieved" : "No benefit yet")
                    : pending > 0 ? "Pending from company" : "Received";
                  return (
                    <tr key={`${b.ref.fy}-${b.ref.type}-${b.ref.key}-${b.key}`} className="border-b last:border-0">
                      <td className="p-2 whitespace-nowrap">{refLabel(b.ref)}</td>
                      <td className="p-2 font-medium">{b.label}</td>
                      <td className="p-2">{purchased ? formatTarget(purchased) : "—"}</td>
                      <td className="p-2">{target ? formatTarget(target) : "—"}</td>
                      <td className="p-2">{formatBenefit(eligible)}</td>
                      <td className="p-2">{formatBenefit(received)}</td>
                      <td className="p-2 font-semibold">{formatBenefit(pending)}</td>
                      <td className="p-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${status === "Received" ? "bg-emerald-100 text-emerald-800" : status === "Pending from company" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Final margin % only appears when purchase MRP is complete and free goods have a value. Pending vendor benefits can remain open without changing their original scheme FY.
      </p>
    </section>
  );
}
