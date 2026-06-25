-- ================================================================
-- Scheduled reminder: uncontacted leads
-- ================================================================

-- 1. Extend source_type check to include 'lead_reminder'
DO $$
BEGIN
  ALTER TABLE public.pipeline_notifications
    DROP CONSTRAINT pipeline_notifications_source_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.pipeline_notifications
  ADD CONSTRAINT pipeline_notifications_source_type_check
  CHECK (source_type IN (
    'quotation','lead','complaint','service','job','delivery','lead_reminder'
  ));

-- 2. Function: insert reminders for leads not contacted after 4 h
CREATE OR REPLACE FUNCTION public.check_uncontacted_lead_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted INT := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.pipeline_notifications (
      quotation_id,
      stage,
      target_role,
      source_type,
      source_id,
      recipients,
      title,
      body
    )
    SELECT
      q.id,
      1::smallint,
      'staff'::app_role,
      'lead_reminder',
      q.id,
      public.resolve_role_recipients('staff'),
      'Lead not contacted',
      q.party_name
        || CASE WHEN q.party_phone IS NOT NULL AND q.party_phone <> ''
               THEN ' · ' || q.party_phone
               ELSE '' END
        || ' — '
        || FLOOR(EXTRACT(EPOCH FROM (now() - q.created_at)) / 3600)::int::text
        || 'h overdue'
    FROM public.quotations q
    WHERE q.lead_type = 'lead'
      AND q.enquiry_contacted_at IS NULL
      AND q.status NOT IN ('rejected', 'delivered')
      AND q.deleted_at IS NULL
      AND q.created_at < now() - INTERVAL '4 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.pipeline_notifications pn
         WHERE pn.source_type = 'lead_reminder'
           AND pn.source_id = q.id
      )
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;
  RETURN _inserted;
END;
$$;

-- 3. Schedule every 30 minutes via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('check-uncontacted-lead-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-uncontacted-lead-reminders',
  '*/30 * * * *',
  $$SELECT public.check_uncontacted_lead_reminders();$$
);
