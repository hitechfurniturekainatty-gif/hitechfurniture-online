
CREATE OR REPLACE FUNCTION public.quotations_initial_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _role app_role; _title TEXT; _body TEXT;
BEGIN
  _body := NEW.party_name || ' — ' || COALESCE(NEW.party_place, '');
  IF NEW.pipeline_stage = 2 THEN
    _role := 'measurement_staff'; _title := 'New measurement task';
  ELSIF NEW.pipeline_stage = 3 THEN
    _role := 'staff'; _title := 'New direct deal: needs pricing';
  ELSIF NEW.pipeline_stage = 1
        AND NEW.lead_type = 'lead'
        AND NEW.status = 'drafted' THEN
    _role := 'staff'; _title := 'New website enquiry: needs pricing';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.pipeline_notifications(quotation_id, stage, target_role, title, body)
  VALUES (NEW.id, NEW.pipeline_stage, _role, _title, _body);
  RETURN NEW;
END; $function$;

-- Backfill: notify for existing stage-1 drafted website leads with no prior notification.
INSERT INTO public.pipeline_notifications (quotation_id, stage, target_role, title, body)
SELECT q.id, q.pipeline_stage, 'staff'::app_role,
       'New website enquiry: needs pricing (backfill)',
       q.party_name || ' — ' || COALESCE(q.party_place, '')
FROM public.quotations q
WHERE q.deleted_at IS NULL
  AND q.status = 'drafted'
  AND q.pipeline_stage = 1
  AND q.lead_type = 'lead'
  AND NOT EXISTS (
    SELECT 1 FROM public.pipeline_notifications pn
    WHERE pn.quotation_id = q.id AND pn.stage = 1
  );
