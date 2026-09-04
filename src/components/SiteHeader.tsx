import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";
import {
  BookOpen,
  ClipboardList,
  Home,
  Info,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { openEnquiryForm } from "@/lib/enquiryForm";

export const SiteHeader = () => {
  const { user, isStaff } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const settings = useHomepageSettings();
  const headerRef = useRef<HTMLDivElement>(null);

  const catalogVisible = settings?.show_public_catalog !== false;
  const staffDestination = isStaff || user ? "/admin" : "/auth";
  const staffLabel = isStaff || user ? "Staff Dashboard" : "Staff Login";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const desktopLink = "text-sm font-semibold text-slate-700 transition-colors hover:text-[#0f5156]";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div ref={headerRef} className="container-page relative flex min-h-[72px] items-center justify-between gap-3 py-2.5 md:min-h-[82px]">
        <Link to="/" aria-label="Hitech Furniture & Interiors — Home" className="flex min-w-0 items-center gap-3">
          <Logo className="h-11 w-11 shrink-0 sm:h-12 sm:w-12 md:h-14 md:w-14" />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900 md:text-base">Hitech Furniture & Interiors</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">Kalpetta · Wayanad</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main navigation">
          <Link to="/" className={cn(desktopLink, location.pathname === "/" && "text-[#0f5156]")}>Home</Link>
          {catalogVisible || isStaff ? (
            <Link to="/catalog" className={cn(desktopLink, location.pathname.startsWith("/catalog") && "text-[#0f5156]")}>Furniture</Link>
          ) : null}
          <a href="/#interiors" className={desktopLink}>Interiors</a>
          <Link to="/about" className={cn(desktopLink, location.pathname === "/about" && "text-[#0f5156]")}>About</Link>
          <a href="/#contact" className={desktopLink}>Showroom</a>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <Link
            to={staffDestination}
            aria-label={staffLabel}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#0f5156]/25 bg-[#0f5156]/5 px-3 text-xs font-bold text-[#0f5156] transition hover:border-[#0f5156]/40 hover:bg-[#0f5156]/10 sm:h-11 sm:px-3.5 sm:text-sm"
          >
            {isStaff || user ? <LayoutDashboard className="h-4 w-4" /> : <User className="h-4 w-4" />}
            <span className="hidden xs:inline sm:inline">{staffLabel}</span>
          </Link>

          <button
            type="button"
            onClick={() => openEnquiryForm()}
            className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#0f5156] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b3d41] active:scale-[0.98] sm:inline-flex"
          >
            <MessageCircle className="h-4 w-4" />
            Enquire Now
          </button>

          <button
            type="button"
            onClick={() => openEnquiryForm()}
            aria-label="Open enquiry form"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f5156] text-white sm:hidden"
          >
            <ClipboardList className="h-4 w-4" />
          </button>

          <button
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 transition hover:bg-slate-50 active:scale-95 lg:hidden",
              open && "border-[#0f5156]/30 bg-slate-50 text-[#0f5156]",
            )}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="absolute right-3 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl lg:hidden">
            <div className="space-y-1">
              <MobileLink to="/" icon={Home} label="Home" onClick={() => setOpen(false)} active={location.pathname === "/"} />
              {(catalogVisible || isStaff) && (
                <MobileLink to="/catalog" icon={BookOpen} label="Furniture Collection" onClick={() => setOpen(false)} active={location.pathname.startsWith("/catalog")} />
              )}
              <MobileAnchor href="/#interiors" icon={Info} label="Interior Solutions" onClick={() => setOpen(false)} />
              <MobileLink to="/about" icon={Info} label="About Hitech" onClick={() => setOpen(false)} active={location.pathname === "/about"} />
              <MobileAnchor href="/#contact" icon={MapPin} label="Showroom & Contact" onClick={() => setOpen(false)} />
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openEnquiryForm();
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f5156] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0b3d41]"
            >
              <Phone className="h-4 w-4" />
              Send an Enquiry
            </button>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <Link
                to={staffDestination}
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#0f5156]/20 bg-[#0f5156]/5 px-3 py-2.5 text-sm font-bold text-[#0f5156] transition hover:bg-[#0f5156]/10"
              >
                {isStaff || user ? <LayoutDashboard className="h-4 w-4" /> : <User className="h-4 w-4" />}
                {staffLabel}
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

type IconType = typeof Home;

type MobileLinkProps = {
  to: string;
  icon: IconType;
  label: string;
  onClick: () => void;
  active?: boolean;
};

const MobileLink = ({ to, icon: Icon, label, onClick, active = false }: MobileLinkProps) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-colors",
      active ? "bg-slate-100 text-[#0f5156]" : "text-slate-800 hover:bg-slate-50 hover:text-[#0f5156]",
    )}
  >
    <Icon className="h-4 w-4" />
    <span>{label}</span>
  </Link>
);

type MobileAnchorProps = {
  href: string;
  icon: IconType;
  label: string;
  onClick: () => void;
};

const MobileAnchor = ({ href, icon: Icon, label, onClick }: MobileAnchorProps) => (
  <a
    href={href}
    onClick={onClick}
    className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 hover:text-[#0f5156]"
  >
    <Icon className="h-4 w-4" />
    <span>{label}</span>
  </a>
);