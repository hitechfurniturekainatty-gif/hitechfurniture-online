-- Allow Logistics (6) as an override target in addition to Production (4) and Warehouse (5).
CREATE OR REPLACE FUNCTION public.override_advance_quotation(
  _quotation_id uuid,
  _target_stage smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _label TEXT;
  _role app_role;
  _reason TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'staff'::app_role)) THEN
    RAISE EXCEPTION 'Only admin or office staff can override the workflow';
  END IF;

  IF _target_stage NOT IN (4, 5, 6) THEN
    RAISE EXCEPTION 'Override target must be 4 (Production), 5 (Warehouse) or 6 (Logistics)';
  END IF;

  SELECT party_name || ' — ' || COALESCE(party_place,'')
    INTO _label FROM public.quotations WHERE id = _quotation_id;

  UPDATE public.quotations
     SET status = CASE WHEN status = 'drafted' THEN 'finalized' ELSE status END,
         updated_at = now()
   WHERE id = _quotation_id
     AND status <> 'rejected';

  _role := CASE
    WHEN _target_stage = 5 THEN 'warehouse'::app_role
    WHEN _target_stage = 6 THEN 'delivery'::app_role
    ELSE 'staff'::app_role
  END;

  _reason := CASE
    WHEN _target_stage = 6 THEN 'Pushed to logistics (override)'
    WHEN _target_stage = 5 THEN 'Pushed to warehouse (override)'
    ELSE 'Pushed to production (override)'
  END;

  PERFORM public.set_quotation_stage(_quotation_id, _target_stage, _role, _reason, _label);
END;
$function$;