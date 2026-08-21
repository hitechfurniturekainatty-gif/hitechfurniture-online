import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";
import { 
  Menu, 
  X, 
  ClipboardList, 
  Home, 
  BookOpen, 
  LayoutDashboard, 
  User, 
  Phone, 
  Info,
  ChevronDown
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { openEnquiryForm } from "@/lib/enquiryForm";

export const SiteHeader = () => {
  const { user, isStaff } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const settings = useHomepageSettings();
  const headerRef = useRef<HTMLDivElement>(null);

  const catalogVisible = settings?.show_public_catalog !== false;

  const nav = [
    { to: "/", label: "Home", icon: Home },
    ...(catalogVisible || isStaff ? [{ to: "/catalog", label: "Catalog", icon: BookOpen }] : []),
  ];

  // മെനുവിന് പുറത്ത് ക്ലിക്ക് ചെയ്താൽ തനിയെ ക്ലോസ് ആവാൻ
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // പേജ് മാറുമ്പോൾ മെനു ക്ലോസ് ആവാൻ
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 shadow-card-soft backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="container-page relative flex items-center justify-between py-3 md:py-4" ref={headerRef}>
        
        {/* Brand Logo (Left) */}
        <Link to="/" aria-label="Hitech Furniture & Interiors — Home" className="flex items-center gap-3">
          <Logo className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14" />
        </Link>

        {/* 3-Line Hamburger Menu Button (Right Corner) */}
        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-card text-foreground transition-all duration-200 hover:bg-muted active:scale-95",
            open && "bg-muted text-primary border-primary/40 shadow-sm"
          )}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* വലതുവശത്ത് മാത്രം വരുന്ന ചെറിയ ഫ്ലോട്ടിംഗ് ഓവൽ ബോക്സ് (Compact Right-Aligned Menu) */}
        {open && (
          <div className="absolute right-4 sm:right-6 top-[calc(100%+0.5rem)] w-64 max-w-[calc(100vw-2rem)] rounded-3xl border border-border/80 bg-background/98 p-3 shadow-2xl backdrop-blur-xl transition-all animate-in fade-in zoom-in-95 duration-150 z-50">
            
            {/* 1. Staff Login / Dashboard (Oval Shape Button) */}
            <Link
              to={isStaff || user ? "/admin" : "/auth"}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 mb-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm hover:opacity-95 transition-opacity"
            >
              {isStaff || user ? (
                <LayoutDashboard className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
              <span>{isStaff || user ? "Dashboard" : "Staff Login"}</span>
            </Link>

            {/* 2. Menu Links */}
            <div className="flex flex-col gap-1">
              {nav.map((n) => {
                const IconComponent = n.icon;
                const isActive = location.pathname === n.to;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-colors hover:bg-muted",
                      isActive ? "bg-muted/80 font-semibold text-primary" : "text-foreground/80"
                    )}
                  >
                    <IconComponent className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                    <span>{n.label}</span>
                  </Link>
                );
              })}

              {/* 3. Others Dropdown */}
              <div className="border-t border-border/50 pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => setShowOthers(!showOthers)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 rounded-2xl text-sm font-medium text-foreground/80 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span>Others</span>
                  </div>
                  <ChevronDown
                    className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", showOthers && "rotate-180")}
                  />
                </button>

                {showOthers && (
                  <div className="ml-3 pl-3 border-l border-border/70 flex flex-col gap-1 py-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        openEnquiryForm();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-primary hover:bg-muted"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span>Enquiry Form</span>
                    </button>
                    <a
                      href="#about"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground/80 hover:bg-muted"
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>About Us</span>
                    </a>
                    <a
                      href="#contact"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground/80 hover:bg-muted"
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Contact & Showroom</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
