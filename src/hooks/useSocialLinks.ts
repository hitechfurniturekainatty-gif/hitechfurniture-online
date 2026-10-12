import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { SOCIAL_SECTION_KEY, buildSocialLinks, parseSocialConfig } from "@/lib/socialLinks";

let cache: Promise<string | null> | null = null;

/** Raw saved JSON of the social list (null = never saved). */
export function loadSocialBody(force = false): Promise<string | null> {
  if (!cache || force) {
    cache = Promise.resolve(
      supabase.from("homepage_sections").select("body").eq("section_key", SOCIAL_SECTION_KEY).maybeSingle(),
    ).then(({ data, error }) => (error ? null : data?.body ?? null)).catch(() => null);
  }
  return cache;
}

/** Live social/review links (admin edits show without a redeploy). */
export function useSocialLinks() {
  const settings = useHomepageSettings();
  const [body, setBody] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadSocialBody().then(b => { if (alive) setBody(b); });
    return () => { alive = false; };
  }, []);
  return useMemo(() => {
    const config = parseSocialConfig(body ?? null, settings);
    return {
      ready: !!settings && body !== undefined,
      config,
      settings,
      links: buildSocialLinks(config, settings?.whatsapp_default_message || undefined),
    };
  }, [body, settings]);
}
