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
