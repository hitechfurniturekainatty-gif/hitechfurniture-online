import type { VendorMonth } from "./types";
import { monthRows, type PeriodBenefitRecord } from "./periodBenefits";
import { allAttributedReceipts, attributedBalances, attributedSummary, refLabel } from "./schemeAttribution";
import { fmt } from "./utils";

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
  const total = attributedSummary(months, records, fy, FY_MONTHS);
  const balances = attributedBalances(months, records).filter((b) => b.ref.fy === fy);
  const receipts = allAttributedReceipts(months, records);

  const directMarginPct = total.mrp > 0 ? (total.base / total.mrp) * 100 : null;
  const free = balances.filter((b) => b.unit !== "₹");
  const cash = balances.filter((b) => b.unit === "₹");

  const freeEarned = free.reduce((s, b) => s + (Number(b.eligible) || 0), 0);
  const freeReceived = free.reduce((s, b) => s + (Number(b.received) || 0), 0);
  const freePending = free.reduce((s, b) => s + (Number(b.pending) || 0), 0);
  const cashEarned = cash.reduce((s, b) => s + (Number(b.eligible) || 0), 0);
  const cashReceived = cash.reduce((s, b) => s + (Number(b.received) || 0), 0);
  const cashPending = cash.reduce((s, b) => s + (Number(b.pending) || 0), 0);

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

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold">FY {fy}–{String(fy + 1).slice(-2)} · Total Conclusion</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Purchase + company scheme target + achieved + actually received + pending, എല്ലാം ഒരേ സ്ഥലത്ത്.
          Benefit അടുത്ത financial year-ൽ കിട്ടിയാലും original scheme FY-ലേക്ക് link ചെയ്താണ് കണക്ക്.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {[
          ["Purchase / Landing", money(total.cost)],
          ["Purchase Qty", purchaseQty.toLocaleString("en-IN")],
          ["Total MRP", money(total.mrp)],
          ["Direct Margin", directMarginPct === null ? "—" : `${directMarginPct.toFixed(2)}%`],
          ["Scheme Received Value", money(total.extra)],
          ["Effective Margin", total.percent === null ? "—" : `${total.percent.toFixed(2)}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Free items · Earned / Received / Pending</p>
          <p className="mt-1 text-lg font-semibold">{freeEarned} / {freeReceived} / {freePending}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Cash / Credit schemes · Earned / Received / Pending</p>
          <p className="mt-1 text-lg font-semibold">{money(cashEarned)} / {money(cashReceived)} / {money(cashPending)}</p>
        </div>
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Previous-FY benefits received in this FY</p>
          <p className="mt-1 text-lg font-semibold">{money(previousFyReceivedValue)}</p>
          <p className="text-[11px] text-muted-foreground">{previousFyReceived.length} receipt(s), not double-counted in current-FY scheme benefit.</p>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="border-b bg-muted/20 px-3 py-2">
          <p className="text-sm font-semibold">Company Scheme Check · Target → Achieved → Received → Pending</p>
        </div>
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No configured scheme targets for this FY.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b">
                  {["Period", "Scheme / Reward", "Purchase", "Target", "Achieved", "Received", "Pending", "Status"].map((h) => (
                    <th key={h} className="p-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const target = Number(b.target) || 0;
                  const purchased = Number(b.purchased) || 0;
                  const achieved = Number(b.eligible) || 0;
                  const received = Number(b.received) || 0;
                  const pending = Number(b.pending) || 0;
                  const format = (v: number) => b.unit === "₹" ? money(v) : `${v} pcs`;
                  const status = achieved <= 0
                    ? (target > 0 && purchased < target ? "Not achieved" : "No benefit yet")
                    : pending > 0 ? "Pending from company" : "Received";
                  return (
                    <tr key={`${b.ref.fy}-${b.ref.type}-${b.ref.key}-${b.key}`} className="border-b last:border-0">
                      <td className="p-2 whitespace-nowrap">{refLabel(b.ref)}</td>
                      <td className="p-2 font-medium">{b.label}</td>
                      <td className="p-2">{purchased ? `${purchased} pcs` : "—"}</td>
                      <td className="p-2">{target ? `${target} pcs` : "—"}</td>
                      <td className="p-2">{format(achieved)}</td>
                      <td className="p-2">{format(received)}</td>
                      <td className="p-2 font-semibold">{format(pending)}</td>
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
        Free goods-ന്റെ pending quantity value estimate ചെയ്യാൻ system guess ചെയ്യില്ല. Received free item-ന് unit value നൽകിയാൽ മാത്രമാണ് അത് rupee benefit-ൽ വരുന്നത്.
      </p>
    </section>
  );
}
