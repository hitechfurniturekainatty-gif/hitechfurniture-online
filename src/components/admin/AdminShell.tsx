import { ReactNode } from "react";
import { Link, NavLink as RRNavLink, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderTree, Package, LogOut, Loader2, ExternalLink, FileText, Users, HardHat, Ruler, UserCircle, Map, Truck, Route, LifeBuoy, Trash2, Home, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const { user, loading, isStaff, isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWorker, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }
  // Workers must never see the admin dashboard. Their portal is /worker.
  if (isWorker && !isOfficeStaff && !isAdmin && !isMeasurementStaff && !isDelivery) {
    navigate("/worker", { replace: true });
    return null;
  }
  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl">Access pending</h1>
        <p className="max-w-md text-muted-foreground">
          Your account doesn't have staff access yet. Ask an admin to assign you a role.
        </p>
        <Button variant="outline" onClick={() => signOut().then(() => navigate("/auth"))}>Sign out</Button>
      </div>
    );
  }

  const links = [
    { to: "/admin", end: true, label: "Overview", icon: LayoutDashboard, show: isOfficeStaff },
    { to: "/admin/my-work", label: "My Work", icon: UserCircle, show: true },
    { to: "/admin/quotations", label: "Quotations", icon: FileText, show: isOfficeStaff || isMeasurementStaff },
    { to: "/admin/measurement-tasks", label: "Measurement Tasks", icon: Ruler, show: isOfficeStaff || isMeasurementStaff },
    { to: "/admin/services", label: "Service & Complaints", icon: LifeBuoy, show: isOfficeStaff },
    { to: "/admin/receivables", label: "Receivables", icon: Wallet, show: isAdmin },
    { to: "/admin/logistics", label: "Logistics", icon: Map, show: isOfficeStaff },
    { to: "/admin/trips", label: "Trips", icon: Truck, show: isOfficeStaff },
    { to: "/admin/my-trips", label: "My Trips", icon: Truck, show: isDelivery && !isOfficeStaff },
    { to: "/admin/routes", label: "Route Manager", icon: Route, show: isAdmin },
    { to: "/admin/workers", label: "Workers", icon: HardHat, show: isAdmin },
    { to: "/admin/categories", label: "Categories", icon: FolderTree, show: isAdmin },
    { to: "/admin/products", label: "Products", icon: Package, show: isAdmin },
    { to: "/admin/home-page", label: "Home Page", icon: Home, show: isAdmin },
    { to: "/admin/staff", label: "Staff Management", icon: Users, show: isAdmin },
    { to: "/admin/trash", label: "Trash", icon: Trash2, show: isAdmin },
  ].filter((l) => l.show);

  return (
    <div className="min-h-screen overflow-x-hidden bg-secondary/30">
      <header className="sticky top-0 z-30 border-b border-border bg-card shadow-card-soft">
        <div className="container-page flex items-center justify-between gap-2 py-3 md:py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <Logo className="h-11 w-auto sm:h-12 md:h-14" />
            <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:inline">Dashboard</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button asChild size="icon" variant="ghost" className="h-11 w-11 sm:hidden" aria-label="View site">
              <Link to="/" target="_blank"><ExternalLink className="h-5 w-5" /></Link>
            </Button>
            <Button asChild size="default" variant="ghost" className="hidden sm:inline-flex text-base">
              <Link to="/" target="_blank"><ExternalLink className="mr-1 h-5 w-5" /> View site</Link>
            </Button>
            <Button size="icon" variant="ghost" className="h-11 w-11 sm:hidden" aria-label="Sign out" onClick={() => signOut().then(() => navigate("/auth"))}>
              <LogOut className="h-5 w-5" />
            </Button>
            <Button size="default" variant="ghost" className="hidden sm:inline-flex text-base" onClick={() => signOut().then(() => navigate("/auth"))}>
              <LogOut className="mr-1 h-5 w-5" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="container-page grid gap-4 py-4 md:grid-cols-[220px_1fr] md:gap-6 md:py-6">
        <aside className="min-w-0 md:sticky md:top-20 md:self-start">
          <nav
            className="flex w-full max-w-full gap-1 overflow-x-auto rounded-xl bg-card p-2 shadow-card-soft md:flex-col [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Admin navigation"
          >
            {links.map((l) => (
              <RRNavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                    isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted active:bg-muted"
                  )
                }
              >
                <l.icon className="h-4 w-4" /> {l.label}
              </RRNavLink>
            ))}
          </nav>
          <p className="mt-3 hidden px-2 text-xs text-muted-foreground md:block">
            Role: <span className="font-semibold text-foreground">{
              isAdmin ? "Admin"
                : isDelivery && !isOfficeStaff && !isMeasurementStaff ? "Delivery"
                : isMeasurementStaff && !isOfficeStaff ? "Measurement Staff"
                : "Staff"
            }</span>
          </p>
        </aside>
        <main className="min-w-0 pb-6">{children}</main>
      </div>
    </div>
  );
};
