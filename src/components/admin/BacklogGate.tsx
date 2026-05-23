import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Lock, KeyRound, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const SS_KEY = "backlog_unlock_until";
// Unlock is valid while the Backlog screen is mounted AND the admin keeps
// interacting with it. After 10 minutes of inactivity the gate auto-locks
// and the PIN is required again. Navigating away (back button, sidebar
// link, closing the tab) also locks immediately via the unmount cleanup.
const UNLOCK_MS = 10 * 60 * 1000;

export function refreshBacklogUnlock() {
  try {
    if (((window as any).__backlogUnlockUntil ?? 0) > Date.now()) {
      (window as any).__backlogUnlockUntil = Date.now() + UNLOCK_MS;
    }
  } catch { /* ignore */ }
}

export function isBacklogUnlocked(): boolean {
  try {
    // Use in-memory only — never sessionStorage — so refresh / re-entry
    // always re-prompts for the PIN.
    const v = (window as any).__backlogUnlockUntil as number | undefined;
    if (!v) return false;
    return v > Date.now();
  } catch {
    return false;
  }
}

function unlockNow() {
  try {
    (window as any).__backlogUnlockUntil = Date.now() + UNLOCK_MS;
  } catch {
    /* ignore */
  }
}

/**
 * Reveal the Backlog menu item without navigating into the gated page.
 * NOTE: this only flips the sidebar visibility flag — the gated route still
 * requires the PIN on first entry within the 15-minute window.
 */
export function revealBacklogMenu() {
  try {
    // Reveal the sidebar shortcut for a short window (15 min). Entering the
    // page itself still requires the PIN every time.
    (window as any).__backlogRevealUntil = Date.now() + 15 * 60 * 1000;
  } catch { /* ignore */ }
}

export function isBacklogMenuRevealed(): boolean {
  try {
    if (isBacklogUnlocked()) return true;
    const v = (window as any).__backlogRevealUntil as number | undefined;
    if (!v) return false;
    return v > Date.now();
  } catch {
    return false;
  }
}

export function lockBacklog() {
  try {
    (window as any).__backlogUnlockUntil = 0;
    (window as any).__backlogRevealUntil = 0;
  } catch { /* ignore */ }
}

/**
 * Wraps confidential admin content (Receivables) and gates it behind a PIN.
 * - Admin-only (silently 404 for non-admins)
 * - 30-minute session unlock after correct PIN
 * - First-time setup flow if no PIN has been configured yet
 */
export function BacklogGate({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unlocked, setUnlocked] = useState<boolean>(() => isBacklogUnlocked());
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("backlog_pin_is_set");
      if (!alive) return;
      if (error) { setPinSet(false); return; }
      setPinSet(!!data);
    })();
    return () => { alive = false; };
  }, [isAdmin]);

  // Re-evaluate the unlock state on a short interval so the 15-minute window
  // is enforced in real time without requiring a page refresh. Also react to
  // sign-out events from other tabs (sessionStorage cleared) and to the tab
  // becoming visible again.
  useEffect(() => {
    const tick = () => setUnlocked(isBacklogUnlocked());
    const id = window.setInterval(tick, 5000);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Sliding 10-minute idle timeout: any pointer / keyboard / scroll activity
  // inside the Backlog area pushes the auto-lock further out.
  useEffect(() => {
    if (!unlocked) return;
    const bump = () => refreshBacklogUnlock();
    const events: (keyof DocumentEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => document.addEventListener(ev, bump, { passive: true } as any));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, bump as any));
    };
  }, [unlocked]);

  // SINGLE-ENTRY ACCESS: revoke unlock the moment this gate unmounts (the
  // user navigated to Home, another admin tab, or anywhere else). The next
  // time they click "Backlog", the PIN will be required again.
  useEffect(() => {
    return () => {
      (window as any).__backlogUnlockUntil = 0;
      setUnlocked(false);
    };
  }, []);

  // Also revoke if the route path changes away from /admin/backlog while the
  // gate stays mounted for any reason.
  useEffect(() => {
    if (!location.pathname.startsWith("/admin/backlog") && !location.pathname.startsWith("/admin/receivables")) {
      (window as any).__backlogUnlockUntil = 0;
      setUnlocked(false);
    }
  }, [location.pathname]);

  // On (re-)mount, ensure we start from a locked state — the PIN must be
  // entered for every fresh visit. The unlock is then granted by onSubmit
  // and persists in-memory while the gate stays mounted.
  useEffect(() => {
    if (!isBacklogUnlocked()) setUnlocked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authLoading || (isAdmin && pinSet === null && !unlocked)) {
    return (
      <AdminShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  // Hide existence from non-admins entirely.
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="font-display text-3xl">404</h1>
        <p className="text-sm text-muted-foreground">The page you are looking for does not exist.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!pin.trim()) {
      toast({ title: "Enter PIN", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (pinSet === false) {
        // First-time setup
        if (pin.length < 4) {
          toast({ title: "PIN too short", description: "Minimum 4 characters.", variant: "destructive" });
          return;
        }
        if (pin !== pin2) {
          toast({ title: "PINs do not match", variant: "destructive" });
          return;
        }
        const { error } = await supabase.rpc("set_backlog_pin", { _pin: pin });
        if (error) throw error;
        unlockNow();
        toast({ title: "Backlog PIN set", description: "Unlocked for 30 minutes." });
        // Stay on the Backlog page; just flip unlocked state.
        setUnlocked(true);
        return;
      } else {
        const { data, error } = await supabase.rpc("verify_backlog_pin", { _pin: pin });
        if (error) throw error;
        if (!data) {
          toast({ title: "Incorrect PIN", variant: "destructive" });
          return;
        }
        unlockNow();
        setUnlocked(true);
        return;
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
      setPin("");
      setPin2("");
    }
  };

  return (
    <AdminShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-7 w-7" />
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Backlog · Restricted Area
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pinSet === false && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>No PIN is set yet. Create a secondary PIN now to protect the Backlog area. You can change it later in Staff Management.</span>
              </div>
            )}
            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder={pinSet === false ? "New PIN (min 4)" : "Enter PIN"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="text-center tracking-widest"
              />
              {pinSet === false && (
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Confirm PIN"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value)}
                  className="text-center tracking-widest"
                />
              )}
              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {pinSet === false ? "Set PIN & unlock" : "Unlock"}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Stays unlocked while you're using this page. Auto-locks after 10 minutes of inactivity, when you leave the page, or on sign-out.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
