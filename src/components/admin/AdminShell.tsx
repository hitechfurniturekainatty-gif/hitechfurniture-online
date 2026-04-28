import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, NavLink as RRNavLink, useNavigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderTree, Package, LogOut, Loader2, ExternalLink, FileText, Users, HardHat, Ruler, UserCircle, Map, Truck, Route, LifeBuoy, Trash2, Home, ChevronDown, Briefcase, Boxes, UsersRound, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const { user, loading, isStaff, isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWorker, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // IMPORTANT: All hooks must run on every render, BEFORE any early returns
  // below (loading / !user / !isStaff). Otherwise React throws
  // "Rendered more hooks than during the previous render" when `loading`
  // flips from true → false.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Triple-tap on the admin logo opens the hidden Backlog area.
  // Works on both desktop (clicks) and mobile (taps) within ~600ms window.
  const tapsRef = useRef<number[]>([]);
  const handleLogoTap = (e: React.MouseEvent) => {
    const now = Date.now();
    tapsRef.current = tapsRef.current.filter((t) => now - t < 600);
    tapsRef.current.push(now);
    if (tapsRef.current.length >= 3) {
      e.preventDefault();
      tapsRef.current = [];
      navigate("/admin/backlog");
    }
  };

  // Auto-open the sidebar group containing the current route. Declared at the
  // top of the component (before early returns) so hook order stays stable.
  useEffect(() => {
    const path = location.pathname;
    const groups: Record<string, string[]> = {
      operations: ["/admin/quotations", "/admin/measurement-tasks", "/admin/services"],
      inventory: ["/admin/categories", "/admin/products"],
      logistics: ["/admin/logistics", "/admin/trips", "/admin/routes"],
      team: ["/admin/staff", "/admin/workers"],
    };
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const [id, paths] of Object.entries(groups)) {
        if (paths.some((p) => path === p || path.startsWith(p + "/"))) next[id] = true;
      }
      return next;
    });
  }, [location.pathname]);

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

  type LinkItem = { to: string; end?: boolean; label: string; icon: any; show: boolean };
  type GroupItem = { kind: "group"; id: string; label: string; icon: any; children: LinkItem[] };
  type SoloItem = { kind: "solo" } & LinkItem;
  type NavEntry = GroupItem | SoloItem;

  const filt = (arr: LinkItem[]) => arr.filter((l) => l.show);

  const overview: SoloItem = { kind: "solo", to: "/admin", end: true, label: "Overview", icon: LayoutDashboard, show: isOfficeStaff };
  const myWork: SoloItem = { kind: "solo", to: "/admin/my-work", label: "My Work", icon: UserCircle, show: true };
  const myTrips: SoloItem = { kind: "solo", to: "/admin/my-trips", label: "My Trips", icon: Truck, show: isDelivery && !isOfficeStaff };
  const homePage: SoloItem = { kind: "solo", to: "/admin/home-page", label: "Home Page", icon: Home, show: isAdmin };
  const backlog: SoloItem = { kind: "solo", to: "/admin/backlog", label: "Backlog", icon: Archive, show: isAdmin };
  const trash: SoloItem = { kind: "solo", to: "/admin/trash", label: "Trash", icon: Trash2, show: isAdmin };

  const operations: GroupItem = {
    kind: "group", id: "operations", label: "Operations", icon: Briefcase,
    children: filt([
      { to: "/admin/quotations", label: "Quotations", icon: FileText, show: isOfficeStaff || isMeasurementStaff },
      { to: "/admin/measurement-tasks", label: "Measurement Tasks", icon: Ruler, show: isOfficeStaff || isMeasurementStaff },
      { to: "/admin/services", label: "Service & Complaints", icon: LifeBuoy, show: isOfficeStaff },
    ]),
  };
  const inventory: GroupItem = {
    kind: "group", id: "inventory", label: "Inventory", icon: Boxes,
    children: filt([
      { to: "/admin/categories", label: "Categories", icon: FolderTree, show: isAdmin },
      { to: "/admin/products", label: "Products", icon: Package, show: isAdmin },
    ]),
  };
  const logistics: GroupItem = {
    kind: "group", id: "logistics", label: "Logistics & Delivery", icon: Map,
    children: filt([
      { to: "/admin/logistics", label: "Logistics", icon: Map, show: isOfficeStaff },
      { to: "/admin/trips", label: "Trips", icon: Truck, show: isOfficeStaff },
      { to: "/admin/routes", label: "Route Manager", icon: Route, show: isAdmin },
    ]),
  };
  const team: GroupItem = {
    kind: "group", id: "team", label: "Team Management", icon: UsersRound,
    children: filt([
      { to: "/admin/staff", label: "Staff Management", icon: Users, show: isAdmin },
      { to: "/admin/workers", label: "Workers", icon: HardHat, show: isAdmin },
    ]),
  };

  const navEntries: NavEntry[] = [
    overview,
    myWork,
    myTrips,
    operations,
    inventory,
    logistics,
    team,
    homePage,
    trash,
  ].filter((e) => (e.kind === "solo" ? e.show : e.children.length > 0));

  const isActiveTo = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen overflow-x-hidden bg-secondary/30">
      <header className="sticky top-0 z-30 border-b border-border bg-card shadow-card-soft">
        <div className="container-page flex items-center justify-between gap-2 py-3 md:py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3" onClick={handleLogoTap}>
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
            {navEntries.map((entry) => {
              if (entry.kind === "solo") {
                return (
                  <RRNavLink
                    key={entry.to}
                    to={entry.to}
                    end={entry.end}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                        isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted active:bg-muted"
                      )
                    }
                  >
                    <entry.icon className="h-4 w-4" /> {entry.label}
                  </RRNavLink>
                );
              }
              const open = !!openGroups[entry.id];
              const groupActive = entry.children.some((c) => isActiveTo(c.to, c.end));
              return (
                <div key={entry.id} className="shrink-0 md:w-full">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((p) => ({ ...p, [entry.id]: !p[entry.id] }))}
                    aria-expanded={open}
                    className={cn(
                      "flex min-h-[44px] w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                      groupActive ? "bg-muted text-foreground" : "text-foreground/70 hover:bg-muted active:bg-muted"
                    )}
                  >
                    <entry.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{entry.label}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="mt-1 flex gap-1 md:ml-3 md:mt-1 md:flex-col md:border-l md:border-border md:pl-2">
                      {entry.children.map((c) => (
                        <RRNavLink
                          key={c.to}
                          to={c.to}
                          end={c.end}
                          className={({ isActive }) =>
                            cn(
                              "flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-smooth",
                              isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted active:bg-muted"
                            )
                          }
                        >
                          <c.icon className="h-4 w-4" /> {c.label}
                        </RRNavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
