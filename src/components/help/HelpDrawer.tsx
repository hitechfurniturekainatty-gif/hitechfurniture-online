import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { BookOpen, Search } from "lucide-react";
import { ROLE_MANUALS, roleLabel } from "@/lib/help/content";
import type { AppRole } from "@/hooks/useAuth";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: AppRole;
  /** Admin can preview other roles' manuals. */
  allowRoleSwitch?: boolean;
};

const ALL_ROLES: AppRole[] = ["admin", "staff", "measurement_staff", "worker", "delivery"];

export const HelpDrawer = ({ open, onOpenChange, role, allowRoleSwitch }: Props) => {
  const [activeRole, setActiveRole] = useState<AppRole>(role);
  const [q, setQ] = useState("");
  const [tipsOn, setTipsOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("help.tipsEnabled") !== "false";
  });

  const sections = useMemo(() => {
    const base = ROLE_MANUALS[activeRole] ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return base;
    return base
      .map((s) => ({ ...s, bullets: s.bullets.filter((b) => b.toLowerCase().includes(term)) }))
      .filter((s) => s.bullets.length > 0);
  }, [activeRole, q]);

  const toggleTips = (v: boolean) => {
    setTipsOn(v);
    try { window.localStorage.setItem("help.tipsEnabled", v ? "true" : "false"); } catch { /* ignore */ }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-display">
            <BookOpen className="h-5 w-5 text-primary" /> Help & User Manual
          </SheetTitle>
          <SheetDescription>
            Personalised for your role: <span className="font-semibold text-foreground">{roleLabel(activeRole)}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the manual…" className="h-9 pl-8 text-sm" />
          </div>
          {allowRoleSwitch && (
            <div className="flex flex-wrap gap-1.5">
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveRole(r)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                    r === activeRole
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {roleLabel(r)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {sections.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No help topics match "{q}".</p>
          )}
          {sections.map((s) => (
            <section key={s.title} className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-foreground">{s.title}</h3>
              <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="shrink-0 space-y-3 border-t border-border px-5 py-3">
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
            <div>
              <Label htmlFor="help-tips-toggle" className="text-xs font-semibold">Show field tooltips</Label>
              <p className="text-[11px] text-muted-foreground">The small (?) icons next to inputs across the app.</p>
            </div>
            <Switch id="help-tips-toggle" checked={tipsOn} onCheckedChange={toggleTips} />
          </div>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/guide" onClick={() => onOpenChange(false)}>Open full user guide</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HelpDrawer;