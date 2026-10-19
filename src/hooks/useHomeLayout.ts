import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HOME_LAYOUT_KEY, emptyHomeLayout, parseHomeLayout, type HomeLayout } from "@/lib/homeLayout";

let cache: Promise<string | null> | null = null;

/** Raw saved layout JSON (null = never saved). */
export function loadHomeLayoutBody(force = false): Promise<string | null> {
  if (!cache || force) {
    cache = Promise.resolve(
      supabase.from("homepage_sections").select("body").eq("section_key", HOME_LAYOUT_KEY).maybeSingle(),
    ).then(({ data, error }) => (error ? null : data?.body ?? null)).catch(() => null);
  }
  return cache;
}

/** Live home page layout; defaults render immediately so the page never waits on it. */
export function useHomeLayout(): HomeLayout {
  const [layout, setLayout] = useState<HomeLayout>(emptyHomeLayout);
  useEffect(() => {
    let alive = true;
    void loadHomeLayoutBody().then(b => { if (alive) setLayout(parseHomeLayout(b)); });
    // Live: admin saves show up on open pages without a refresh.
    const ch = supabase
      .channel(`home-layout-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "homepage_sections", filter: `section_key=eq.${HOME_LAYOUT_KEY}` },
        () => { void loadHomeLayoutBody(true).then(b => { if (alive) setLayout(parseHomeLayout(b)); }); })
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, []);
  return layout;
}
