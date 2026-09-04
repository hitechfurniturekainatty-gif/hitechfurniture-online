import { Logo } from "./Logo";
import { BRAND_NAME, WHATSAPP_NUMBER } from "@/lib/brand";
import { MapPin, Phone, Mail, MessageCircle, Instagram, Facebook, BookOpen, Info, ClipboardList, ArrowUpRight, Sparkles } from "lucide-react";
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
    "Premium furniture, custom-made solutions and complete interiors for homes and businesses across Wayanad.";

  return (
    <footer className="mt-24 overflow-hidden border-t border-border/70 bg-gradient-to-b from-secondary/35 to-background">
      <div className="container-page pt-14 md:pt-18">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-primary text-primary-foreground shadow-[0_18px_60px_rgba(15,23,42,0.10)]">
          <div className="grid gap-6 p-7 sm:p-9 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/75">
                <Sparkles className="h-3.5 w-3.5" /> Furniture & Interiors
              </div>
              <h2 className="mt-5 max-w-2xl font-display text-3xl leading-tight sm:text-4xl">Planning furniture or interiors for your space?</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-primary-foreground/70 sm:text-base">
                Explore our collection, discuss a custom furniture requirement or start an interior project with the Hitech team in Wayanad.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <button
                type="button"
                onClick={() => openEnquiryForm()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-5 text-sm font-bold text-primary shadow-sm transition hover:-translate-y-0.5"
              >
                <ClipboardList className="h-4 w-4" /> Start an enquiry
              </button>
              <Link
                to="/catalog"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/5 px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-foreground/10"
              >
                Browse furniture <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.2fr_0.9fr_0.9fr_1.2fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo className="h-12 w-12" />
            <div>
              <p className="font-display text-lg leading-tight text-foreground">Hitech Furniture & Interiors</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kalpetta · Wayanad</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">{about}</p>
          {(s?.instagram_url || s?.facebook_url) && (
            <div className="mt-5 flex items-center gap-2">
              {s?.instagram_url && (
                <a href={s.instagram_url} target="_blank" rel="noopener" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition hover:-translate-y-0.5 hover:text-primary">
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {s?.facebook_url && (
                <a href={s.facebook_url} target="_blank" rel="noopener" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground/70 shadow-sm transition hover:-translate-y-0.5 hover:text-primary">
                  <Facebook className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-foreground/65">Explore</h4>
          <div className="space-y-3 text-sm">
            <Link to="/catalog" className="block text-muted-foreground transition hover:text-primary">Furniture Collection</Link>
            <Link to="/#interiors" className="block text-muted-foreground transition hover:text-primary">Interior Solutions</Link>
            <Link to="/about" className="block text-muted-foreground transition hover:text-primary">About Hitech</Link>
            <Link to="/#contact" className="block text-muted-foreground transition hover:text-primary">Showroom & Contact</Link>
            <Link to="/faq" className="block text-muted-foreground transition hover:text-primary">FAQ</Link>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-foreground/65">Contact</h4>
          <div className="space-y-3 text-sm text-muted-foreground">
            {phone1 && <a href={`tel:${phone1.replace(/\s+/g, "")}`} className="flex items-center gap-2 transition hover:text-primary"><Phone className="h-4 w-4 text-primary" />{phone1}</a>}
            {phone2 && <a href={`tel:${phone2.replace(/\s+/g, "")}`} className="flex items-center gap-2 transition hover:text-primary"><Phone className="h-4 w-4 text-primary" />{phone2}</a>}
            {email && <a href={`mailto:${email}`} className="flex items-start gap-2 break-all transition hover:text-primary"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{email}</a>}
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"><MessageCircle className="h-4 w-4" />Chat on WhatsApp</a>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-foreground/65">Visit our showroom</h4>
          <a href={mapsUrl} target="_blank" rel="noopener" className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md">
            <iframe title="Hitech Furniture & Interiors location" src={embedUrl} className="pointer-events-none h-36 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <div className="flex items-start gap-2 p-4 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                {addressLines.map((l) => <span key={l} className="block">{l}</span>)}
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">Open in Google Maps <ArrowUpRight className="h-3.5 w-3.5" /></span>
              </span>
            </div>
          </a>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="container-page flex flex-col gap-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link to="/privacy-policy" className="hover:text-primary">Privacy Policy</Link>
            <Link to="/guide" className="inline-flex items-center gap-1 hover:text-primary"><BookOpen className="h-3.5 w-3.5" /> User Guide</Link>
            <Link to="/about" className="inline-flex items-center gap-1 hover:text-primary"><Info className="h-3.5 w-3.5" /> About</Link>
            <span className="italic">Make your space extraordinary.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
