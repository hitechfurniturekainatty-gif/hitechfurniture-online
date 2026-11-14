export const WHATSAPP_NUMBER = "919895134482"; // +91 98951 34482
export const BRAND_NAME = "My Hitech";
export const BRAND_FULL_NAME = "My Hitech — Furniture & Interiors";
export const BRAND_TAGLINE = "Crafted interiors for considered living.";
export const CONTACT_LINE = "My Hitech • +91 98951 34482";

export const formatINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

/**
 * Plain number with Indian digit grouping (no ₹ / Rs prefix).
 * Use inside line-item tables — the column header already says "(INR)".
 */
export const formatINRNumber = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
};

export const buildWhatsAppUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;


/** WhatsApp green dark enough for white text (≥ 4.5:1 contrast). */
export const WHATSAPP_BUTTON_CLASS =
  "bg-[#0C7F3F] text-white hover:bg-[#0A6E36] focus-visible:ring-2 focus-visible:ring-[#0C7F3F] focus-visible:ring-offset-2";

/**
 * Pre-filled WhatsApp message for a specific product, so staff can see
 * exactly which item the customer was looking at.
 */
export const buildProductWhatsAppMessage = (p: { name: string; code?: string | null; url?: string | null }) =>
  [
    "Hello Hitech Furniture, I'm interested in this product:",
    `${p.name}${p.code ? ` (Code ${p.code})` : ""}`,
    p.url || "",
    "Please share the price and availability.",
  ].filter(Boolean).join("\n");

/** WhatsApp link to an explicit number (admin settings can override the default). */
export const buildWhatsAppUrlFor = (number: string | null | undefined, message: string) =>
  `https://wa.me/${(number || WHATSAPP_NUMBER).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
