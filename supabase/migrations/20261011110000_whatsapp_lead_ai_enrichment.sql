-- AI enrichment for WhatsApp auto-leads.
-- LIVE PATH: n8n workflow "[WA] Lead AI Enrichment" (id s5qFLil5kuQXEDXY, every 10 min,
-- Claude Haiku 4.5) reads public.whatsapp_leads_needing_enrichment + whatsapp_chat_for_phone
-- and writes back with public.apply_lead_enrichment (20261011113000).
-- The edge function enrich-whatsapp-leads + enqueue function below are an unused fallback
-- (no AI key in Supabase); the cron schedule was intentionally NOT created.

ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS ai_enriched_at timestamptz;

-- Open WhatsApp leads never enriched, or with a customer message since the last run.
CREATE OR REPLACE FUNCTION public.whatsapp_leads_needing_enrichment(p_limit int DEFAULT 15)
 RETURNS SETOF public.sales_leads LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT l.* FROM public.sales_leads l
   WHERE l.source = 'whatsapp' AND l.deleted_at IS NULL AND l.status IN ('pending','contacted')
     AND EXISTS (SELECT 1 FROM public.whatsapp_messages m
                  WHERE m.direction = 'incoming'
                    AND public.phone_key(m.phone) = public.phone_key(l.customer_phone)
                    AND (l.ai_enriched_at IS NULL OR m.created_at > l.ai_enriched_at))
   ORDER BY l.created_at DESC
   LIMIT greatest(1, least(p_limit, 50))
$$;

-- Last N messages of a chat, oldest first.
CREATE OR REPLACE FUNCTION public.whatsapp_chat_for_phone(p_phone text, p_limit int DEFAULT 40)
 RETURNS TABLE(direction text, message_text text, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT x.direction, x.message_text, x.created_at FROM (
    SELECT m.direction, m.message_text, m.created_at FROM public.whatsapp_messages m
     WHERE public.phone_key(m.phone) = public.phone_key(p_phone)
     ORDER BY m.created_at DESC LIMIT greatest(1, least(p_limit, 100))
  ) x ORDER BY x.created_at
$$;

CREATE OR REPLACE FUNCTION public.get_lead_enrich_secret()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'vault'
AS $$ SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'lead_enrich_secret' LIMIT 1 $$;

REVOKE ALL ON FUNCTION public.whatsapp_leads_needing_enrichment(int) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_chat_for_phone(text, int) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_lead_enrich_secret() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_leads_needing_enrichment(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_chat_for_phone(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_lead_enrich_secret() TO service_role;

-- Cron entry point: calls the edge function only when there is work.
CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_lead_enrichment()
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE s text; rid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_leads_needing_enrichment(1)) THEN RETURN NULL; END IF;
  s := public.get_lead_enrich_secret();
  IF s IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(
           url := 'https://ejxautrxbcemrncpzjyg.supabase.co/functions/v1/enrich-whatsapp-leads',
           headers := jsonb_build_object('Content-Type','application/json','x-enrich-secret', s),
           body := '{}'::jsonb,
           timeout_milliseconds := 150000)
    INTO rid;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_whatsapp_lead_enrichment() FROM public, anon, authenticated;

