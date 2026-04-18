import { forwardRef } from "react";
import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/brand";

export const WhatsAppFab = forwardRef<HTMLAnchorElement>((_, ref) => (
  <a
    ref={ref}
    href={buildWhatsAppUrl("Hello Hitech Furniture, I'd like to know more about your collection.")}
    target="_blank"
    rel="noopener"
    aria-label="Chat with us on WhatsApp"
    className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-elegant transition-smooth hover:scale-110"
  >
    <MessageCircle className="h-7 w-7" />
  </a>
));
WhatsAppFab.displayName = "WhatsAppFab";
