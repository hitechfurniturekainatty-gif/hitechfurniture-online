// Shared, pure helpers for supplier orders, the rate card estimator and the reorder
// suggestion. Kept free of Supabase so they can be unit-tested.

export type SupplierOrderStatus = "ordered" | "received" | "cancelled";

/** Whole days between two YYYY-MM-DD keys (b - a). */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export type Lateness = { kind: "late" | "due_soon" | "on_time" | "closed"; days: number; label: string };

/** How an open order stands against today (both YYYY-MM-DD, India date). */
export function lateness(status: SupplierOrderStatus, expectedOn: string, today: string): Lateness {
  if (status !== "ordered") return { kind: "closed", days: 0, label: status === "received" ? "Received" : "Cancelled" };
  const d = daysBetween(today, expectedOn);
  if (d < 0) return { kind: "late", days: -d, label: `${-d} day${d === -1 ? "" : "s"} late` };
  if (d <= 3) return { kind: "due_soon", days: d, label: d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}` };
  return { kind: "on_time", days: d, label: `Due in ${d} days` };
}

/** Add days to a YYYY-MM-DD key. */
export const addDays = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export type RateUnit = "sqft" | "rft" | "piece" | "seat" | "set";
export const UNIT_LABEL: Record<RateUnit, string> = {
  sqft: "per sq ft", rft: "per running ft", piece: "per piece", seat: "per seat", set: "per set",
};

/** The quantity a rate multiplies: area for sq ft, length for running ft, else count. */
export function measureFor(unit: RateUnit, widthFt: number, heightFt: number, lengthFt: number, count: number): number {
  const n = Math.max(0, count || 0);
  if (unit === "sqft") return Math.max(0, widthFt || 0) * Math.max(0, heightFt || 0) * n;
  if (unit === "rft") return Math.max(0, lengthFt || 0) * n;
  return n;
}

/** Rounded rupee estimate for one rate. */
export const estimate = (rate: number, measure: number) => Math.round(Math.max(0, rate) * Math.max(0, measure));

/** Lowest and highest estimate across suppliers, or null when nothing to compare. */
export function estimateRange(rates: number[], measure: number): { low: number; high: number } | null {
  const vals = rates.filter((r) => r > 0).map((r) => estimate(r, measure)).filter((v) => v > 0);
  if (!vals.length) return null;
  return { low: Math.min(...vals), high: Math.max(...vals) };
}

/**
 * Suggested quantity to buy. Target = the reorder level, or one month of recent sales
 * (90-day sales / 3) when that is higher. Stock already on order from a supplier counts,
 * so the same item is not bought twice.
 */
export function suggestedOrder(available: number, reorderLevel: number, sold90d: number, onOrder: number): number {
  const target = Math.max(reorderLevel, Math.ceil(Math.max(0, sold90d) / 3));
  return Math.max(0, Math.ceil(target - Math.max(0, available) - Math.max(0, onOrder)));
}
