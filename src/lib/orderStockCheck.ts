import { supabase } from "@/integrations/supabase/client";

type Shortage = { product_name: string | null; needed: number; in_stock: number; held_by_others: number; available: number };

/**
 * Ready-stock rows that ask for more than is free: Output Books stock minus what other
 * open orders already hold. Returns a confirm() message, or null when stock is enough
 * (or the check could not run — confirming is never blocked by a failed check).
 */
export async function stockShortageMessage(quotationId: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc("quotation_stock_shortages", { p_quotation_id: quotationId });
  if (error || !Array.isArray(data) || !data.length) return null;
  const lines = (data as Shortage[]).map((s) =>
    `• ${s.product_name || "Item"}: വേണ്ടത് ${Number(s.needed)}, free stock ${Number(s.available)} (stock ${Number(s.in_stock)}, മറ്റ് orders ${Number(s.held_by_others)})`);
  return `⚠️ Ready stock മതിയാകില്ല:\n\n${lines.join("\n")}\n\nഇതേ piece മറ്റൊരു customer-നും order ആയിട്ടുണ്ടാകാം. Warehouse / Output Books-ൽ ഉറപ്പാക്കിയ ശേഷം മാത്രം confirm ചെയ്യുക.\n\nഎന്നിട്ടും confirm ചെയ്യണോ?`;
}
