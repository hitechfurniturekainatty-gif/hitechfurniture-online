import { MessageCircle, Instagram, Facebook } from "lucide-react";
import { buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/brand";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";

export const WhatsAppFab = () => {
  const settings = useHomepageSettings();
  const number = settings?.whatsapp_number || WHATSAPP_NUMBER;
  const message =
    settings?.whatsapp_default_message ||
    "Hello Hitech Furniture, I'd like to know more about your collection.";
  const waUrl = buildWhatsAppUrl(message).replace(WHATSAPP_NUMBER, number);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2.5">
      {settings?.instagram_url && (
        <a
          href={settings.instagram_url}
          target="_blank"
          rel="noopener"
          aria-label="Follow us on Instagram"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white shadow-elegant transition-smooth hover:scale-110"
        >
          <Instagram className="h-5 w-5" />
        </a>
      )}
      {settings?.facebook_url && (
        <a
          href={settings.facebook_url}
          target="_blank"
          rel="noopener"
          aria-label="Visit our Facebook page"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-elegant transition-smooth hover:scale-110"
        >
          <Facebook className="h-5 w-5" />
        </a>
      )}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener"
        aria-label="Chat with us on WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-elegant transition-smooth hover:scale-110"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
};
