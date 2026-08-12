import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_quotations",
  title: "List quotations",
  description: "List recent quotations and orders, optionally filtered by pipeline stage, status, or customer name.",
  inputSchema: {
    stage: z.number().int().min(1).max(6).optional().describe("Pipeline stage 1-6 to filter by."),
    status: z.string().trim().min(1).optional().describe("Status filter, e.g. draft, finalized, delivered."),
    party: z.string().trim().min(1).optional().describe("Customer/party name to search for."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ stage, status, party, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("quotations")
      .select(
        "id, quotation_id, party_name, party_place, party_phone, status, pipeline_stage, document_type, lead_type, total, advance_amount, quotation_date, expected_delivery_date, created_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (stage) q = q.eq("pipeline_stage", stage);
    if (status) q = q.eq("status", status);
    if (party) q = q.ilike("party_name", `%${party}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { quotations: data ?? [] },
    };
  },
});