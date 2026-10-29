// Ad tracking: Meta Pixel + GA4. Public pages only (staff/admin/worker excluded).
type Fn = (...a: unknown[]) => void;
const w = () => window as unknown as { fbq?: Fn; gtag?: Fn };
const PRIVATE = /^\/(admin|staff-catalog|worker|auth|delivery-note)/;

export const isPublicPath = (p: string) => !PRIVATE.test(p);

export function trackPageView(path: string) {
  if (!isPublicPath(path)) return;
  try { w().fbq?.("track", "PageView"); } catch { /* ignore */ }
}

export function trackLead(category?: string) {
  try { w().fbq?.("track", "Lead", { content_category: category ?? "enquiry" }); } catch { /* ignore */ }
  try { w().gtag?.("event", "generate_lead", { lead_source: "website_enquiry", category }); } catch { /* ignore */ }
}

export function trackContact(channel: string) {
  if (!isPublicPath(window.location.pathname)) return;
  try { w().fbq?.("track", "Contact", { content_name: channel }); } catch { /* ignore */ }
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
