import { Logo } from "./Logo";
import { BRAND_NAME, WHATSAPP_NUMBER } from "@/lib/brand";

export const SiteFooter = () => (
  <footer className="mt-24 border-t border-border/60 bg-secondary/40">
    <div className="container-page grid gap-10 py-14 md:grid-cols-3">
      <div>
        <Logo className="h-12 w-auto" />
        <p className="mt-4 max-w-sm text-sm text-muted-foreground">
          A live catalog of furniture & interior pieces — refined craftsmanship for homes and workspaces.
        </p>
      </div>
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">Visit / Call</h4>
        <p className="text-sm text-muted-foreground">+91 95266 10404</p>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Chat on WhatsApp →
        </a>
      </div>
      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">{BRAND_NAME}</h4>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} All rights reserved.</p>
      </div>
    </div>
  </footer>
);
