import { supabase } from "@/integrations/supabase/client";

export type StockMap = { main: Record<string, number>; sub: Record<string, number> };

/** Categories / sub-categories that have at least one in-stock item. */
export async function fetchCategoriesInStock(): Promise<StockMap> {
  const { data, error } = await (supabase as any).rpc("categories_in_stock");
  if (error) throw error;
  const main: Record<string, number> = {}, sub: Record<string, number> = {};
  for (const r of (data ?? []) as { main_category_id: string | null; sub_category_id: string | null; in_stock: number }[]) {
    const n = Number(r.in_stock) || 0;
    if (r.main_category_id) main[r.main_category_id] = (main[r.main_category_id] ?? 0) + n;
    if (r.sub_category_id) sub[r.sub_category_id] = (sub[r.sub_category_id] ?? 0) + n;
  }
  return { main, sub };
}
