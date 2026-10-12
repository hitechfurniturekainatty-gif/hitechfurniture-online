import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { IDLE_LIMIT_MS, clearActivity, idleState, lastActivity, markActivity } from "@/lib/idleSession";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
/** Pages where a session is being created — never count stale time there. */
const isLoginPath = (p: string) => p.startsWith("/auth") || p.startsWith("/worker/login");

/**
 * Signs a logged-in user out of THIS device after 30 minutes with no taps,
 * typing or scrolling. Shows a one-minute warning first. Other devices of the
 * same user stay signed in (local scope).
 */
export function IdleLogout() {
  const { user, isWorker, isOfficeStaff, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [warn, setWarn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const lastWrite = useRef(0);
  const loggingOut = useRef(false);
  const workerOnly = isWorker && !isOfficeStaff && !isAdmin;

  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setWarn(false);
    clearActivity();
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* session may already be gone */ }
    toast({ title: "Logged out", description: `No activity for ${Math.round(IDLE_LIMIT_MS / 60000)} minutes — please sign in again.` });
    navigate(workerOnly ? "/worker/login" : "/auth", { replace: true });
    loggingOut.current = false;
  }, [navigate, workerOnly]);

  const check = useCallback(() => {
    if (!user || isLoginPath(location.pathname)) return;
    const last = lastActivity();
    if (last == null) { markActivity(); return; }
    const st = idleState(last);
    if (st === "expired") { void logout(); return; }
    setWarn(st === "warn");
    if (st === "warn") setSecondsLeft(Math.max(0, Math.ceil((last + IDLE_LIMIT_MS - Date.now()) / 1000)));
  }, [user, location.pathname, logout]);

  // On login pages, keep the timer fresh so a just-created session starts at zero.
  useEffect(() => { if (isLoginPath(location.pathname)) markActivity(); }, [location.pathname, user?.id]);

  useEffect(() => {
    if (!user) { setWarn(false); return; }
    const onActivity = () => {
      const now = Date.now();
      // If the device was idle past the limit (e.g. phone asleep), this first tap must not revive the session.
      if (!isLoginPath(location.pathname) && idleState(lastActivity(), now) === "expired") { void logout(); return; }
      if (now - lastWrite.current > 10_000) { lastWrite.current = now; markActivity(now); }
      setWarn(false);
    };
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    check();
    const t = window.setInterval(check, 5_000);
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.clearInterval(t);
    };
  }, [user, check, logout, location.pathname]);

  if (!user || !warn) return null;
  return (
    <div role="alertdialog" aria-live="assertive" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xl sm:bottom-6">
      <p className="text-sm font-semibold text-amber-950">You'll be logged out in {secondsLeft}s</p>
      <p className="mt-1 text-xs text-amber-900/80">No activity for a while. Tap below to stay signed in.</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => { markActivity(); setWarn(false); }}>Stay signed in</Button>
        <Button size="sm" variant="outline" onClick={() => void logout()}>Log out now</Button>
      </div>
    </div>
  );
}
