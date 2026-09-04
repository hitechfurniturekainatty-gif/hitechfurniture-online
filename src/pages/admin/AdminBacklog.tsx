import { BacklogGate } from "@/components/admin/BacklogGate";
import OrderReceivablesPanel from "@/components/admin/OrderReceivablesPanel";
import AdminReceivables from "./AdminReceivables";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Hidden Backlog area. Reachable via:
 *  - Keyboard shortcut Ctrl/Cmd + Shift + B (anywhere)
 *  - Direct URL /admin/backlog (or legacy /admin/receivables)
 * Always gated by a secondary admin PIN.
 */
export default function AdminBacklog() {
  return (
    <BacklogGate>
      <div className="space-y-8">
        <section className="space-y-3">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4">
              <p className="text-sm font-semibold">Customer → Hitech Receivables</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Delivered orders with money still to receive. Use Receive Payment for full or partial collections.
              </p>
            </CardContent>
          </Card>
          <OrderReceivablesPanel />
        </section>

        <section className="border-t border-border pt-8">
          <div className="mb-3">
            <h2 className="font-display text-xl font-semibold">Manual / Busy Receivables Ledger</h2>
            <p className="text-xs text-muted-foreground">
              Legacy pasted receivables from Busy Accounting or Excel. This section remains available for older/manual balances.
            </p>
          </div>
          <AdminReceivables />
        </section>
      </div>
    </BacklogGate>
  );
}
