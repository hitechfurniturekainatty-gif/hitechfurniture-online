-- Unified workflow: smart routing from OPS based on item fulfillment + admin/office override.

-- 1) Replace quotations_stage_autoadvance: when advance lands OR status flips
--    to finalized, decide between Production (4) and Warehouse (5) based on
--    whether every item is ready_stock.
CREATE OR REPLACE FUNCTION public.quotations_stage_autoadvance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _label TEXT;
  _items_total INT;
  _items_custom INT;
  _target_stage SMALLINT;
BEGIN
  _label := COALESCE(NEW.party_name, '') || ' — ' || COALESCE(NEW.party_place, '');

  IF NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  -- Pricing submitted → OPS (3)
  IF NEW.submitted_for_pricing_at IS NOT NULL
     AND OLD.submitted_for_pricing_at IS NULL THEN
    PERFORM public.set_quotation_stage(NEW.id, 3::SMALLINT, 'staff'::app_role,
      'Pricing ready for review', _label);
  END IF;

  -- Finalized OR advance recorded → route to Production or Warehouse
  IF (NEW.status = 'finalized' AND OLD.status IS DISTINCT FROM 'finalized')
     OR (COALESCE(NEW.advance_amount,0) > 0 AND COALESCE(OLD.advance_amount,0) = 0) THEN

    SELECT COUNT(*), COUNT(*) FILTER (WHERE fulfillment_route = 'custom')
      INTO _items_total, _items_custom
    FROM public.quotation_items WHERE quotation_id = NEW.id;

    IF _items_total > 0 AND _items_custom = 0 THEN
      -- All ready stock → skip Production, send to Warehouse
      _target_stage := 5;
      PERFORM public.set_quotation_stage(NEW.id, _target_stage, 'warehouse'::app_role,
        'Ready stock — send to warehouse', _label);
    ELSE
      _target_stage := 4;
      PERFORM public.set_quotation_stage(NEW.id, _target_stage, 'staff'::app_role,
        'Finalized: assign work order', _label);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Admin/Office override: push a quotation forward without requiring advance.
CREATE OR REPLACE FUNCTION public.override_advance_quotation(
  _quotation_id uuid,
  _target_stage smallint  -- 4 = Production, 5 = Warehouse
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _label TEXT;
  _role app_role;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'staff'::app_role)) THEN
    RAISE EXCEPTION 'Only admin or office staff can override the workflow';
  END IF;

  IF _target_stage NOT IN (4, 5) THEN
    RAISE EXCEPTION 'Override target must be 4 (Production) or 5 (Warehouse)';
  END IF;

  SELECT party_name || ' — ' || COALESCE(party_place,'')
    INTO _label FROM public.quotations WHERE id = _quotation_id;

  -- Force-flip status to finalized first (so OPS dashboards see it leave),
  -- bypassing the auto-advance trigger's advance-amount check.
  UPDATE public.quotations
     SET status = CASE WHEN status = 'drafted' THEN 'finalized' ELSE status END,
         updated_at = now()
   WHERE id = _quotation_id
     AND status <> 'rejected';

  _role := CASE WHEN _target_stage = 5 THEN 'warehouse'::app_role ELSE 'staff'::app_role END;

  PERFORM public.set_quotation_stage(
    _quotation_id,
    _target_stage,
    _role,
    CASE WHEN _target_stage = 5 THEN 'Pushed to warehouse (override)'
         ELSE 'Pushed to production (override)' END,
    _label
  );
END;
$function$;

-- 3) Manual reject helper — usable by admin/office, no privilege escalation
--    (RLS already allows them to UPDATE status; this just gives the UI a
--    single, audited entry point).
CREATE OR REPLACE FUNCTION public.reject_quotation(_quotation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'staff'::app_role)) THEN
    RAISE EXCEPTION 'Only admin or office staff can reject a quotation';
  END IF;

  UPDATE public.quotations
     SET status = 'rejected', updated_at = now()
   WHERE id = _quotation_id;
END;
$function$;