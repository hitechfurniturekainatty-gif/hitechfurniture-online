
-- Part D: make pipeline_notifications generic and add module triggers
-- (schema only — no n8n/webhook wiring beyond existing quotation flow)

ALTER TABLE public.pipeline_notifications
  ALTER COLUMN quotation_id DROP NOT NULL;

ALTER TABLE public.pipeline_notifications
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'quotation'
    CHECK (source_type IN ('quotation','lead','complaint','service','job','delivery'));

ALTER TABLE public.pipeline_notifications
  ADD COLUMN IF NOT EXISTS source_id uuid;

ALTER TABLE public.pipeline_notifications
  ADD COLUMN IF NOT EXISTS recipients text[] NOT NULL DEFAULT '{}';

-- Backfill existing rows so legacy data conforms.
UPDATE public.pipeline_notifications
   SET source_id = quotation_id
 WHERE source_id IS NULL AND quotation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_notifications_source
  ON public.pipeline_notifications (source_type, source_id);

-- Reusable role → whatsapp recipient resolver
CREATE OR REPLACE FUNCTION public.resolve_role_recipients(p_role text)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT p.whatsapp_number), '{}'::text[])
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role::text = p_role
    AND p.whatsapp_number IS NOT NULL
    AND length(btrim(p.whatsapp_number)) > 0
$$;

