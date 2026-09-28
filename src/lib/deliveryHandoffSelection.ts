export function handoffItemEligible(
  quote: { status?: string; commercial_status?: string; document_type?: string; deleted_at?: string | null },
  item: { quantity: number; ordered_qty?: number | null; cancelled_qty?: number | null; delivered_at?: string | null },
  readiness?: { warehouse_ready?: boolean | null; order_confirmed?: boolean | null },
) {
  const confirmed = ["finalized", "delivered", "completed"].includes(quote.status ?? "") ||
    ["confirmed", "payment_pending", "closed", "delivered"].includes(quote.commercial_status ?? "");
  return confirmed && !quote.deleted_at && quote.status !== "rejected" && quote.document_type !== "po" &&
    !!readiness?.warehouse_ready && !!readiness?.order_confirmed && !item.delivered_at &&
    !(Number(item.cancelled_qty) > 0) && !(Number(item.ordered_qty) > 0 && Number(item.ordered_qty) < Number(item.quantity));
}
