// Ad tracking: Meta Pixel + GA4. Public pages only (staff/admin/worker excluded).
type Fn = (...a: unknown[]) => void;
const w = () => window as unknown as { fbq?: Fn; gtag?: Fn };
const PRIVATE = /^\/(admin|staff-catalog|worker|auth|delivery-note)/;

export const isPublicPath = (p: string) => !PRIVATE.test(p);

export function trackPageView(path: string) {
  if (!isPublicPath(path)) return;
  try { w().fbq?.("track", "PageView"); } catch { /* ignore */ }
}

const CAPI = "https://ejxautrxbcemrncpzjyg.supabase.co/functions/v1/meta-capi";
const ck = (n: string) => document.cookie.split("; ").find(c => c.startsWith(n + "="))?.split("=")[1];
const newId = () => (crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2));
function capi(event_name: string, event_id: string, extra: Record<string, unknown>) {
  try {
    fetch(CAPI, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_name, event_id, fbp: ck("_fbp"), fbc: ck("_fbc"), url: location.href, ...extra }) }).catch(() => {});
  } catch { /* ignore */ }
}

export function trackLead(category?: string, user?: { phone?: string; name?: string; place?: string }) {
  const id = newId();
  try { w().fbq?.("track", "Lead", { content_category: category ?? "enquiry" }, { eventID: id }); } catch { /* ignore */ }
  capi("Lead", id, { category: category ?? "enquiry", ...user });
  try { w().gtag?.("event", "generate_lead", { lead_source: "website_enquiry", category }); } catch { /* ignore */ }
}

export function trackContact(channel: string) {
  if (!isPublicPath(window.location.pathname)) return;
  const id = newId();
  try { w().fbq?.("track", "Contact", { content_name: channel }, { eventID: id }); } catch { /* ignore */ }
  capi("Contact", id, { channel });
  try { w().gtag?.("event", "contact_click", { channel }); } catch { /* ignore */ }
}

// One global listener: any click on WhatsApp / phone / Instagram / Messenger links counts as Contact
export function installContactTracking() {
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement | null)?.closest?.("a") as HTMLAnchorElement | null;
    const h = a?.href ?? "";
    if (!h) return;
    if (/wa\.me|api\.whatsapp|whatsapp:/.test(h)) trackContact("whatsapp");
    else if (h.startsWith("tel:")) trackContact("phone");
    else if (/instagram\.com|ig\.me/.test(h)) trackContact("instagram");
    else if (/m\.me|messenger\.com|facebook\.com/.test(h)) trackContact("facebook");
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
