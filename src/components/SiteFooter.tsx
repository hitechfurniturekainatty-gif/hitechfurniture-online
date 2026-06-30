import { Logo } from "./Logo";
import { BRAND_NAME, WHATSAPP_NUMBER } from "@/lib/brand";
import { MapPin, Phone, Mail, MessageCircle, Instagram, Facebook, BookOpen, Info, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { openEnquiryForm } from "@/lib/enquiryForm";

const FALLBACK_MAPS_URL = "https://maps.app.goo.gl/hy5mbzYsFP2c3vx27?g_st=iw";
const FALLBACK_ADDRESS_LINES = [
  "Edappetty Shopping Centre",
  "Near Amrid, Edappetty",
  "Kalpetta, Wayanad - 673122",
];
const FALLBACK_EMBED_URL =
  "https://www.google.com/maps?q=Edappetty+Shopping+Centre+Kalpetta+Wayanad&output=embed";

export const SiteFooter = () => {
  const s = useHomepageSettings();
  const mapsUrl = s?.google_maps_url || FALLBACK_MAPS_URL;
  const embedUrl = s?.google_maps_embed_url || FALLBACK_EMBED_URL;
  const addressLines = (s?.address_lines && s.address_lines.length ? s.address_lines : FALLBACK_ADDRESS_LINES);
  const phone1 = s?.contact_phone || "+91 98951 34482";
  const phone2 = s?.contact_phone_secondary || "+91 95621 34796";
  const email = s?.contact_email || "hitechfurniturekainatty@gmail.com";
  const whatsappNumber = s?.whatsapp_number || WHATSAPP_NUMBER;
  const about =
    s?.footer_about ||
    "A live catalog of furniture & interior pieces — refined craftsmanship for homes and workspaces.";

  return (
  <footer className="mt-24 border-t border-border/60 bg-secondary/40">
    <div className="container-page grid gap-10 py-14 md:grid-cols-4">
      <div className="md:col-span-1">
        <Logo className="h-10 w-10" />
        <p className="mt-4 max-w-sm text-sm text-muted-foreground">{about}</p>
        {(s?.instagram_url || s?.facebook_url) && (
          <div className="mt-4 flex items-center gap-2">
            {s?.instagram_url && (
              <a
                href={s.instagram_url}
                target="_blank"
                rel="noopener"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground/70 shadow-card-soft transition-smooth hover:text-primary"
              >
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {s?.facebook_url && (
              <a
                href={s.facebook_url}
                target="_blank"
                rel="noopener"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-foreground/70 shadow-card-soft transition-smooth hover:text-primary"
              >
                <Facebook className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">Visit Us</h4>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener"
          className="group flex items-start gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <span>
            {addressLines.map((l) => (
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
          {phone1 && (
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <a href={`tel:${phone1.replace(/\s+/g, "")}`} className="hover:text-primary">{phone1}</a>
            </li>
          )}
          {phone2 && (
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <a href={`tel:${phone2.replace(/\s+/g, "")}`} className="hover:text-primary">{phone2}</a>
            </li>
          )}
          {email && (
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <a href={`mailto:${email}`} className="break-all hover:text-primary">{email}</a>
            </li>
          )}
          <li>
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener"
              className="mt-1 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp →
            </a>
          </li>
          <li className="pt-2">
            <button
              type="button"
              onClick={() => openEnquiryForm()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:shadow-md"
            >
              <ClipboardList className="h-4 w-4" />
              Enquiry Form
            </button>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground/70">Find Us</h4>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener"
          className="block overflow-hidden rounded-lg border border-border shadow-sm transition-smooth hover:shadow-md"
        >
          <iframe
            title="Hitech Furniture & Interiors location"
            src={embedUrl}
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
        <div className="flex items-center gap-4">
          <Link to="/about" className="inline-flex items-center gap-1 hover:text-primary">
            <Info className="h-3.5 w-3.5" /> About
          </Link>
          <Link to="/guide" className="inline-flex items-center gap-1 hover:text-primary">
            <BookOpen className="h-3.5 w-3.5" /> User Guide
          </Link>
          <Link to="/privacy-policy" className="inline-flex items-center gap-1 hover:text-primary">
            Privacy Policy
          </Link>
          <span className="italic">Make your space extraordinary.</span>
        </div>
      </div>
    </div>
  </footer>
  );
};
