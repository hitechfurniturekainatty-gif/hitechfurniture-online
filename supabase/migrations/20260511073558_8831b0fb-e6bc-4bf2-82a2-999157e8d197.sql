-- =========================================================
-- 1. pipeline_stage column on quotations
-- =========================================================
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS pipeline_stage SMALLINT NOT NULL DEFAULT 1
    CHECK (pipeline_stage BETWEEN 1 AND 6);

CREATE INDEX IF NOT EXISTS idx_quotations_pipeline_stage
  ON public.quotations(pipeline_stage) WHERE deleted_at IS NULL;

-- =========================================================
-- 2. Notifications table (per role broadcast)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pipeline_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL,
  stage SMALLINT NOT NULL CHECK (stage BETWEEN 1 AND 6),
  target_role app_role NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  read_by UUID
);

CREATE INDEX IF NOT EXISTS idx_pipenotif_role_unread
  ON public.pipeline_notifications(target_role, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.pipeline_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pn_select ON public.pipeline_notifications;
CREATE POLICY pn_select ON public.pipeline_notifications
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), target_role)
  );

DROP POLICY IF EXISTS pn_update ON public.pipeline_notifications;
CREATE POLICY pn_update ON public.pipeline_notifications
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), target_role)
  );

DROP POLICY IF EXISTS pn_delete ON public.pipeline_notifications;
CREATE POLICY pn_delete ON public.pipeline_notifications
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Inserts come from triggers (SECURITY DEFINER); deny direct client inserts.
DROP POLICY IF EXISTS pn_insert_none ON public.pipeline_notifications;
CREATE POLICY pn_insert_none ON public.pipeline_notifications
  FOR INSERT TO authenticated WITH CHECK (false);

