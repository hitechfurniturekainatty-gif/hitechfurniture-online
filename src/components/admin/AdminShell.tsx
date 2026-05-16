import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, NavLink as RRNavLink, useNavigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderTree, Package, LogOut, Loader2, ExternalLink, FileText, Users, HardHat, Ruler, UserCircle, Map, Truck, Route, LifeBuoy, Trash2, Home, ChevronDown, Briefcase, Boxes, UsersRound, Archive, Activity, GitBranch, BookOpen, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBacklogUnlocked, isBacklogMenuRevealed, revealBacklogMenu, lockBacklog } from "@/components/admin/BacklogGate";
import { HelpFab } from "@/components/help/HelpFab";
import { PipelineNotificationsBell } from "@/components/admin/PipelineNotificationsBell";

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const { user, loading, isStaff, isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWorker, isWarehouse, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // IMPORTANT: All hooks must run on every render, BEFORE any early returns
  // below (loading / !user / !isStaff). Otherwise React throws
  // "Rendered more hooks than during the previous render" when `loading`
  // flips from true → false.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Track Backlog unlock state so the sidebar item disappears the moment the
  // 15-minute window expires (or the admin signs out). Re-check every 5s.
  const [backlogUnlocked, setBacklogUnlocked] = useState<boolean>(() => isBacklogMenuRevealed());
  useEffect(() => {
    const tick = () => setBacklogUnlocked(isBacklogMenuRevealed());
    tick();
    const id = window.setInterval(tick, 5000);
    const onVis = () => tick();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "backlog_unlock_until") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Triple-tap on the admin logo opens the hidden Backlog area.
  // Works on both desktop (clicks) and mobile (taps) within a ~700ms window.
  // We always preventDefault on the logo link so the first/second click does
  // not navigate to "/" before the third tap is registered. A short timer
  // performs the normal navigation if fewer than 3 taps happen in the window.
  const tapsRef = useRef<number[]>([]);
  const tapTimerRef = useRef<number | null>(null);
  const handleLogoTap = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = Date.now();
    tapsRef.current = tapsRef.current.filter((t) => now - t < 700);
    tapsRef.current.push(now);
    if (tapTimerRef.current) {
      window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
    if (tapsRef.current.length >= 3) {
      tapsRef.current = [];
      // Reveal the Backlog menu in the sidebar but route the user to the
      // Overview page — safer if anyone is watching the screen. Admin can
      // then click "Backlog" from the sidebar when ready.
      revealBacklogMenu();
      setBacklogUnlocked(true);
      navigate("/admin");
      return;
    }
    // Fall back to normal "go home" navigation if the user didn't triple-tap.
    tapTimerRef.current = window.setTimeout(() => {
      tapsRef.current = [];
      tapTimerRef.current = null;
      navigate("/");
    }, 350);
  };

  // Triple-tap on the "Overview" sidebar item also reveals the Backlog menu.
  // This is the primary trigger admins use — easier to hit than the logo.
  const overviewTapsRef = useRef<number[]>([]);
  const handleOverviewTap = (e: React.MouseEvent) => {
    const now = Date.now();
    overviewTapsRef.current = overviewTapsRef.current.filter((t) => now - t < 700);
    overviewTapsRef.current.push(now);
    if (overviewTapsRef.current.length >= 3) {
      overviewTapsRef.current = [];
      revealBacklogMenu();
      setBacklogUnlocked(true);
    }
    // Don't preventDefault — normal navigation to /admin still happens.
  };

  // Auto-open the sidebar group containing the current route. Declared at the
  // top of the component (before early returns) so hook order stays stable.
  useEffect(() => {
    const path = location.pathname;
    const groups: Record<string, string[]> = {
      operations: ["/admin/quotations", "/admin/pipeline", "/admin/measurement-tasks", "/admin/services"],
      inventory: ["/admin/categories", "/admin/products"],
      logistics: ["/admin/logistics", "/admin/trips", "/admin/routes"],
      team: ["/admin/staff", "/admin/workers", "/admin/staff-monitor"],
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
  const guide: SoloItem = { kind: "solo", to: "/guide", label: "User Guide", icon: BookOpen, show: true };
  // Only show Backlog in the sidebar while it is currently unlocked. After the
  // 15-min auto-lock or sign-out, the menu disappears entirely — the area is
  // then only reachable again via the triple-tap on the logo.
  const backlog: SoloItem = { kind: "solo", to: "/admin/backlog", label: "Backlog", icon: Archive, show: isAdmin && backlogUnlocked };
  const trash: SoloItem = { kind: "solo", to: "/admin/trash", label: "Trash", icon: Trash2, show: isAdmin };

  const operations: GroupItem = {
    kind: "group", id: "operations", label: "Operations", icon: Briefcase,
    children: filt([
      { to: "/admin/quotations", label: "Quotations", icon: FileText, show: isOfficeStaff || isMeasurementStaff },
      { to: "/admin/quotations?status=stage1&lead=consultation", label: "Admin Tasks", icon: Activity, show: isOfficeStaff },
      { to: "/admin/pipeline", label: "Workflow Pipeline", icon: GitBranch, show: isAdmin },
      { to: "/admin/measurement-tasks", label: "Measurement Tasks", icon: Ruler, show: isOfficeStaff || isMeasurementStaff || isWorker },
      { to: "/admin/services", label: "Service & Complaints", icon: LifeBuoy, show: isOfficeStaff },
    ]),
  };
  const inventory: GroupItem = {
    kind: "group", id: "inventory", label: "Inventory", icon: Boxes,
    children: filt([
      { to: "/admin/categories", label: "Categories", icon: FolderTree, show: isAdmin },
      { to: "/admin/products", label: "Products", icon: Package, show: isAdmin },
      { to: "/admin/bundles", label: "Bundles / Sets", icon: Boxes, show: isAdmin },
    ]),
  };
  const logistics: GroupItem = {
    kind: "group", id: "logistics", label: "Logistics & Delivery", icon: Map,
    children: filt([
      { to: "/admin/logistics", label: "Logistics", icon: Map, show: isOfficeStaff || isDelivery || isWarehouse },
      { to: "/admin/warehouse", label: "Warehouse", icon: Warehouse, show: isOfficeStaff || isDelivery || isWarehouse },
      { to: "/admin/trips", label: "Trips", icon: Truck, show: isOfficeStaff || isDelivery },
      { to: "/admin/routes", label: "Route Manager", icon: Route, show: isAdmin },
    ]),
  };
  const team: GroupItem = {
    kind: "group", id: "team", label: "Team Management", icon: UsersRound,
    children: filt([
      { to: "/admin/staff", label: "Staff Management", icon: Users, show: isAdmin },
      { to: "/admin/staff-monitor", label: "Staff Monitor", icon: Activity, show: isAdmin },
      { to: "/admin/workers", label: "Production Unit", icon: HardHat, show: isAdmin },
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
    backlog,
    trash,
    guide,
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
            <PipelineNotificationsBell />
            <Button size="icon" variant="ghost" className="h-11 w-11 sm:hidden" aria-label="Sign out" onClick={() => { lockBacklog(); setBacklogUnlocked(false); signOut().then(() => navigate("/auth")); }}>
              <LogOut className="h-5 w-5" />
            </Button>
            <Button size="default" variant="ghost" className="hidden sm:inline-flex text-base" onClick={() => { lockBacklog(); setBacklogUnlocked(false); signOut().then(() => navigate("/auth")); }}>
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
                    onClick={(e) => {
                      if (entry.to === "/admin" && entry.end) handleOverviewTap?.(e as any);
                      if (entry.to === "/admin/backlog") {
                        (window as any).__backlogIntent = Date.now();
                      }
                    }}
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
      <HelpFab />
    </div>
  );
};
