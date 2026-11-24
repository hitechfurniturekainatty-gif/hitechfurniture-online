-- Fewer, useful alerts + lock internal functions (2026-11-24)
--
-- The bell had 2,810 unread alerts, so nobody read it. 1,266 were "Quotation expiring
-- soon" (repeated every 7 days for every draft quotation older than 15 days, for ever)
-- and 897 were "Balance payment due" (repeated every 2 days for every past-due order,
-- for ever). This:
--   * sends the expiry alert once per quotation, only while it is 15-60 days old,
--   * sends the payment reminder only from 3 days before to 7 days after the delivery
--     date, at most once a week per order (overdue balances are already followed up in
--     Payments / Receivables),
--   * marks every alert older than 7 days as read each night, and once now,
--   * removes public (not-signed-in) access to internal helper and trigger functions.
--     Each of these already checks the user's role inside; this is extra protection.

CREATE OR REPLACE FUNCTION public.check_quotation_expiry()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _inserted INT := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.pipeline_notifications
      (quotation_id, stage, target_role, source_type, source_id, title, body)
    SELECT
      q.id, 1::smallint, 'staff'::app_role, 'quotation_expiry', q.id,
      'Quotation expiring soon',
      q.party_name ||
        CASE WHEN q.party_phone IS NOT NULL AND q.party_phone <> '' THEN ' · ' || q.party_phone ELSE '' END ||
        ' — ' || EXTRACT(DAY FROM now() - q.created_at)::int::text || ' days old. Call, then confirm or mark lost.'
    FROM public.quotations q
    WHERE q.deleted_at IS NULL
      AND q.status = 'drafted'
      AND q.created_at < now() - INTERVAL '15 days'
      AND q.created_at > now() - INTERVAL '60 days'
      AND NOT EXISTS (                      -- once per quotation, never repeated
        SELECT 1 FROM public.pipeline_notifications pn
         WHERE pn.source_type = 'quotation_expiry' AND pn.source_id = q.id)
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;
  RETURN _inserted;
END; $function$;

CREATE OR REPLACE FUNCTION public.check_payment_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _inserted INT := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.pipeline_notifications
      (quotation_id, stage, target_role, source_type, source_id, title, body)
    SELECT
      q.id, 3::smallint, 'staff'::app_role, 'payment_reminder', q.id,
      'Balance payment due',
      q.party_name ||
        CASE WHEN q.party_phone IS NOT NULL AND q.party_phone <> '' THEN ' · ' || q.party_phone ELSE '' END ||
        ' — balance ₹' || to_char(q.total - COALESCE(q.advance_amount, 0), 'FM999,999,999') ||
        ' · delivery ' || to_char(q.expected_delivery_date, 'DD Mon YYYY')
    FROM public.quotations q
    WHERE q.deleted_at IS NULL
      AND q.status = 'finalized'
      AND q.total > 0
      AND (q.total - COALESCE(q.advance_amount, 0)) > 0
      AND q.expected_delivery_date IS NOT NULL
      AND q.expected_delivery_date BETWEEN (CURRENT_DATE - 7) AND (CURRENT_DATE + 3)
      AND NOT EXISTS (
        SELECT 1 FROM public.pipeline_notifications pn
         WHERE pn.source_type = 'payment_reminder' AND pn.source_id = q.id
           AND pn.created_at > now() - INTERVAL '7 days')
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;
  RETURN _inserted;
END; $function$;

-- Nightly tidy: alerts older than 7 days are marked read (kept, not deleted).
CREATE OR REPLACE FUNCTION public.auto_read_old_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _n INT;
BEGIN
  UPDATE public.pipeline_notifications SET read_at = now()
   WHERE read_at IS NULL AND created_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $function$;
REVOKE ALL ON FUNCTION public.auto_read_old_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_read_old_notifications() TO service_role;

DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto_read_old_notifications';
  PERFORM cron.schedule('auto_read_old_notifications', '30 20 * * *', 'select public.auto_read_old_notifications()'); -- 2 AM India
END $$;

-- One-time clean-up of the backlog (older than 7 days → read).
SELECT public.auto_read_old_notifications();

-- Internal trigger/helper functions: no public (not signed-in) access.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.delivery_collections_notify()',
    'public.log_job_item_quantity_change()',
    'public.quotation_auto_followup()',
    'public.refresh_job_status_from_item_qty()',
    'public.sales_lead_followups_stage()',
    'public.sync_chat_conversation()',
    'public.sync_completed_qty_to_ready_stock()',
    'public.sync_job_item_rows()',
    'public.sync_received_qty_to_ready_stock()',
    'public.trg_sync_primary_image_to_gallery()',
    'public.whatsapp_message_auto_lead()'
  ] LOOP
    -- Trigger functions are never called directly; nobody needs EXECUTE on them.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.set_job_item_completed_qty(uuid, numeric)',
    'public.set_job_item_received_qty(uuid, numeric)'
  ] LOOP
    -- Used by signed-in staff and workers only.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
  END LOOP;
END $$;

ALTER FUNCTION public.lead_outcome_reached(text) SET search_path TO 'public';
