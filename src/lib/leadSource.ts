export const leadSourceLabel = (source?: string | null) => ({
  website: "Website · Customer enquiry", manual: "Manual · Staff entry",
  whatsapp: "WhatsApp enquiry", other: "Other source",
  instagram: "Instagram DM", facebook: "Facebook message", walkin: "Showroom walk-in",
  phone: "Phone call", google: "Google (Maps / Search)", referral: "Referral · Customer told",
}[source ?? ""] ?? "Source not recorded");
export const leadCreatorLabel = (source: string | null, creator: string | null, names: Record<string, string>) =>
  creator ? (names[creator] || "Staff name unavailable") : source === "website" ? "Customer · Website form" : "Not recorded";
export const LEAD_SOURCES = ["website","whatsapp","instagram","facebook","walkin","phone","google","referral","manual","other"] as const;
export const AD_SOURCES = [["","Ad source: not known"],["meta_ad","Meta ad (FB/Insta)"],["google_ad","Google ad"],["organic","Organic / no ad"],["referral","Referral"]] as const;
/** Result of one call / visit, stored in sales_lead_followups.outcome. */
export const LEAD_OUTCOMES = [
  ["no_answer", "📵 Call എടുത്തില്ല"],
  ["busy", "⏳ Busy · പിന്നെ വിളിക്കാൻ പറഞ്ഞു"],
  ["interested", "👍 താല്പര്യമുണ്ട്"],
  ["showroom_visit", "🏬 Showroom-ൽ വരാമെന്ന് പറഞ്ഞു"],
  ["quotation_requested", "📄 Quotation ചോദിച്ചു"],
  ["not_interested", "👎 വേണ്ട എന്ന് പറഞ്ഞു"],
  ["note", "📝 Note മാത്രം"],
] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number][0];
export const leadOutcomeLabel = (o?: string | null) => LEAD_OUTCOMES.find(([v]) => v === o)?.[1] ?? "📝 Note";
/** Why a lead was lost or cancelled (sales_leads.lost_reason). */
export const LOST_REASONS = ["വില കൂടുതൽ · Price too high","വേറെ കടയിൽ നിന്ന് വാങ്ങി · Bought elsewhere","മറുപടിയില്ല · No response","ഇപ്പോൾ വേണ്ട, പിന്നീട് · Not now / later","Design / size ശരിയായില്ല · Product not suitable","Delivery സമയം · Delivery time","Duplicate / തെറ്റായ enquiry · Duplicate or spam","മറ്റുള്ളവ · Other"] as const;
/** Quick next-follow-up choices: days from now at 10:30, skipping Sunday. */
export const followUpInDays = (days: number, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate()+days); if (d.getDay()===0) d.setDate(d.getDate()+1); d.setHours(10,30,0,0); const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
/** Next working day 10:30 (local), used as default follow-up. */
export const defaultFollowUpInput = () => { const d = new Date(); d.setDate(d.getDate()+1); if (d.getDay()===0) d.setDate(d.getDate()+1); d.setHours(10,30,0,0); const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