-- =========================================================
-- 3. Helper: emit notification + advance stage atomically
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_quotation_stage(
  _quotation_id UUID,
  _stage SMALLINT,
  _target_role app_role,
  _title TEXT,
  _body TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _current SMALLINT;
BEGIN
  SELECT pipeline_stage INTO _current
  FROM public.quotations WHERE id = _quotation_id;

  IF _current IS NULL OR _stage <= _current THEN
    RETURN; -- never go backwards, never re-emit on the same stage
  END IF;

  UPDATE public.quotations
     SET pipeline_stage = _stage, updated_at = now()
   WHERE id = _quotation_id;

  INSERT INTO public.pipeline_notifications(quotation_id, stage, target_role, title, body)
  VALUES (_quotation_id, _stage, _target_role, _title, _body);
END;
$$;

-- =========================================================
-- 4. Trigger: quotation INSERT → initial stage + salesman
-- =========================================================
CREATE OR REPLACE FUNCTION public.quotations_initial_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _name TEXT;
  _role app_role;
  _title TEXT;
  _body TEXT;
BEGIN
  -- Salesman attribution from creator profile, only if not already provided.
  IF NEW.salesperson_name IS NULL OR length(btrim(NEW.salesperson_name)) = 0 THEN
    SELECT COALESCE(display_name, email) INTO _name
      FROM public.profiles WHERE user_id = NEW.created_by LIMIT 1;
    IF _name IS NOT NULL THEN NEW.salesperson_name := _name; END IF;
  END IF;

  -- Initial stage by lead_type / submitted state.
  IF NEW.lead_type = 'custom_project' THEN
    NEW.pipeline_stage := 2; _role := 'measurement_staff';
    _title := 'New measurement task'; _body := NEW.party_name || ' — ' || NEW.party_place;
  ELSIF NEW.lead_type = 'direct_deal' OR NEW.is_direct_order = true THEN
    NEW.pipeline_stage := 3; _role := 'staff';
    _title := 'Direct deal: needs pricing'; _body := NEW.party_name || ' — ' || NEW.party_place;
  ELSIF NEW.submitted_for_pricing_at IS NOT NULL THEN
    NEW.pipeline_stage := 3; _role := 'staff';
    _title := 'Quotation submitted for pricing'; _body := NEW.party_name || ' — ' || NEW.party_place;
  ELSE
    NEW.pipeline_stage := 1; _role := 'staff';
    _title := NULL;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_quotations_initial_stage ON public.quotations;
CREATE TRIGGER trg_quotations_initial_stage
BEFORE INSERT ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.quotations_initial_stage();

-- AFTER INSERT: notify next owner (we can't insert notifications inside BEFORE without the row id stable, but it is stable; do it AFTER for safety).
CREATE OR REPLACE FUNCTION public.quotations_initial_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _role app_role; _title TEXT; _body TEXT;
BEGIN
  _body := NEW.party_name || ' — ' || COALESCE(NEW.party_place, '');
  IF NEW.pipeline_stage = 2 THEN _role := 'measurement_staff'; _title := 'New measurement task';
  ELSIF NEW.pipeline_stage = 3 THEN _role := 'staff'; _title := 'New direct deal: needs pricing';
  ELSE RETURN NEW;
  END IF;

  INSERT INTO public.pipeline_notifications(quotation_id, stage, target_role, title, body)
  VALUES (NEW.id, NEW.pipeline_stage, _role, _title, _body);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_quotations_initial_notify ON public.quotations;
CREATE TRIGGER trg_quotations_initial_notify
AFTER INSERT ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.quotations_initial_notify();

-- =========================================================
-- 5. Trigger: quotation UPDATE → OPS / Production transitions
-- =========================================================
CREATE OR REPLACE FUNCTION public.quotations_stage_autoadvance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _label TEXT;
BEGIN
  _label := COALESCE(NEW.party_name, '') || ' — ' || COALESCE(NEW.party_place, '');

  -- Pricing submitted → OPS (3)
  IF NEW.submitted_for_pricing_at IS NOT NULL
     AND OLD.submitted_for_pricing_at IS NULL THEN
    PERFORM public.set_quotation_stage(NEW.id, 3::SMALLINT, 'staff'::app_role,
      'Pricing ready for review', _label);
  END IF;

  -- Finalized OR advance recorded → Production (4)
  IF (NEW.status = 'finalized' AND OLD.status IS DISTINCT FROM 'finalized')
     OR (COALESCE(NEW.advance_amount,0) > 0 AND COALESCE(OLD.advance_amount,0) = 0) THEN
    PERFORM public.set_quotation_stage(NEW.id, 4::SMALLINT, 'staff'::app_role,
      'Finalized: assign work order', _label);
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_quotations_stage_autoadvance ON public.quotations;
CREATE TRIGGER trg_quotations_stage_autoadvance
AFTER UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.quotations_stage_autoadvance();

-- =========================================================
-- 6. Trigger: measurement_tasks completed → OPS (3)
-- =========================================================
CREATE OR REPLACE FUNCTION public.measurement_tasks_autoadvance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _qid UUID; _label TEXT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    _qid := NEW.draft_quotation_id;
    IF _qid IS NOT NULL THEN
      _label := COALESCE(NEW.customer_name,'') || ' — ' || COALESCE(NEW.customer_place,'');
      PERFORM public.set_quotation_stage(_qid, 3::SMALLINT, 'staff'::app_role,
        'Measurement submitted', _label);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_measurement_tasks_autoadvance ON public.measurement_tasks;
CREATE TRIGGER trg_measurement_tasks_autoadvance
AFTER UPDATE ON public.measurement_tasks
FOR EACH ROW EXECUTE FUNCTION public.measurement_tasks_autoadvance();

-- =========================================================
-- 7. Trigger: job_work_orders → Production / Warehouse / Logistics
-- =========================================================
CREATE OR REPLACE FUNCTION public.jobs_autoadvance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _qid UUID;
  _total INT; _completed INT; _dispatched INT;
  _label TEXT;
BEGIN
  _qid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  IF _qid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT party_name || ' — ' || COALESCE(party_place,'')
    INTO _label FROM public.quotations WHERE id = _qid;

  -- New job created → Production (4)
  IF TG_OP = 'INSERT' THEN
    PERFORM public.set_quotation_stage(_qid, 4::SMALLINT, 'worker'::app_role,
      'New work assigned', _label);
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'completed'),
         COUNT(*) FILTER (WHERE warehouse_status = 'dispatched')
    INTO _total, _completed, _dispatched
  FROM public.job_work_orders
  WHERE quotation_id = _qid AND deleted_at IS NULL;

  -- Any dispatched → Logistics (6)
  IF _dispatched > 0 THEN
    PERFORM public.set_quotation_stage(_qid, 6::SMALLINT, 'delivery'::app_role,
      'Ready for dispatch', _label);
  -- All jobs completed → Warehouse (5)
  ELSIF _total > 0 AND _completed = _total THEN
    PERFORM public.set_quotation_stage(_qid, 5::SMALLINT, 'staff'::app_role,
      'Production complete — at warehouse', _label);
  END IF;

  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_jobs_autoadvance ON public.job_work_orders;
CREATE TRIGGER trg_jobs_autoadvance
AFTER INSERT OR UPDATE ON public.job_work_orders
FOR EACH ROW EXECUTE FUNCTION public.jobs_autoadvance();

-- =========================================================
-- 8. Trigger: trip_quotations / trips → Logistics (6)
-- =========================================================
CREATE OR REPLACE FUNCTION public.trip_quotations_autoadvance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _label TEXT;
BEGIN
  SELECT party_name || ' — ' || COALESCE(party_place,'')
    INTO _label FROM public.quotations WHERE id = NEW.quotation_id;
  PERFORM public.set_quotation_stage(NEW.quotation_id, 6::SMALLINT, 'delivery'::app_role,
    'Added to a delivery trip', _label);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_trip_quotations_autoadvance ON public.trip_quotations;
CREATE TRIGGER trg_trip_quotations_autoadvance
AFTER INSERT ON public.trip_quotations
FOR EACH ROW EXECUTE FUNCTION public.trip_quotations_autoadvance();

-- =========================================================
-- 9. Backfill pipeline_stage on existing rows (best-effort)
-- =========================================================
UPDATE public.quotations q SET pipeline_stage = sub.stage
FROM (
  SELECT q.id,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.trip_quotations tq WHERE tq.quotation_id = q.id) THEN 6
      WHEN EXISTS (SELECT 1 FROM public.job_work_orders j WHERE j.quotation_id = q.id AND j.warehouse_status = 'dispatched' AND j.deleted_at IS NULL) THEN 6
      WHEN (
        SELECT COUNT(*) FILTER (WHERE status='completed') = COUNT(*) AND COUNT(*) > 0
        FROM public.job_work_orders j WHERE j.quotation_id = q.id AND j.deleted_at IS NULL
      ) THEN 5
      WHEN EXISTS (SELECT 1 FROM public.job_work_orders j WHERE j.quotation_id = q.id AND j.deleted_at IS NULL) THEN 4
      WHEN q.status = 'finalized' OR COALESCE(q.advance_amount,0) > 0 THEN 4
      WHEN q.submitted_for_pricing_at IS NOT NULL OR q.is_direct_order = true OR q.lead_type = 'direct_deal' THEN 3
      WHEN q.lead_type = 'custom_project' OR q.source_task_id IS NOT NULL THEN 2
      ELSE 1
    END AS stage
  FROM public.quotations q
) sub
WHERE q.id = sub.id;

-- =========================================================
-- 10. Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_notifications;
