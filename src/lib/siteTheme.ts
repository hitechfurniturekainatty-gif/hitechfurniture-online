// Admin-editable public website theme (stored in homepage_settings.theme jsonb).
import { supabase } from "@/integrations/supabase/client";

export type SiteTheme = {
  background?: string; // hex
  foreground?: string;
  card?: string;
  primary?: string;
  primaryForeground?: string;
  accent?: string;
  secondary?: string;
  muted?: string;
  border?: string;
  radius?: number; // rem
  borderWidth?: number; // px
  headingAlign?: "default" | "left" | "center";
  textAlign?: "default" | "left" | "center";
};

export const DEFAULT_THEME: Required<SiteTheme> = {
  background: "#fbf9f5",
  foreground: "#2a2622",
  card: "#ffffff",
  primary: "#5e2b05",
  primaryForeground: "#fbf9f5",
  accent: "#f39b02",
  secondary: "#efebe3",
  muted: "#f0ede7",
  border: "#e1d6ca",
  radius: 0.75,
  borderWidth: 1,
  headingAlign: "default",
  textAlign: "default",
};

const CACHE_KEY = "hitech_site_theme_v1";

export function hexToHsl(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

const VAR_MAP: [keyof SiteTheme, string[]][] = [
  ["background", ["--background", "--sidebar-background"]],
  ["foreground", ["--foreground", "--card-foreground", "--popover-foreground"]],
  ["card", ["--card", "--popover"]],
  ["primary", ["--primary", "--ring", "--sidebar-primary"]],
  ["primaryForeground", ["--primary-foreground"]],
  ["accent", ["--accent"]],
  ["secondary", ["--secondary", "--sidebar-accent"]],
  ["muted", ["--muted"]],
  ["border", ["--border", "--sidebar-border"]],
];

/** Applies only values that differ from defaults, so an empty theme = original site. */
export function applySiteTheme(theme: SiteTheme | null | undefined) {
  const root = document.documentElement;
  const t = theme ?? {};
  for (const [key, vars] of VAR_MAP) {
    const v = t[key] as string | undefined;
    const hsl = v && v.toLowerCase() !== (DEFAULT_THEME[key] as string) ? hexToHsl(v) : null;
    vars.forEach((cv) => (hsl ? root.style.setProperty(cv, hsl) : root.style.removeProperty(cv)));
  }
  if (typeof t.radius === "number") root.style.setProperty("--radius", `${t.radius}rem`);
  else root.style.removeProperty("--radius");
  root.style.setProperty("--site-border-width", `${t.borderWidth ?? 1}px`);
  root.dataset.headingAlign = t.headingAlign ?? "default";
  root.dataset.textAlign = t.textAlign ?? "default";
}

export function applyCachedTheme() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) applySiteTheme(JSON.parse(raw));
  } catch { /* ignore */ }
}

export function cacheTheme(theme: SiteTheme) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(theme)); } catch { /* ignore */ }
}

export async function loadAndApplySiteTheme() {
  applyCachedTheme();
  const { data } = await supabase.from("homepage_settings").select("theme").limit(1).maybeSingle();
  const theme = ((data as { theme?: SiteTheme } | null)?.theme ?? {}) as SiteTheme;
  applySiteTheme(theme);
  cacheTheme(theme);
}

/** Keep other open tabs of the website in sync when an admin saves a theme. */
export function listenForThemeChanges() {
  try {
    window.addEventListener("storage", (e) => {
      if (e.key === CACHE_KEY && e.newValue) {
        try { applySiteTheme(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    });
  } catch { /* ignore */ }
}
