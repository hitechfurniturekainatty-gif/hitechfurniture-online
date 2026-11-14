// Photo gate: a ready-stock item must have a photo before the order can be
// confirmed, so the delivery team can identify the exact piece weeks later
// without asking the salesman. Custom items are exempt at this point (the
// piece does not exist yet) — their photo is added when it reaches the shop.
import { supabase } from "@/integrations/supabase/client";

export type PhotoGateItem = {
  display_order?: number | null;
  description?: string | null;
  item_image_url?: string | null;
  catalog_image_url?: string | null;
  sketch_url?: string | null;
  fulfillment_route?: string | null;
  stock_decision?: string | null;
  quantity?: number | null;
  cancelled_qty?: number | null;
};

const has = (v?: string | null) => !!v && v.trim() !== "";
export const isCustomItem = (it: PhotoGateItem) => it.fulfillment_route === "custom" || it.stock_decision === "custom";
const isCancelled = (it: PhotoGateItem) => Number(it.quantity ?? 0) > 0 && Number(it.cancelled_qty ?? 0) >= Number(it.quantity ?? 0);

/** Pure: which rows block confirmation. `n` is the item number staff see (1-based). */
export function itemsMissingPhoto(rows: PhotoGateItem[]): { n: number; description: string }[] {
  return rows
    .map((it, index) => ({ it, n: index + 1 }))
    .filter(({ it }) => !isCancelled(it) && !isCustomItem(it))
    .filter(({ it }) => !has(it.item_image_url) && !has(it.catalog_image_url) && !has(it.sketch_url))
    .map(({ it, n }) => ({ n, description: (it.description ?? "").trim().slice(0, 60) }));
}

/** Returns a ready-to-show message when the order must not be confirmed yet, otherwise null. */
export async function photoGateMessage(quotationId: string): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from("quotation_items")
    .select("display_order, description, item_image_url, catalog_image_url, sketch_url, fulfillment_route, stock_decision, quantity, cancelled_qty")
    .eq("quotation_id", quotationId)
    .order("display_order");
  // If the check itself cannot run, never block a sale because of it.
  if (error || !data) return null;
  const missing = itemsMissingPhoto(data as PhotoGateItem[]);
  if (missing.length === 0) return null;
  const list = missing.slice(0, 5).map((m) => `Item ${m.n}${m.description ? ` (${m.description})` : ""}`).join(", ");
  return `${list}${missing.length > 5 ? ` +${missing.length - 5}` : ""} — photo ഇല്ല. Photo ചേർത്ത് save ചെയ്ത ശേഷം confirm ചെയ്യുക. ഉണ്ടാക്കിക്കേണ്ട item ആണെങ്കിൽ അത് "Custom" എന്ന് mark ചെയ്യുക.`;
}
