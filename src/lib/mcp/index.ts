import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProductsTool from "./tools/search-products";
import lowStockProductsTool from "./tools/low-stock-products";
import listQuotationsTool from "./tools/list-quotations";
import getQuotationTool from "./tools/get-quotation";
import listOpenEnquiriesTool from "./tools/list-open-enquiries";
import resolveEnquiryTool from "./tools/resolve-enquiry";

// The OAuth issuer must be the direct supabase.co host of the project that
// mints tokens. Both values are inlined by Vite at build time (import-safe).
const projectRef =
  (import.meta.env.VITE_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ??
  import.meta.env.VITE_SUPABASE_PROJECT_ID ??
  "project-ref-unset";

export default defineMcp({
  name: "my-hitech",
  title: "My Hitech",
  version: "0.1.0",
  instructions:
    "Tools for My Hitech furniture operations. Use `search_products` and `low_stock_products` for the catalog and inventory, `list_quotations` and `get_quotation` for quotations and orders, and `list_open_enquiries` / `resolve_enquiry` for customer complaints and service requests. All tools act as the signed-in staff user and respect their permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchProductsTool,
    lowStockProductsTool,
    listQuotationsTool,
    getQuotationTool,
    listOpenEnquiriesTool,
    resolveEnquiryTool,
  ],
});