import { Link } from "react-router-dom";
import { Instagram, Facebook, Youtube, Linkedin, AtSign, Send, Globe, MapPin, Link2, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { FancyQr } from "@/components/FancyQr";
import { CONNECT_PAGE_URL, type SocialLink, type SocialType } from "@/lib/socialLinks";

const GoogleG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 4.9L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 15.1 3.6 13.6 3.6 12c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4-3.8 8.2-8.4 8.2z" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.3l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" />
  </svg>
);

const STYLE: Record<SocialType, string> = {
  instagram: "bg-[radial-gradient(circle_at_30%_110%,#fdf497_0%,#fd5949_45%,#d6249f_60%,#285AEB_90%)] text-white",
  facebook: "bg-[#1877F2] text-white",
  google: "bg-white text-foreground ring-1 ring-border",
  whatsapp: "bg-[#25D366] text-white",
  youtube: "bg-[#FF0000] text-white",
  threads: "bg-black text-white",
  x: "bg-black text-white",
  linkedin: "bg-[#0A66C2] text-white",
  telegram: "bg-[#229ED9] text-white",
  maps: "bg-primary text-primary-foreground",
  website: "bg-accent text-accent-foreground",
  custom: "bg-muted text-foreground ring-1 ring-border",
};

export function SocialIcon({ k, className }: { k: SocialType; className?: string }) {
  const c = cn("h-6 w-6", className);
  switch (k) {
    case "instagram": return <Instagram className={c} />;
    case "facebook": return <Facebook className={c} />;
    case "youtube": return <Youtube className={c} />;
    case "google": return <GoogleG className={c} />;
    case "whatsapp": return <WhatsAppIcon className={c} />;
    case "threads": return <AtSign className={c} />;
    case "x": return <XIcon className={c} />;
    case "linkedin": return <Linkedin className={c} />;
    case "telegram": return <Send className={c} />;
    case "maps": return <MapPin className={c} />;
    case "website": return <Globe className={c} />;
    default: return <Link2 className={c} />;
  }
}

const SIZES = { sm: "h-11 w-11", md: "h-12 w-12", lg: "h-14 w-14 sm:h-16 sm:w-16" } as const;
const ICON = { sm: "h-5 w-5", md: "h-6 w-6", lg: "h-7 w-7" } as const;

/** Round brand badge; an uploaded icon picture replaces the built-in one. */
export function SocialBadge({ k, iconUrl, size = "md" }: { k: SocialType; iconUrl?: string | null; size?: keyof typeof SIZES }) {
  if (iconUrl) {
    return <span className={cn("flex shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-border", SIZES[size])}><img src={iconUrl} alt="" className="h-full w-full object-cover" loading="lazy" /></span>;
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full shadow-sm", STYLE[k], SIZES[size])}>
      <SocialIcon k={k} className={ICON[size]} />
    </span>
  );
}

/**
 * Home page "Scan & connect" section: a branded QR (opens /connect, where all
 * links are listed) beside small round icons that open each page directly.
 */
export function ConnectSection({ links }: { links: SocialLink[] }) {
  if (!links.length) return null;
  return (
    <section className="container-page py-12 md:py-16" aria-labelledby="connect-heading">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-[#fbf3e6] via-card to-[#f6ead6] p-6 shadow-sm md:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto] md:gap-12">
          <div className="text-center md:text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Stay connected</p>
            <h2 id="connect-heading" className="font-display text-3xl text-foreground md:text-4xl">Follow us &amp; rate us</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground md:mx-0 md:text-base">
              New designs, showroom updates and happy homes. Tap an icon, or scan the code to keep every link on your phone.
            </p>
            <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-4 md:justify-start">
              {links.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.action} className="group flex w-[4.5rem] flex-col items-center gap-1.5 text-[11px] font-semibold text-foreground">
                    <span className="transition duration-200 group-hover:-translate-y-1 group-hover:drop-shadow-md"><SocialBadge k={l.key} iconUrl={l.icon_url} size="md" /></span>
                    <span className="line-clamp-2 text-center leading-tight">{l.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <Link to="/connect" aria-label="Open all our links" className="group mx-auto block">
            <div className="rounded-[2.5rem] bg-gradient-to-br from-[#5E2D05] via-[#8a4a10] to-[#F4A227] p-[3px] shadow-lg transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
              <div className="flex flex-col items-center rounded-[calc(2.5rem-3px)] bg-white px-6 pb-4 pt-6">
                <FancyQr value={CONNECT_PAGE_URL} size={176} title="Scan to connect with Hitech Furniture" />
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#5E2D05] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                  <ScanLine className="h-3.5 w-3.5" /> Scan to connect
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
