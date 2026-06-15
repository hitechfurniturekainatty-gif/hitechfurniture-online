import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X, ClipboardList } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { openEnquiryForm } from "@/lib/enquiryForm";

export const SiteHeader = () => {
  const { user, isStaff } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const settings = useHomepageSettings();
  // Default to visible until settings load to avoid a flash of "missing" link.
  const catalogVisible = settings?.show_public_catalog !== false;

  const nav = [
    { to: "/", label: "Home" },
    ...(catalogVisible || isStaff ? [{ to: "/catalog", label: "Catalog" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 shadow-card-soft backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="container-page grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 md:py-4">
        <Link to="/" aria-label="Hitech Furniture & Interiors — Home" className="flex items-center gap-3 justify-self-start min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.35)] ring-2 ring-white/80 sm:h-12 sm:w-12 md:h-14 md:w-14">
            <Logo className="h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10" rounded={false} />
          </span>
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="font-display text-sm font-bold tracking-tight text-foreground md:text-base">Hitech Furniture</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:text-[11px]">& Interiors</span>
          </span>
        </Link>

        <nav className="hidden items-center justify-center gap-10 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "text-base font-semibold tracking-wide transition-smooth hover:text-primary",
                location.pathname === n.to ? "text-primary" : "text-foreground/70"
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2 justify-self-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-base font-semibold text-foreground/80 hover:text-primary"
            onClick={() => openEnquiryForm()}
          >
            <ClipboardList className="h-4 w-4" />
            Enquiry Form
          </Button>
          {isStaff ? (
            <Button asChild variant="default" size="lg" className="text-base">
              <Link to="/admin">Dashboard</Link>
            </Button>
          ) : user ? (
            <Button asChild variant="outline" size="lg" className="text-base">
              <Link to="/admin">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="lg" className="text-base">
              <Link to="/auth">Staff Login</Link>
            </Button>
          )}
        </div>

        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground hover:bg-muted active:scale-95 transition-smooth justify-self-end"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background shadow-card-soft">
          <div className="container-page flex flex-col gap-1 py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-semibold text-foreground/80 hover:bg-muted active:bg-muted"
              >
                {n.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => { setOpen(false); openEnquiryForm(); }}
              className="flex items-center gap-2 rounded-lg px-3 py-3 text-left text-base font-semibold text-primary hover:bg-muted active:bg-muted"
            >
              <ClipboardList className="h-4 w-4" />
              Enquiry Form
            </button>
            <Link
              to={isStaff || user ? "/admin" : "/auth"}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-bold text-primary hover:bg-muted active:bg-muted"
            >
              {isStaff || user ? "Dashboard" : "Staff Login"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
