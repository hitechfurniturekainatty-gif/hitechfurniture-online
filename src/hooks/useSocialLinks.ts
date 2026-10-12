import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHomepageSettings } from "@/hooks/useHomepageSettings";
import { SOCIAL_SECTION_KEY, buildSocialLinks, defaultSocialExtras, parseSocialExtras, type SocialExtras } from "@/lib/socialLinks";

let cache: Promise<SocialExtras> | null = null;

export function loadSocialExtras(force = false): Promise<SocialExtras> {
  if (!cache || force) {
    cache = Promise.resolve(
      supabase.from("homepage_sections").select("body").eq("section_key", SOCIAL_SECTION_KEY).maybeSingle(),
    ).then(({ data, error }) => (error ? defaultSocialExtras() : parseSocialExtras(data?.body ?? null)))
      .catch(() => defaultSocialExtras());
  }
  return cache;
}

/** Live social/review links (admin edits show without a redeploy). */
export function useSocialLinks() {
  const settings = useHomepageSettings();
  const [extras, setExtras] = useState<SocialExtras | null>(null);
  useEffect(() => {
    let alive = true;
    void loadSocialExtras().then(x => { if (alive) setExtras(x); });
    return () => { alive = false; };
  }, []);
  const ready = !!settings && !!extras;
  const ex = extras ?? defaultSocialExtras();
  return {
    ready,
    extras: ex,
    settings,
    links: buildSocialLinks(settings, ex, settings?.whatsapp_default_message || undefined),
  };
}
