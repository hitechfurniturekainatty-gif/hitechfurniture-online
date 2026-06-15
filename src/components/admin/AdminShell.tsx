import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, NavLink as RRNavLink, useNavigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderTree, Package, LogOut, Loader2, ExternalLink, FileText, Users, HardHat, Ruler, UserCircle, Map, Truck, Route, LifeBuoy, Trash2, Home, ChevronDown, Briefcase, Boxes, UsersRound, Archive, Activity, GitBranch, BookOpen, Warehouse, Vault } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBacklogUnlocked, isBacklogMenuRevealed, revealBacklogMenu, lockBacklog } from "@/components/admin/BacklogGate";
import { HelpFab } from "@/components/help/HelpFab";
import { PipelineNotificationsBell } from "@/components/admin/PipelineNotificationsBell";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const { user, loading, isStaff, isAdmin, isOfficeStaff, isMeasurementStaff, isDelivery, isWorker, isWarehouse, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // IMPORTANT: All hooks must run on every render, BEFORE any early returns
  // below (loading / !user / !isStaff). Otherwise React throws
  // "Rendered more hooks than during the previous render" when `loading`
  // flips from true → false.
  // (group open-state is now handled per-section via <Collapsible defaultOpen>)

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
  const vault: SoloItem = { kind: "solo", to: "/admin/vault", label: "Credentials Vault", icon: Vault, show: isAdmin };

  const operations: GroupItem = {
    kind: "group", id: "operations", label: "Operations", icon: Briefcase,
    children: filt([
      { to: "/admin/quotations", label: "Quotations", icon: FileText, show: isOfficeStaff || isMeasurementStaff },
      { to: "/admin/quotations?status=stage1&lead=consultation", label: "Admin Tasks", icon: Activity, show: isOfficeStaff },
      { to: "/admin/pipeline", label: "Workflow Pipeline", icon: GitBranch, show: isAdmin },
      { to: "/admin/measurement-tasks", label: "Measurement Tasks", icon: Ruler, show: isOfficeStaff || isMeasurementStaff || isWorker },
      { to: "/admin/services", label: "Service & Complaints", icon: LifeBuoy, show: isOfficeStaff },
      { to: "/admin/scheme-calculator", label: "Scheme Calculator", icon: Activity, show: isOfficeStaff },
    ]),
  };
  const inventory: GroupItem = {
    kind: "group", id: "inventory", label: "Inventory", icon: Boxes,
    children: filt([
      { to: "/admin/categories", label: "Categories", icon: FolderTree, show: isOfficeStaff },
      { to: "/admin/products", label: "Products", icon: Package, show: isOfficeStaff },
      { to: "/admin/bundles", label: "Bundles / Sets", icon: Boxes, show: isOfficeStaff },
    ]),
  };
  const logistics: GroupItem = {
    kind: "group", id: "logistics", label: "Logistics & Delivery", icon: Map,
    children: filt([
      { to: "/admin/logistics", label: "Logistics", icon: Map, show: isOfficeStaff || isDelivery || isWarehouse },
      { to: "/admin/warehouse", label: "Warehouse", icon: Warehouse, show: isOfficeStaff || isDelivery || isWarehouse },
      { to: "/admin/trips", label: "Trips", icon: Truck, show: isOfficeStaff || isDelivery },
      { to: "/admin/routes", label: "Route Manager", icon: Route, show: isAdmin },
      { to: "/admin/vehicles", label: "Vehicles", icon: Truck, show: isAdmin },
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
    vault,
    trash,
    guide,
  ].filter((e) => (e.kind === "solo" ? e.show : e.children.length > 0));

  const isActiveTo = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/");

  const roleLabel = isAdmin
    ? "Admin"
    : isDelivery && !isOfficeStaff && !isMeasurementStaff
    ? "Delivery"
    : isMeasurementStaff && !isOfficeStaff
    ? "Measurement Staff"
    : "Staff";

  const handleSignOut = () => {
    lockBacklog();
    setBacklogUnlocked(false);
    signOut().then(() => navigate("/auth"));
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[hsl(var(--secondary)/0.3)]">
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3">
            <Link to="/" onClick={handleLogoTap} className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4)]">
                <Logo className="h-6 w-6" />
              </span>
              <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                <span className="font-display text-sm font-bold tracking-tight text-sidebar-foreground">My Hitech</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/55">Workspace</span>
              </span>
            </Link>
          </SidebarHeader>

          <SidebarContent className="px-1.5 py-2">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navEntries.map((entry) => {
                    if (entry.kind === "solo") {
                      const active = isActiveTo(entry.to, entry.end);
                      return (
                        <SidebarMenuItem key={entry.to}>
                          <SidebarMenuButton asChild isActive={active} tooltip={entry.label} className="h-10 rounded-lg font-medium">
                            <RRNavLink
                              to={entry.to}
                              end={entry.end}
                              onClick={(e) => {
                                if (entry.to === "/admin" && entry.end) handleOverviewTap?.(e as any);
                                if (entry.to === "/admin/backlog") {
                                  (window as any).__backlogIntent = Date.now();
                                }
                              }}
                            >
                              <entry.icon />
                              <span>{entry.label}</span>
                            </RRNavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                    const groupActive = entry.children.some((c) => isActiveTo(c.to, c.end));
                    return (
                      <Collapsible key={entry.id} defaultOpen={groupActive} className="group/coll">
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={groupActive}
                              tooltip={entry.label}
                              className="h-10 rounded-lg font-medium"
                            >
                              <entry.icon />
                              <span className="flex-1 text-left">{entry.label}</span>
                              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/coll:rotate-180" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {entry.children.map((c) => (
                                <SidebarMenuSubItem key={c.to}>
                                  <SidebarMenuSubButton asChild isActive={isActiveTo(c.to, c.end)}>
                                    <RRNavLink to={c.to} end={c.end}>
                                      <c.icon className="h-3.5 w-3.5" />
                                      <span>{c.label}</span>
                                    </RRNavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/60 px-2 py-2">
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserCircle className="h-4 w-4" />
              </span>
              <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-semibold text-sidebar-foreground">{user?.email ?? "Signed in"}</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/55">{roleLabel}</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex min-w-0 flex-col bg-transparent">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/80 px-3 backdrop-blur-md md:h-16 md:px-6">
            <SidebarTrigger className="h-9 w-9" />
            <Link to="/" className="ml-1 hidden items-center gap-2.5 sm:flex">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4)]">
                <Logo className="h-5 w-5" rounded={false} />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-display text-sm font-bold tracking-tight text-foreground">Admin Dashboard</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{roleLabel} workspace</span>
              </div>
            </Link>
            <div className="ml-1 flex flex-col leading-tight sm:hidden">
              <span className="font-display text-sm font-bold tracking-tight text-foreground">Dashboard</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{roleLabel}</span>
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Button asChild size="icon" variant="ghost" className="h-9 w-9 sm:hidden" aria-label="View site">
                <Link to="/" target="_blank"><ExternalLink className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/" target="_blank"><ExternalLink className="mr-1.5 h-4 w-4" /> View site</Link>
              </Button>
              <PipelineNotificationsBell />
              <Button size="icon" variant="ghost" className="h-9 w-9 sm:hidden" aria-label="Sign out" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={handleSignOut}>
                <LogOut className="mr-1.5 h-4 w-4" /> Sign out
              </Button>
            </div>
          </header>
          <main className="min-w-0 flex-1 px-3 py-4 md:px-6 md:py-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl animate-fade-in">{children}</div>
          </main>
        </SidebarInset>
        <HelpFab />
      </div>
    </SidebarProvider>
  );
};
