import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
  const { productId: routeProductId } = useParams();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const productId =
      routeProductId || searchParams.get("product") || undefined;
    const productName = searchParams.get("name") || undefined;
    // openEnquiryForm self-retries until the global <EnquiryForm /> mounts.
    openEnquiryForm({ productId, productName });
  }, [routeProductId, searchParams]);

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
