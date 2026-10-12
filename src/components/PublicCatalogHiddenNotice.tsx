import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { openEnquiryForm } from "@/lib/enquiryForm";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";

/** Shown to the public when an admin has hidden this item / the catalog from public view. */
export function PublicCatalogHiddenNotice({ message, productId }: { message: string; productId?: string }) {
  const settings = useHomepageSettings();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container-page py-24 text-center md:py-32">
        <h1 className="font-display text-3xl text-foreground">Available at our showroom</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => openEnquiryForm(productId ? { productId } : {})}>Send an enquiry</Button>
          <Button variant="outline" asChild>
            <a href={settings?.google_maps_url || "https://maps.app.goo.gl/DQWJCG1xRGEcRzx56"} target="_blank" rel="noopener noreferrer">Showroom location</a>
          </Button>
          <Button variant="ghost" asChild><Link to="/">Home</Link></Button>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
