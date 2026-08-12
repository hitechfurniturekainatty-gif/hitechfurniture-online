import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "resolve_enquiry",
  title: "Mark enquiry resolved",
  description: "Mark a customer complaint or service request as resolved, using its complaint or service code.",
  inputSchema: {
    kind: z.enum(["complaint", "service"]).describe("Whether the code belongs to a complaint or a service request."),
    code: z.string().trim().min(1).describe("The complaint code or service code."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, code }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const table = kind === "complaint" ? "customer_complaints" : "customer_services";
    const codeColumn = kind === "complaint" ? "complaint_code" : "service_code";
    const { data, error } = await supabase
      .from(table)
      .update({ status: "resolved" })
      .eq(codeColumn, code)
      .is("deleted_at", null)
      .select("id, status");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: `No ${kind} found with code ${code}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: `${kind} ${code} marked resolved.` }],
      structuredContent: { updated: data[0] },
    };
  },
});