import { buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/brand";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { SocialIcon } from "@/components/SocialLinks";

/**
 * Single floating WhatsApp button. Instagram / Facebook used to float here
 * too, but three stacked buttons covered page content — they now live in
 * the home page "Scan & connect" QR and the /connect links page.
 */
export const WhatsAppFab = () => {
  const settings = useHomepageSettings();
  const number = settings?.whatsapp_number || WHATSAPP_NUMBER;
  const message =
    settings?.whatsapp_default_message ||
    "Hello Hitech Furniture, I'd like to know more about your collection.";
  const waUrl = buildWhatsAppUrl(message).replace(WHATSAPP_NUMBER, number);

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-elegant transition-smooth hover:scale-110"
    >
      <SocialIcon k="whatsapp" className="h-7 w-7" />
    </a>
  );
};