-- Auto-fill source_id (from quotation_id) and recipients (from target_role)
-- on every insert so call sites can stay minimal.
CREATE OR REPLACE FUNCTION public.pipeline_notifications_autofill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.source_id IS NULL AND NEW.quotation_id IS NOT NULL THEN
    NEW.source_id := NEW.quotation_id;
  END IF;
  -- Only resolve role-based recipients when caller didn't supply any.
  IF (NEW.recipients IS NULL OR array_length(NEW.recipients, 1) IS NULL)
     AND NEW.target_role IS NOT NULL THEN
    NEW.recipients := public.resolve_role_recipients(NEW.target_role::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pipeline_notifications_autofill ON public.pipeline_notifications;
CREATE TRIGGER trg_pipeline_notifications_autofill
  BEFORE INSERT ON public.pipeline_notifications
  FOR EACH ROW EXECUTE FUNCTION public.pipeline_notifications_autofill();

-- Restrict the existing webhook forwarder to legacy quotation rows so the
-- new module triggers do NOT send anything externally yet.
CREATE OR REPLACE FUNCTION public.pipeline_notifications_forward()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _url TEXT := 'https://thwleiywbpyccgtacczv.supabase.co/functions/v1/forward-pipeline-notification';
  _anon TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRod2xlaXl3YnB5Y2NndGFjY3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTE2MjksImV4cCI6MjA5MTk4NzYyOX0.9-uqLPahHSnmaEzHm2Cp8Gjdy_lEsjvK20_a_jDQl5c';
BEGIN
  -- Phase-D guard: only forward the existing quotation pipeline notifications.
  -- New module rows (complaint/service/job/delivery) are written but not yet wired.
  IF NEW.source_type IS DISTINCT FROM 'quotation' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

-- ── Module triggers ──────────────────────────────────────────────────────────

-- Complaints
CREATE OR REPLACE FUNCTION public.customer_complaints_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pipeline_notifications
    (quotation_id, source_type, source_id, stage, target_role, title, body)
  VALUES
    (NULL, 'complaint', NEW.id, NULL, 'staff'::app_role,
     'New complaint: ' || COALESCE(NEW.complaint_code, NEW.id::text),
     NEW.customer_name || ' — ' || COALESCE(NEW.customer_place, '') ||
       E'\n' || left(COALESCE(NEW.issue_description, ''), 240));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_complaints_notify ON public.customer_complaints;
CREATE TRIGGER trg_customer_complaints_notify
  AFTER INSERT ON public.customer_complaints
  FOR EACH ROW EXECUTE FUNCTION public.customer_complaints_notify();

-- Services
CREATE OR REPLACE FUNCTION public.customer_services_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pipeline_notifications
    (quotation_id, source_type, source_id, stage, target_role, title, body)
  VALUES
    (NULL, 'service', NEW.id, NULL, 'staff'::app_role,
     'New service request: ' || COALESCE(NEW.service_code, NEW.id::text),
     NEW.customer_name || ' — ' || COALESCE(NEW.customer_place, '') ||
       E'\n' || left(COALESCE(NEW.item_description, ''), 240));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_services_notify ON public.customer_services;
CREATE TRIGGER trg_customer_services_notify
  AFTER INSERT ON public.customer_services
  FOR EACH ROW EXECUTE FUNCTION public.customer_services_notify();

-- Job work orders: notify assigned worker on create
CREATE OR REPLACE FUNCTION public.job_work_orders_notify_assignment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _wa text;
  _wname text;
  _qcode text;
  _party text;
BEGIN
  SELECT whatsapp_number, name INTO _wa, _wname
    FROM public.workers WHERE id = NEW.worker_id;

  SELECT quotation_id, party_name INTO _qcode, _party
    FROM public.quotations WHERE id = NEW.quotation_id;

  INSERT INTO public.pipeline_notifications
    (quotation_id, source_type, source_id, stage, target_role, title, body, recipients)
  VALUES
    (NEW.quotation_id, 'job', NEW.id, 4::smallint, 'worker'::app_role,
     'Work assigned: ' || COALESCE(_wname, 'worker'),
     COALESCE(_qcode, '') || CASE WHEN _party IS NOT NULL THEN ' — ' || _party ELSE '' END,
     CASE WHEN _wa IS NOT NULL AND length(btrim(_wa)) > 0
          THEN ARRAY[_wa]::text[] ELSE '{}'::text[] END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_work_orders_notify_assignment ON public.job_work_orders;
CREATE TRIGGER trg_job_work_orders_notify_assignment
  AFTER INSERT ON public.job_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.job_work_orders_notify_assignment();

-- Job work orders: notify warehouse when warehouse_status changes
CREATE OR REPLACE FUNCTION public.job_work_orders_notify_warehouse()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _qcode text;
  _party text;
BEGIN
  IF NEW.warehouse_status IS DISTINCT FROM OLD.warehouse_status
     AND NEW.warehouse_status IS NOT NULL THEN
    SELECT quotation_id, party_name INTO _qcode, _party
      FROM public.quotations WHERE id = NEW.quotation_id;

    INSERT INTO public.pipeline_notifications
      (quotation_id, source_type, source_id, stage, target_role, title, body)
    VALUES
      (NEW.quotation_id, 'job', NEW.id, 5::smallint, 'warehouse'::app_role,
       'Warehouse status: ' || NEW.warehouse_status,
       COALESCE(_qcode, '') || CASE WHEN _party IS NOT NULL THEN ' — ' || _party ELSE '' END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_work_orders_notify_warehouse ON public.job_work_orders;
CREATE TRIGGER trg_job_work_orders_notify_warehouse
  AFTER UPDATE OF warehouse_status ON public.job_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.job_work_orders_notify_warehouse();

-- Trips: notify assigned driver when driver is set / changed
CREATE OR REPLACE FUNCTION public.trips_notify_driver()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _wa text;
  _dname text;
BEGIN
  IF NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.assigned_driver_id IS NOT DISTINCT FROM OLD.assigned_driver_id THEN
    RETURN NEW;
  END IF;

  SELECT whatsapp_number, COALESCE(display_name, email) INTO _wa, _dname
    FROM public.profiles WHERE user_id = NEW.assigned_driver_id;

  INSERT INTO public.pipeline_notifications
    (quotation_id, source_type, source_id, stage, target_role, title, body, recipients)
  VALUES
    (NULL, 'delivery', NEW.id, 6::smallint, 'delivery'::app_role,
     'Trip assigned: ' || COALESCE(_dname, 'driver'),
     'Trip on ' || to_char(NEW.trip_date, 'DD Mon YYYY'),
     CASE WHEN _wa IS NOT NULL AND length(btrim(_wa)) > 0
          THEN ARRAY[_wa]::text[] ELSE '{}'::text[] END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_notify_driver ON public.trips;
CREATE TRIGGER trg_trips_notify_driver
  AFTER INSERT OR UPDATE OF assigned_driver_id ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.trips_notify_driver();
