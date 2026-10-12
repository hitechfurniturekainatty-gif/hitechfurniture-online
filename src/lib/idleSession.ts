/**
 * Idle auto-logout bookkeeping. The last-activity time lives in localStorage
 * so every open tab on the device shares one timer, and a phone that slept
 * or an app reopened the next day is checked against the real elapsed time.
 */
export const IDLE_LIMIT_MS = 30 * 60 * 1000; // log out after 30 minutes with no activity
export const IDLE_WARN_MS = 60 * 1000;       // warn during the last minute
const KEY = "hitech_last_activity";

export function markActivity(at: number = Date.now()) {
  try { localStorage.setItem(KEY, String(at)); } catch { /* storage blocked: timer still runs in memory */ }
}

export function lastActivity(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearActivity() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** "ok" | "warn" | "expired" for a given last-activity time. */
export function idleState(last: number | null, now: number = Date.now()): "ok" | "warn" | "expired" {
  if (last == null) return "ok";
  const idle = now - last;
  if (idle >= IDLE_LIMIT_MS) return "expired";
  if (idle >= IDLE_LIMIT_MS - IDLE_WARN_MS) return "warn";
  return "ok";
}
