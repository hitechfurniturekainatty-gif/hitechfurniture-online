import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { openEnquiryForm } from "@/lib/enquiryForm";
import { Loader2 } from "lucide-react";

/**
 * Direct-link landing page for the General Enquiry form.
 *
 * Visiting `/enquiry` (or `/enquiry?product=<id>&name=<name>` from a
 * WhatsApp share, for example) auto-opens the global enquiry dialog
 * so the customer lands straight on the form without needing to find
 * the button on the home page.
 */
const EnquiryLink = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Give the global <EnquiryForm /> a tick to mount, then open it.
    const t = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const productId = params.get("product") ?? undefined;
      const productName = params.get("name") ?? undefined;
      openEnquiryForm({
        productId: productId || undefined,
        productName: productName || undefined,
      });
      navigate("/", { replace: true });
    }, 80);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        Opening the enquiry form…
      </p>
    </div>
  );
};

export default EnquiryLink;
