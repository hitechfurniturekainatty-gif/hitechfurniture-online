import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X, ClipboardList, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { openEnquiryForm } from "@/lib/enquiryForm";

export const SiteHeader = () => {
  const { user, isStaff } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const settings = useHomepageSettings();

  const catalogVisible = settings?.show_public_catalog !== false;

  const nav = [
    { to: "/", label: "Home" },
    ...(catalogVisible || isStaff ? [{ to: "/catalog", label: "Catalog" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 shadow-card-soft backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="container-page flex items-center justify-between py-3 md:py-4">
        {/* Logo */}
        <Link to="/" aria-label="Hitech Furniture & Interiors — Home" className="flex items-center gap-3">
          <Logo className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14" />
        </Link>

        {/* 3-Line Hamburger Menu Button */}
        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground hover:bg-muted active:scale-95 transition-smooth"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Dropdown Menu */}
      {open && (
        <div className="border-t border-border/60 bg-background shadow-card-soft">
          <div className="container-page flex flex-col gap-2 py-4">
            {/* Staff Login / Dashboard */}
            <Button asChild variant="default" size="lg" className="w-full justify-start text-base font-bold">
              <Link
                to={isStaff || user ? "/admin" : "/auth"}
                onClick={() => setOpen(false)}
              >
                {isStaff || user ? "Dashboard" : "Staff Login"}
              </Link>
            </Button>

            {/* Home & Catalog */}
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-base font-semibold tracking-wide transition-smooth hover:bg-muted",
                  location.pathname === n.to ? "text-primary bg-muted/60" : "text-foreground/80"
                )}
              >
                {n.label}
              </Link>
            ))}

            {/* Others Submenu */}
            <div className="border-t border-border/40 pt-2 mt-1">
              <button
                type="button"
                onClick={() => setShowOthers(!showOthers)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-base font-semibold text-foreground/80 hover:bg-muted transition-smooth"
              >
                <span>Others</span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-200", showOthers && "rotate-180")}
                />
              </button>

              {showOthers && (
                <div className="ml-4 pl-3 border-l-2 border-primary/30 flex flex-col gap-1 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openEnquiryForm();
                    }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-primary hover:bg-muted"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Enquiry Form
                  </button>
                  <a
                    href="#about"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted"
                  >
                    About Us
                  </a>
                  <a
                    href="#contact"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted"
                  >
                    Contact & Showroom
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
