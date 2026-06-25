-- ================================================================
-- Notification reminders batch
-- Items 1-5:
--   1. Staff lifecycle: hard-delete + ON DELETE CASCADE confirmed, no fix needed
--   2. check_stuck_production_jobs() + cron every 30 min
--   3. check_payment_reminders() + cron daily 04:00 UTC
--   4. check_quotation_expiry() + cron daily 04:30 UTC
--   5. quotations_delivery_review trigger (fires on status→'delivered')
-- All new source_types added to CHECK constraint first.
-- All functions rely on target_role → autofill resolves recipients live.
-- ================================================================

-- ── Extend source_type CHECK to cover new types ──────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.pipeline_notifications
    DROP CONSTRAINT pipeline_notifications_source_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.pipeline_notifications
  ADD CONSTRAINT pipeline_notifications_source_type_check
  CHECK (source_type IN (
    'quotation','lead','complaint','service','job','delivery',
    'lead_reminder','job_stuck','payment_reminder','quotation_expiry','delivery_review'
  ));

-- ── 2. check_stuck_production_jobs() ────────────────────────────────────────
-- job_work_orders.status_updated_at tracks when status last changed.
-- Stuck = status IN ('assigned','in_progress') and status_updated_at > 24h ago.
CREATE OR REPLACE FUNCTION public.check_stuck_production_jobs()
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
      title,
      body
    )
    SELECT
      jwo.quotation_id,
      4::smallint,
      'staff'::app_role,
      'job_stuck',
      jwo.id,
      'Production job stuck',
      COALESCE(w.name, 'Worker') || ' — ' ||
        COALESCE(q.quotation_id, jwo.quotation_id::text) ||
        CASE WHEN q.party_name IS NOT NULL THEN ' (' || q.party_name || ')' ELSE '' END ||
        ' — ' ||
        FLOOR(EXTRACT(EPOCH FROM (now() - jwo.status_updated_at)) / 3600)::int::text ||
        'h in ' || jwo.status
    FROM public.job_work_orders jwo
    LEFT JOIN public.workers w ON w.id = jwo.worker_id
    LEFT JOIN public.quotations q ON q.id = jwo.quotation_id
    WHERE jwo.status IN ('assigned', 'in_progress')
      AND jwo.status_updated_at < now() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.pipeline_notifications pn
         WHERE pn.source_type = 'job_stuck'
           AND pn.source_id = jwo.id
           AND pn.created_at > now() - INTERVAL '24 hours'
      )
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;
  RETURN _inserted;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-stuck-production-jobs');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-stuck-production-jobs',
  '*/30 * * * *',
  $$SELECT public.check_stuck_production_jobs();$$
);

-- ── 3. check_payment_reminders() ────────────────────────────────────────────
-- quotations: status='finalized', balance > 0, expected_delivery_date within
-- 3 days from now OR already past (overdue).
CREATE OR REPLACE FUNCTION public.check_payment_reminders()
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
      title,
      body
    )
    SELECT
      q.id,
      3::smallint,
      'staff'::app_role,
      'payment_reminder',
      q.id,
      'Balance payment due',
      q.party_name ||
        CASE WHEN q.party_phone IS NOT NULL AND q.party_phone <> ''
             THEN ' · ' || q.party_phone ELSE '' END ||
        ' — balance ₹' || to_char(q.total - COALESCE(q.advance_amount, 0), 'FM999,999,999') ||
        ' · delivery ' || to_char(q.expected_delivery_date, 'DD Mon YYYY')
    FROM public.quotations q
    WHERE q.deleted_at IS NULL
      AND q.status = 'finalized'
      AND q.total > 0
      AND (q.total - COALESCE(q.advance_amount, 0)) > 0
      AND q.expected_delivery_date IS NOT NULL
      AND q.expected_delivery_date <= (CURRENT_DATE + INTERVAL '3 days')
      AND NOT EXISTS (
        SELECT 1 FROM public.pipeline_notifications pn
         WHERE pn.source_type = 'payment_reminder'
           AND pn.source_id = q.id
           AND pn.created_at > now() - INTERVAL '2 days'
      )
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;
  RETURN _inserted;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-payment-reminders-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-payment-reminders-daily',
  '0 4 * * *',
  $$SELECT public.check_payment_reminders();$$
);

-- ── 4. check_quotation_expiry() ─────────────────────────────────────────────
-- 'sent' status was migrated to 'finalized' in 20260429163842.
-- Valid unfinalized statuses: 'drafted' (default). Finalized/delivered/rejected excluded.
CREATE OR REPLACE FUNCTION public.check_quotation_expiry()
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
      title,
      body
    )
    SELECT
      q.id,
      1::smallint,
      'staff'::app_role,
      'quotation_expiry',
      q.id,
      'Quotation expiring soon',
      q.party_name ||
        CASE WHEN q.party_phone IS NOT NULL AND q.party_phone <> ''
             THEN ' · ' || q.party_phone ELSE '' END ||
        ' — ' || EXTRACT(DAY FROM now() - q.created_at)::int::text || ' days old'
    FROM public.quotations q
    WHERE q.deleted_at IS NULL
      AND q.status = 'drafted'
      AND q.created_at < now() - INTERVAL '15 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.pipeline_notifications pn
         WHERE pn.source_type = 'quotation_expiry'
           AND pn.source_id = q.id
           AND pn.created_at > now() - INTERVAL '7 days'
      )
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;
  RETURN _inserted;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-quotation-expiry-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-quotation-expiry-daily',
  '30 4 * * *',
  $$SELECT public.check_quotation_expiry();$$
);

-- ── 5. Post-delivery review request trigger ──────────────────────────────────
-- Fires on quotations when status transitions to 'delivered' (set by multiple
-- paths: trip_quotations_mark_delivered, quotations_stage_autoadvance, manual).
-- Notifies staff to forward a review request to the customer.
CREATE OR REPLACE FUNCTION public.quotations_delivery_review_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    INSERT INTO public.pipeline_notifications (
      quotation_id,
      stage,
      target_role,
      source_type,
      source_id,
      title,
      body
    ) VALUES (
      NEW.id,
      7::smallint,
      'staff'::app_role,
      'delivery_review',
      NEW.id,
      'Request Google review',
      NEW.party_name ||
        CASE WHEN NEW.party_phone IS NOT NULL AND NEW.party_phone <> ''
             THEN ' · ' || NEW.party_phone ELSE '' END ||
        E'\nForward to customer: "Thank you for choosing Hitech Furniture & Interiors! We would love your feedback — please spare a moment to leave us a Google review: https://g.page/r/hitechfurniture/review"'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotations_delivery_review_notify ON public.quotations;
CREATE TRIGGER trg_quotations_delivery_review_notify
  AFTER UPDATE OF status ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.quotations_delivery_review_notify();
