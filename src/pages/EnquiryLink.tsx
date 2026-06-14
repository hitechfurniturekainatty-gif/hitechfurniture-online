import { useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { openEnquiryForm } from "@/lib/enquiryForm";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Clipboard, ClipboardCheck, Link2Off, MailQuestion, Search } from "lucide-react";
import { toast } from "sonner";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Direct-link landing page for the General Enquiry form.
 *
 * Visiting `/enquiry` (or `/enquiry?product=<id>&name=<name>` from a
 * WhatsApp share, for example) auto-opens the global enquiry dialog
 * so the customer lands straight on the form without needing to find
 * the button on the home page.
 *
 * When the URL carries a product id, we verify that product exists and
 * is published. If not, we show a clear 404 view that tells the user
 * the link is invalid and shows the correct enquiry URL.
 */
const EnquiryLink = () => {
  const { productId: routeProductId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const productId =
    routeProductId || searchParams.get("product") || undefined;
  const productName = searchParams.get("name") || undefined;

  type Status = "validating" | "opening" | "invalid";
  const [status, setStatus] = useState<Status>(
    productId ? "validating" : "opening",
  );
  const [copied, setCopied] = useState(false);

  const correctUrl = `${window.location.origin}/enquiry`;

  useEffect(() => {
    let cancelled = false;

    // No product id — just open the form.
    if (!productId) {
      openEnquiryForm({ productName });
      return;
    }

    // Cheap shape check first so obvious typos fail fast.
    if (!UUID_RE.test(productId)) {
      setStatus("invalid");
      return;
    }

    // Verify the product exists, is published, and not soft-deleted.
    supabase
      .from("products")
      .select("id, product_name")
      .eq("id", productId)
      .eq("is_published", true)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          // Pass through the canonical product name from the DB if the URL
          // didn't supply one (more accurate than trusting a query string).
          openEnquiryForm({
            productId: data.id,
            productName: productName || data.product_name,
          });
        } else {
          setStatus("invalid");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId, productName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(correctUrl);
      setCopied(true);
      toast.success("Enquiry link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy it manually");
    }
  };

  const handleOpenCorrectLink = () => {
    openEnquiryForm({});
  };

  // ── Invalid link view ───────────────────────────────────────────────
  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container-page py-20">
          <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Link2Off className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl text-foreground sm:text-3xl">
              This enquiry link is invalid
            </h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              The product in this link could not be found — it may have been
              removed, unpublished, or the link was typed incorrectly.
            </p>

            {productId && (
              <p className="mt-4 break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Attempted:&nbsp;
                <span className="font-mono">{location.pathname}</span>
                {searchParams.toString() && (
                  <span className="font-mono">?{searchParams.toString()}</span>
                )}
              </p>
            )}

            <div className="mt-6 rounded-lg border border-border bg-background p-4 text-left">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MailQuestion className="h-3.5 w-3.5" />
                Correct enquiry link
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground sm:text-sm">
                  {correctUrl}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copy enquiry link"
                >
                  {copied ? (
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                  ) : (
                    <Clipboard className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={handleOpenCorrectLink}>Open enquiry form</Button>
              <Button asChild variant="outline">
                <Link to="/catalog">
                  <Search className="mr-2 h-4 w-4" /> Browse catalog
                </Link>
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Need help? Call us or message on WhatsApp — we'll happily take
              your enquiry over the phone.
            </p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // ── Loading / opening view ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          {status === "validating"
            ? "Checking the link…"
            : "Opening the enquiry form…"}
        </p>
      </div>
      <SiteFooter />
    </div>
  );
};

export default EnquiryLink;
