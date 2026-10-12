import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  VISIBILITY_SECTION_KEY, emptyVisibilityConfig, parseVisibilityConfig, isAllHidden, isItemHidden,
  isMainHidden, isSubHidden, DEFAULT_PUBLIC_MESSAGE, type CatalogVisibilityConfig, type VisibilityTarget,
} from "@/lib/publicCatalogVisibility";

type Loaded = { config: CatalogVisibilityConfig; legacyShow: boolean | null };

let cache: Promise<Loaded> | null = null;
const listeners = new Set<(l: Loaded) => void>();

async function fetchVisibility(): Promise<Loaded> {
  const [sec, settings] = await Promise.all([
    supabase.from("homepage_sections").select("body").eq("section_key", VISIBILITY_SECTION_KEY).maybeSingle(),
    supabase.from("homepage_settings").select("show_public_catalog").limit(1).maybeSingle(),
  ]);
  return {
    config: sec.error ? emptyVisibilityConfig() : parseVisibilityConfig(sec.data?.body ?? null),
    legacyShow: (settings.data as { show_public_catalog?: boolean } | null)?.show_public_catalog ?? null,
  };
}

/** Re-read the rules (call after the admin saves) and notify every mounted page. */
export async function refreshPublicCatalogVisibility() {
  cache = fetchVisibility();
  const l = await cache;
  listeners.forEach(fn => fn(l));
  return l;
}

/**
 * Public-catalog visibility for the current viewer. Staff (any logged-in
 * staff role) are never restricted: `restricted` is false for them.
 */
export function usePublicCatalogVisibility() {
  const { isStaff, isAdmin, loading: authLoading } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    if (!cache) cache = fetchVisibility();
    cache.then(l => { if (alive) setLoaded(l); }).catch(() => { if (alive) setLoaded({ config: emptyVisibilityConfig(), legacyShow: null }); });
    const fn = (l: Loaded) => { if (alive) setLoaded(l); };
    listeners.add(fn);
    // Scheduled windows start/end on their own — re-evaluate every minute.
    const t = window.setInterval(() => setLoaded(prev => (prev ? { ...prev } : prev)), 60_000);
    return () => { alive = false; listeners.delete(fn); window.clearInterval(t); };
  }, []);

  return useMemo(() => {
    const config = loaded?.config ?? emptyVisibilityConfig();
    const staff = !!(isStaff || isAdmin);
    const restricted = !staff;
    const allHiddenRaw = isAllHidden(config, loaded?.legacyShow);
    return {
      ready: !!loaded && !authLoading,
      config,
      isStaffViewer: staff,
      /** Whole catalog hidden for the public (always false for staff). */
      allHidden: restricted && allHiddenRaw,
      /** Whole catalog hidden for the public, regardless of viewer (for staff banners). */
      allHiddenForPublic: allHiddenRaw,
      message: config.message?.trim() || DEFAULT_PUBLIC_MESSAGE,
      hiddenUntil: config.all?.until ?? null,
      itemHidden: (t: VisibilityTarget) => restricted && (allHiddenRaw || isItemHidden(config, t)),
      itemHiddenForPublic: (t: VisibilityTarget) => allHiddenRaw || isItemHidden(config, t),
      mainHidden: (id: string) => restricted && (allHiddenRaw || isMainHidden(config, id)),
      subHidden: (s: { id: string; main_category_id: string }) => restricted && (allHiddenRaw || isSubHidden(config, s)),
    };
  }, [loaded, isStaff, isAdmin, authLoading]);
}
