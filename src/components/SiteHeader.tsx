import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const SiteHeader = () => {
  const { user, isStaff } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const nav = [
    { to: "/", label: "Home" },
    { to: "/catalog", label: "Catalog" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <Logo className="h-9 w-auto md:h-11" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "text-sm font-medium tracking-wide transition-smooth hover:text-primary",
                location.pathname === n.to ? "text-primary" : "text-foreground/70"
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {isStaff ? (
            <Button asChild variant="default" size="sm">
              <Link to="/admin">Dashboard</Link>
            </Button>
          ) : user ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Dashboard</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Staff Login</Link>
            </Button>
          )}
        </div>

        <button
          aria-label="Toggle menu"
          className="md:hidden p-2 rounded-md hover:bg-muted"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background">
          <div className="container-page flex flex-col gap-1 py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to={isStaff || user ? "/admin" : "/auth"}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-semibold text-primary hover:bg-muted"
            >
              {isStaff || user ? "Dashboard" : "Staff Login"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
