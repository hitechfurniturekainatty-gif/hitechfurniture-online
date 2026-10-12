import { CONNECT_PAGE_URL, type SocialLink, type SocialType } from "@/lib/socialLinks";

export const WEBSITE_URL = "https://hitechfurniture.online";

const EMOJI: Partial<Record<SocialType, string>> = {
  instagram: "📸", facebook: "👍", whatsapp: "💬", google: "⭐", youtube: "▶️", threads: "🧵",
  x: "✖️", linkedin: "💼", telegram: "✈️", maps: "📍", website: "🌐",
};

/** One WhatsApp-friendly message with every link, the website and the links page. */
export function buildShareText(links: SocialLink[]): string {
  const lines = links
    .filter(l => l.key !== "website" || l.url.replace(/\/$/, "") !== WEBSITE_URL)
    .map(l => `${EMOJI[l.key] ?? "🔗"} ${l.label}: ${l.url}`);
  return [
    "*Hitech Furniture & Interiors* — Edapetty, Kalpetta, Wayanad",
    "Follow us, chat with us & rate us:",
    "",
    ...lines,
    `🌐 Website: ${WEBSITE_URL}`,
    "",
    `All links in one place: ${CONNECT_PAGE_URL}`,
  ].join("\n");
}

/**
 * Share all links. Phones get the system share sheet (WhatsApp, etc.), with
 * the QR picture attached when the browser allows files. Elsewhere it opens
 * WhatsApp with the message ready. Returns how it was shared.
 */
export async function shareAllLinks(links: SocialLink[], qrPng?: () => Promise<string | null>): Promise<"shared" | "whatsapp" | "cancelled"> {
  const text = buildShareText(links);
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function") {
    try {
      let files: File[] | undefined;
      const png = qrPng ? await qrPng().catch(() => null) : null;
      if (png) {
        const blob = await (await fetch(png)).blob();
        const f = new File([blob], "hitech-furniture-qr.png", { type: "image/png" });
        if (nav.canShare?.({ files: [f] })) files = [f];
      }
      await nav.share(files ? { files, text, title: "Hitech Furniture & Interiors" } : { text, title: "Hitech Furniture & Interiors" });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // fall through to WhatsApp
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  return "whatsapp";
}
