import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_open_enquiries",
  title: "List open enquiries",
  description: "List unresolved customer complaints and service/repair requests from the enquiries inbox.",
  inputSchema: {
    kind: z.enum(["all", "complaint", "service"]).default("all").describe("Which enquiry type to list."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum rows per type."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const want = kind ?? "all";
    const cap = limit ?? 20;
    const result: Record<string, unknown> = {};

    if (want === "all" || want === "complaint") {
      const { data, error } = await supabase
        .from("customer_complaints")
        .select("id, complaint_code, customer_name, customer_phone, customer_place, issue_description, status, created_at")
        .is("deleted_at", null)
        .not("status", "in", "(resolved,closed,cancelled)")
        .order("created_at", { ascending: false })
        .limit(cap);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      result.complaints = data ?? [];
    }
    if (want === "all" || want === "service") {
      const { data, error } = await supabase
        .from("customer_services")
        .select("id, service_code, customer_name, customer_phone, customer_place, item_description, work_needed, estimated_cost, status, created_at")
        .is("deleted_at", null)
        .not("status", "in", "(resolved,closed,cancelled)")
        .order("created_at", { ascending: false })
        .limit(cap);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      result.services = data ?? [];
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});