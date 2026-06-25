-- ================================================================
-- 1. autofill: always CC admin on every notification recipient list
-- 2. Schedule notify_stale_partial_deliveries() daily at 03:30 UTC
-- ================================================================

-- 1. Update pipeline_notifications_autofill to union target_role
--    recipients with admin recipients (deduplicated).
CREATE OR REPLACE FUNCTION public.pipeline_notifications_autofill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.source_id IS NULL AND NEW.quotation_id IS NOT NULL THEN
    NEW.source_id := NEW.quotation_id;
  END IF;
  -- Resolve role recipients + always CC admin, deduplicated.
  IF (NEW.recipients IS NULL OR array_length(NEW.recipients, 1) IS NULL)
     AND NEW.target_role IS NOT NULL THEN
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        public.resolve_role_recipients(NEW.target_role::text)
        || public.resolve_role_recipients('admin')
      )
    ) INTO NEW.recipients;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Schedule notify_stale_partial_deliveries daily at 03:30 UTC.
DO $$
BEGIN
  PERFORM cron.unschedule('notify-stale-partial-deliveries-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notify-stale-partial-deliveries-daily',
  '30 3 * * *',
  $$SELECT public.notify_stale_partial_deliveries();$$
);
