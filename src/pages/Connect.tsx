import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, LayoutGrid, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Seo } from "@/components/Seo";
import { SocialLinkList, ShareLinksButton } from "@/components/SocialLinks";
import { FancyQr } from "@/components/FancyQr";
import { useRef } from "react";
import { CONNECT_PAGE_URL } from "@/lib/socialLinks";
import { useSocialLinks } from "@/hooks/useSocialLinks";
import { openEnquiryForm } from "@/lib/enquiryForm";

/**
 * Link page opened by the shop QR code (hitechfurniture.online/connect):
 * every social / review link in one place, big and thumb-friendly.
 */
const Connect = () => {
  const { links, ready, settings } = useSocialLinks();
  const qrRef = useRef<SVGSVGElement>(null);
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
        {ready && links.length > 0 && (
          <div className="mt-8 flex w-full flex-col items-center gap-3 rounded-3xl border border-border bg-card p-5 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">Share with family &amp; friends</p>
            <div className="rounded-[1.6rem] bg-gradient-to-br from-[#5E2D05] via-[#8a4a10] to-[#F4A227] p-[3px]">
              <div className="rounded-[calc(1.6rem-3px)] bg-white p-3"><FancyQr ref={qrRef} value={CONNECT_PAGE_URL} size={150} title="QR code for this page" /></div>
            </div>
            <p className="text-xs text-muted-foreground">Let them scan this, or send every link on WhatsApp in one tap.</p>
            <ShareLinksButton links={links} qrRef={qrRef} variant="light" className="w-full" />
          </div>
        )}
        <Link to="/" className="mt-8 text-xs font-semibold text-primary hover:underline">hitechfurniture.online</Link>
      </main>
    </div>
  );
};

export default Connect;
