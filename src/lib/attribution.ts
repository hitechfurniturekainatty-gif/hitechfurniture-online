// Remembers how a visitor reached the site (Meta ad, Google ad or organic) so
// a website enquiry can record it on the lead. Nothing personal is stored —
// only the ad/campaign tags that were already in the link they clicked.
export type AdSource = "meta_ad" | "google_ad" | "organic";
export type Attribution = { ad_source: AdSource; ad_campaign: string | null; at: number };

const KEY = "hitech_attribution_v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // an ad click counts for 30 days

const META = /^(facebook|fb|instagram|ig|meta|messenger|an)$/i;
const GOOGLE = /^(google|adwords|googleads|youtube)$/i;
const PAID = /(cpc|ppc|paid|ads?|display|social_paid|paidsocial)/i;

/** Pure: works out the source from a URL query string. Exported for tests. */
export function classifyAttribution(search: string): Omit<Attribution, "at"> {
  const q = new URLSearchParams(search);
  const src = (q.get("utm_source") || "").trim();
  const medium = (q.get("utm_medium") || "").trim();
  const campaign = (q.get("utm_campaign") || "").trim().slice(0, 120) || null;
  if (q.get("fbclid") || (META.test(src) && PAID.test(medium))) return { ad_source: "meta_ad", ad_campaign: campaign };
  if (q.get("gclid") || q.get("gbraid") || q.get("wbraid") || (GOOGLE.test(src) && PAID.test(medium))) return { ad_source: "google_ad", ad_campaign: campaign };
  return { ad_source: "organic", ad_campaign: campaign };
}

const read = (): Attribution | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Attribution;
    if (!a?.ad_source || Date.now() - Number(a.at) > MAX_AGE_MS) return null;
    return a;
  } catch {
    return null;
  }
};

/** Call once when the site loads. A new ad click replaces an older record; a plain visit never erases an ad click. */
export function captureAttribution() {
  try {
    const now = classifyAttribution(window.location.search);
    const saved = read();
    const isAd = now.ad_source !== "organic";
    if (isAd || !saved) localStorage.setItem(KEY, JSON.stringify({ ...now, at: Date.now() }));
  } catch {
    /* storage blocked — enquiry simply goes without a source */
  }
}

/** What to send with an enquiry. */
export function getAttribution(): { adSource: AdSource | null; adCampaign: string | null } {
  const a = read();
  return { adSource: a?.ad_source ?? null, adCampaign: a?.ad_campaign ?? null };
}
