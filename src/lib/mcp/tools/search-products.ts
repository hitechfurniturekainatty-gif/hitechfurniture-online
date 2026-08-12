import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description: "Search the furniture catalog by name or product code and return pricing and stock details.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Product name or code to search for."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of products to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("products")
      .select("id, product_code, product_name, material, dimensions, mrp, offer_price, stock_quantity, stock_status, reorder_level, is_published")
      .is("deleted_at", null)
      .or(`product_name.ilike.%${query}%,product_code.ilike.%${query}%`)
      .order("product_name")
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { products: data ?? [] },
    };
  },
});