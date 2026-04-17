import { Logo } from "./Logo";
import { BRAND_NAME, WHATSAPP_NUMBER } from "@/lib/brand";
import { MapPin, Phone, Mail, MessageCircle } from "lucide-react";

const MAPS_URL = "https://maps.app.goo.gl/hy5mbzYsFP2c3vx27?g_st=iw";
const ADDRESS_LINES = [
  "Edappetty Shopping Centre",
  "Near Amrid, Edappetty",
  "Kalpetta, Wayanad - 673122",
];

export const SiteFooter = () => (
  <footer className="mt-24 border-t border-border/60 bg-secondary/40">
    <div className="container-page grid gap-10 py-14 md:grid-cols-4">
      <div className="md:col-span-1">
        <Logo className="h-12 w-auto" />
        <p className="mt-4 max-w-sm text-sm text-muted-foreground">
          A live catalog of furniture & interior pieces — refined craftsmanship for homes and workspaces.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Managing Partner: <span className="font-medium text-foreground/80">Abdul Raheem</span>
        </p>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">Visit Us</h4>
        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener"
          className="group flex items-start gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <span>
            {ADDRESS_LINES.map((l) => (
              <span key={l} className="block">{l}</span>
            ))}
            <span className="mt-1 inline-block text-xs font-medium text-primary group-hover:underline">
              Open in Google Maps →
            </span>
          </span>
        </a>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">Contact</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <a href="tel:+919526610404" className="hover:text-primary">+91 95266 10404</a>
          </li>
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <a href="tel:+919562134796" className="hover:text-primary">+91 95621 34796</a>
          </li>
          <li className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <a href="mailto:hitechfurniturekainatty@gmail.com" className="break-all hover:text-primary">
              hitechfurniturekainatty@gmail.com
            </a>
          </li>
          <li>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener"
              className="mt-1 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp →
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">Find Us</h4>
        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener"
          className="block overflow-hidden rounded-lg border border-border shadow-sm transition-smooth hover:shadow-md"
        >
          <iframe
            title="Hitech Furniture & Interiors location"
            src="https://www.google.com/maps?q=Edappetty+Shopping+Centre+Kalpetta+Wayanad&output=embed"
            className="pointer-events-none h-36 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </a>
      </div>
    </div>

    <div className="border-t border-border/60">
      <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
        <p className="italic">Make your space extraordinary.</p>
      </div>
    </div>
  </footer>
);
