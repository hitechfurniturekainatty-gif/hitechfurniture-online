import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, LayoutGrid, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Seo } from "@/components/Seo";
import { SocialLinkList } from "@/components/SocialLinks";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { openEnquiryForm } from "@/lib/enquiryForm";

/**
 * Link page opened by the shop QR code (hitechfurniture.online/connect):
 * every social / review link in one place, big and thumb-friendly.
 */
const Connect = () => {
  const { links, ready, settings } = useSocialLinks();
  const address = settings?.address_lines?.filter(Boolean).join(", ") || "Edapetty Shopping Centre, Edapetty, Kalpetta, Wayanad, PIN 673122";

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/60 via-background to-background">
      <Seo title="Connect with Hitech Furniture & Interiors" description="Instagram, Facebook, Google reviews, WhatsApp and directions for Hitech Furniture & Interiors, Kalpetta, Wayanad." />
      <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 pb-12 pt-10">
        <Link to="/" aria-label="Hitech Furniture home"><Logo className="h-14 w-auto" /></Link>
        <h1 className="mt-4 text-center font-display text-2xl text-foreground">Hitech Furniture &amp; Interiors</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">{address}</p>

        <div className="mt-7 w-full space-y-3">
          {!ready && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
          {ready && <SocialLinkList links={links} />}
          {ready && (
            <>
              <Link to="/catalog" className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-3 pr-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent"><LayoutGrid className="h-6 w-6" /></span>
                <span className="flex-1 font-semibold text-foreground">Browse our collection</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <button type="button" onClick={() => openEnquiryForm({})} className="flex w-full items-center gap-4 rounded-2xl bg-primary p-3 pr-4 text-left text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground/15"><ClipboardList className="h-6 w-6" /></span>
                <span className="flex-1 font-semibold">Send an enquiry</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <Link to="/" className="mt-8 text-xs font-semibold text-primary hover:underline">hitechfurniture.online</Link>
      </main>
    </div>
  );
};

export default Connect;
