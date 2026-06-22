
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.notify_stale_unpaid_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inserted INT := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, title, body)
    SELECT q.id,
           q.pipeline_stage,
           'staff'::app_role,
           'Stale: no advance recorded',
           q.party_name || ' — ' || COALESCE(q.party_place,'') ||
             ' · total ₹' || to_char(q.total, 'FM999,999,999') ||
             ' · pending since ' ||
             to_char(COALESCE(q.submitted_for_pricing_at, q.created_at)::date, 'DD Mon')
      FROM public.quotations q
     WHERE q.deleted_at IS NULL
       AND q.status = 'drafted'
       AND q.total > 0
       AND COALESCE(q.advance_amount, 0) = 0
       AND COALESCE(q.submitted_for_pricing_at, q.created_at) < (now() - INTERVAL '2 days')
       AND NOT EXISTS (
         SELECT 1 FROM public.pipeline_notifications pn
          WHERE pn.quotation_id = q.id
            AND pn.title = 'Stale: no advance recorded'
            AND pn.created_at > (now() - INTERVAL '2 days')
       )
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;
  RETURN _inserted;
END;
$$;

-- Remove any prior schedule with the same name, then (re)create it.
DO $$
BEGIN
  PERFORM cron.unschedule('notify-stale-unpaid-drafts-daily')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-stale-unpaid-drafts-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notify-stale-unpaid-drafts-daily',
  '30 3 * * *',
  $$SELECT public.notify_stale_unpaid_drafts();$$
);

-- Run once now to flag existing stale rows.
SELECT public.notify_stale_unpaid_drafts();
