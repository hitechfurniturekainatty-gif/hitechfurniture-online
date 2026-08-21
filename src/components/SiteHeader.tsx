import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
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

  // ക്ലിക്ക് ഔട്ട്സൈഡ് ക്ലോസ്
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

  // പേജ് മാറുമ്പോൾ ക്ലോസ് ആവാൻ
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="container-page relative flex items-center justify-between py-3 md:py-4" ref={headerRef}>
        
        {/* Brand Logo (Left) */}
        <Link to="/" aria-label="Hitech Furniture & Interiors — Home" className="flex items-center gap-3">
          <Logo className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14" />
        </Link>

        {/* Right Section: Enquiry Form + 3-Line Menu */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          
          {/* 1. Enquiry Form Button (3-ലൈനിന്റെ തൊട്ടിപ്പുറത്ത് സ്ഥിരമായി) */}
          <Button
            type="button"
            size="sm"
            onClick={() => openEnquiryForm()}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#0f5156] hover:bg-[#0b3d41] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all active:scale-95"
          >
            <ClipboardList className="h-4 w-4" />
            <span>Enquiry Form</span>
          </Button>

          {/* 2. 3-Line Hamburger Menu Button */}
          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            className={cn(
              "inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 transition-all duration-200 hover:bg-slate-100 active:scale-95",
              open && "bg-slate-100 text-[#0f5156] border-[#0f5156]/40 shadow-sm"
            )}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* 100% Solid White Floating Card (വ്യക്തമായി കാണുന്ന ഫുൾ വൈറ്റ് ബോക്സ്) */}
        {open && (
          <div className="absolute right-4 sm:right-6 top-[calc(100%+0.5rem)] w-64 max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-150 z-50">
            
            {/* Staff Login / Dashboard */}
            <Link
              to={isStaff || user ? "/admin" : "/auth"}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 mb-2 rounded-2xl bg-[#0f5156] hover:bg-[#0b3d41] text-white font-semibold text-sm shadow-sm transition-all"
            >
              {isStaff || user ? (
                <LayoutDashboard className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
              <span>{isStaff || user ? "Dashboard" : "Staff Login"}</span>
            </Link>

            {/* Home & Catalog Links (Solid Dark Text) */}
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
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-colors",
                      isActive 
                        ? "bg-slate-100 text-[#0f5156]" 
                        : "text-slate-800 hover:bg-slate-100 hover:text-[#0f5156]"
                    )}
                  >
                    <IconComponent className={cn("h-4 w-4", isActive ? "text-[#0f5156]" : "text-slate-600")} />
                    <span>{n.label}</span>
                  </Link>
                );
              })}

              {/* Others Submenu */}
              <div className="border-t border-slate-100 pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => setShowOthers(!showOthers)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 rounded-2xl text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:text-[#0f5156] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Info className="h-4 w-4 text-slate-600" />
                    <span>Others</span>
                  </div>
                  <ChevronDown
                    className={cn("h-4 w-4 text-slate-600 transition-transform duration-200", showOthers && "rotate-180")}
                  />
                </button>

                {showOthers && (
                  <div className="ml-3 pl-3 border-l-2 border-slate-200 flex flex-col gap-1 py-1 mt-1">
                    <a
                      href="#about"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#0f5156]"
                    >
                      <Info className="h-3.5 w-3.5 text-slate-500" />
                      <span>About Us</span>
                    </a>
                    <a
                      href="#contact"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-[#0f5156]"
                    >
                      <Phone className="h-3.5 w-3.5 text-slate-500" />
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
