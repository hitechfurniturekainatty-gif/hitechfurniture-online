
-- 1) Make set_quotation_stage sync the public status and respect "rejected".
CREATE OR REPLACE FUNCTION public.set_quotation_stage(
  _quotation_id uuid, _stage smallint, _target_role app_role, _title text, _body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current SMALLINT;
  _status  TEXT;
  _new_status TEXT;
BEGIN
  SELECT pipeline_stage, status INTO _current, _status
  FROM public.quotations WHERE id = _quotation_id;

  IF _status = 'rejected' THEN
    RETURN; -- frozen
  END IF;

  IF _current IS NULL OR _stage <= _current THEN
    RETURN; -- never go backwards
  END IF;

  -- Map pipeline stage → public quotation status.
  _new_status := _status;
  IF _stage >= 7 THEN
    _new_status := 'delivered';
  ELSIF _stage >= 3 AND _status = 'drafted' THEN
    _new_status := 'finalized';
  END IF;

  UPDATE public.quotations
     SET pipeline_stage = _stage,
         status         = _new_status,
         updated_at     = now()
   WHERE id = _quotation_id;

  INSERT INTO public.pipeline_notifications(quotation_id, stage, target_role, title, body)
  VALUES (_quotation_id, _stage, _target_role, _title, _body);
END;
$function$;

-- 2) When a quotation is manually moved to a stage >= 3, mirror to "finalized";
--    when status flips to rejected, freeze further auto-advances.
CREATE OR REPLACE FUNCTION public.quotations_stage_autoadvance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _label TEXT;
BEGIN
  _label := COALESCE(NEW.party_name, '') || ' — ' || COALESCE(NEW.party_place, '');

  -- Hard freeze when status is rejected: don't auto-bump anything from triggers.
  IF NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;

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
END;
$function$;

-- 3) Mirror status changes that happen via direct UPDATE on `quotations`
--    (e.g. office staff manually moves pipeline_stage in the admin UI).
CREATE OR REPLACE FUNCTION public.quotations_sync_status_from_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Don't override a "rejected" status.
  IF NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN
    IF NEW.pipeline_stage >= 7 AND NEW.status IS DISTINCT FROM 'delivered' THEN
      NEW.status := 'delivered';
    ELSIF NEW.pipeline_stage >= 3
          AND NEW.status = 'drafted' THEN
      NEW.status := 'finalized';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_quotations_sync_status_from_stage ON public.quotations;
CREATE TRIGGER trg_quotations_sync_status_from_stage
BEFORE UPDATE ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.quotations_sync_status_from_stage();
