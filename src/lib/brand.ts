export const WHATSAPP_NUMBER = "919526610404"; // +91 95266 10404
export const BRAND_NAME = "My Hitech";
export const BRAND_FULL_NAME = "My Hitech — Furniture & Interiors";
export const BRAND_TAGLINE = "Crafted interiors for considered living.";
export const CONTACT_LINE = "My Hitech • +91 95266 10404";

export const formatINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
};

export const buildWhatsAppUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
