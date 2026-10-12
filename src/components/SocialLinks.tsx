import { Instagram, Facebook, Youtube, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SocialKey, SocialLink } from "@/lib/socialLinks";

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

const STYLE: Record<SocialKey, string> = {
  instagram: "bg-[radial-gradient(circle_at_30%_110%,#fdf497_0%,#fd5949_45%,#d6249f_60%,#285AEB_90%)] text-white",
  facebook: "bg-[#1877F2] text-white",
  google: "bg-white text-foreground ring-1 ring-border",
  whatsapp: "bg-[#25D366] text-white",
  youtube: "bg-[#FF0000] text-white",
  maps: "bg-primary text-primary-foreground",
};

export function SocialIcon({ k, className }: { k: SocialKey; className?: string }) {
  const c = cn("h-6 w-6", className);
  switch (k) {
    case "instagram": return <Instagram className={c} />;
    case "facebook": return <Facebook className={c} />;
    case "youtube": return <Youtube className={c} />;
    case "google": return <GoogleG className={c} />;
    case "whatsapp": return <WhatsAppIcon className={c} />;
    default: return <MapPin className={c} />;
  }
}

export function SocialBadge({ k, size = "md" }: { k: SocialKey; size?: "md" | "lg" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full shadow-sm", STYLE[k], size === "lg" ? "h-12 w-12" : "h-14 w-14 sm:h-16 sm:w-16")}>
      <SocialIcon k={k} className={size === "lg" ? "h-6 w-6" : "h-7 w-7"} />
    </span>
  );
}

/** Home page strip: one round icon per configured link. */
export function SocialLinksStrip({ links }: { links: SocialLink[] }) {
  if (!links.length) return null;
  return (
    <section className="container-page py-12 md:py-16" aria-labelledby="connect-heading">
      <div className="rounded-3xl border border-border bg-card px-5 py-8 text-center shadow-sm md:px-10 md:py-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">Stay connected</p>
        <h2 id="connect-heading" className="font-display text-2xl text-foreground md:text-3xl">Follow us &amp; share your experience</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">New designs, showroom updates and customer homes — tap an icon to open it directly.</p>
        <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-5 sm:gap-x-9">
          {links.map((l) => (
            <li key={l.key}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.action} className="group flex w-20 flex-col items-center gap-2 text-xs font-semibold text-foreground">
                <span className="transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg"><SocialBadge k={l.key} /></span>
                <span className="text-center leading-tight">{l.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
