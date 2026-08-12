import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "low_stock_products",
  title: "Low stock products",
  description: "List catalog products whose stock quantity is at or below their reorder level.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of products to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("products")
      .select("id, product_code, product_name, stock_quantity, reorder_level, stock_status")
      .is("deleted_at", null)
      .order("stock_quantity")
      .limit(500);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const low = (data ?? [])
      .filter((p) => Number(p.stock_quantity ?? 0) <= Number(p.reorder_level ?? 0))
      .slice(0, limit ?? 25);
    return {
      content: [{ type: "text", text: JSON.stringify(low, null, 2) }],
      structuredContent: { products: low, count: low.length },
    };
  },
});