import { ReactNode } from "react";
import { Link, NavLink as RRNavLink, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FolderTree, Package, LogOut, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const { user, loading, isStaff, isAdmin, signOut } = useAuth();
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
    { to: "/admin", end: true, label: "Overview", icon: LayoutDashboard },
    { to: "/admin/categories", label: "Categories", icon: FolderTree },
    { to: "/admin/products", label: "Products", icon: Package },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="container-page flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-3">
            <Logo className="h-9 w-auto" />
            <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:inline">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/" target="_blank"><ExternalLink className="mr-1 h-4 w-4" /> View site</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => signOut().then(() => navigate("/auth"))}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="container-page grid gap-6 py-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <nav className="flex gap-1 overflow-x-auto rounded-xl bg-card p-2 shadow-card-soft md:flex-col">
            {links.map((l) => (
              <RRNavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-smooth",
                    isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted"
                  )
                }
              >
                <l.icon className="h-4 w-4" /> {l.label}
              </RRNavLink>
            ))}
          </nav>
          <p className="mt-3 px-2 text-xs text-muted-foreground">
            Role: <span className="font-semibold text-foreground">{isAdmin ? "Admin" : "Staff"}</span>
          </p>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
};
