export const leadSourceLabel = (source?: string | null) => ({
  website: "Website · Customer enquiry", manual: "Manual · Staff entry",
  whatsapp: "WhatsApp enquiry", other: "Other source",
}[source ?? ""] ?? "Source not recorded");
export const leadCreatorLabel = (source: string | null, creator: string | null, names: Record<string, string>) =>
  creator ? (names[creator] || "Staff name unavailable") : source === "website" ? "Customer · Website form" : "Not recorded";
