/**
 * Session timeout: auto sign-out after MAX_SESSION_MS of continuous login.
 *
 * Why: customer phones / shared store laptops often stay signed in for days,
 * which is a security risk. We enforce a 24h hard cap regardless of activity.
 *
 * How it works:
 * - On successful sign-in we stamp `mh_login_ts` in localStorage.
 * - On app boot + every minute we check `now - login_ts`.
 *   If exceeded, we sign out, clear the stamp, and redirect to /auth.
 * - Listens for `auth.onAuthStateChange` so a fresh login always resets
 *   the timer; logout clears it.
 */
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "mh_login_ts";
export const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

let started = false;

const stampNow = () => {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    /* storage may be blocked; ignore */
  }
};

const clearStamp = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

const forceLogout = async (reason = "Session expired") => {
  clearStamp();
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  // Only redirect when the user is on a protected page.
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const onProtected = path.startsWith("/admin");
    if (onProtected) {
      window.location.replace(`/auth?reason=${encodeURIComponent(reason)}`);
    }
  }
};

const checkExpiry = async () => {
  const raw = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  if (!raw) return;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) {
    clearStamp();
    return;
  }
  if (Date.now() - ts >= MAX_SESSION_MS) {
    await forceLogout();
  }
};

/**
 * Call once at app startup. Idempotent.
 */
export const initSessionTimeout = () => {
  if (started) return;
  started = true;

  // If we already have a session at boot but no stamp (older login), stamp now.
  // This makes the 24h timer start counting from "first time we see a session".
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) stampNow();
      } catch {
        /* ignore */
      }
      checkExpiry();
    }
  });

  // Reset timer on fresh login; clear on logout.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) stampNow();
    if (event === "SIGNED_OUT") clearStamp();
    if (event === "TOKEN_REFRESHED") {
      // do not extend the session window — we want a hard 24h cap
      checkExpiry();
    }
  });

  // Periodic check while tab is open.
  setInterval(checkExpiry, CHECK_INTERVAL_MS);

  // Also check when tab becomes visible again (laptop wake / phone unlock).
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkExpiry();
    });
  }
};