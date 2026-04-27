import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HomepageSettings } from "@/lib/homepage";

/**
 * Lightweight reader for the singleton home page settings row.
 * Used by header/footer/FAB so admin updates appear instantly without a redeploy.
 */
export const useHomepageSettings = () => {
  const [settings, setSettings] = useState<HomepageSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("homepage_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setSettings(data as HomepageSettings);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
};