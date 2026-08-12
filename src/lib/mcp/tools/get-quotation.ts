import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_quotation",
  title: "Get quotation",
  description: "Fetch one quotation with its line items, using its human-readable quotation code (e.g. QT-1024).",
  inputSchema: {
    quotation_code: z.string().trim().min(1).describe("The quotation code shown on the document."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ quotation_code }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: quotation, error } = await supabase
      .from("quotations")
      .select("*")
      .eq("quotation_id", quotation_code)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!quotation) {
      return { content: [{ type: "text", text: `No quotation found with code ${quotation_code}` }], isError: true };
    }
    const { data: items, error: itemsError } = await supabase
      .from("quotation_items")
      .select("id, description, quantity, unit_price, amount, measurement, fulfillment_route, display_order")
      .eq("quotation_id", quotation.id)
      .order("display_order");
    if (itemsError) return { content: [{ type: "text", text: itemsError.message }], isError: true };
    const payload = { quotation, items: items ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});