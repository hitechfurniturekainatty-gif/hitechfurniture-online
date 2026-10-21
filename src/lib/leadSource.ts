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
/** Next working day 10:30 (local), used as default follow-up. */
export const defaultFollowUpInput = () => { const d = new Date(); d.setDate(d.getDate()+1); if (d.getDay()===0) d.setDate(d.getDate()+1); d.setHours(10,30,0,0); const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
