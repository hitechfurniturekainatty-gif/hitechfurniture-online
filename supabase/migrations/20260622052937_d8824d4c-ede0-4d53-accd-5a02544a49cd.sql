
-- 3a. Widen warehouse SELECT on items: stages 4 + 5 only.
DROP POLICY IF EXISTS items_select_warehouse ON public.quotation_items;

CREATE POLICY items_select_warehouse
ON public.quotation_items
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'warehouse'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.quotations q
     WHERE q.id = quotation_items.quotation_id
       AND q.deleted_at IS NULL
       AND q.pipeline_stage IN (4, 5)
  )
);

-- 3b. jobs_autoadvance: route the "all jobs complete → warehouse" notification
--     to the warehouse role (was 'staff'). Dispatch path keeps 'delivery'.
CREATE OR REPLACE FUNCTION public.jobs_autoadvance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _qid UUID;
  _total INT; _completed INT; _dispatched INT;
  _label TEXT;
BEGIN
  _qid := COALESCE(NEW.quotation_id, OLD.quotation_id);
  IF _qid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT party_name || ' — ' || COALESCE(party_place,'')
    INTO _label FROM public.quotations WHERE id = _qid;

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

  IF _dispatched > 0 THEN
    PERFORM public.set_quotation_stage(_qid, 6::SMALLINT, 'delivery'::app_role,
      'Ready for dispatch', _label);
  ELSIF _total > 0 AND _completed = _total THEN
    PERFORM public.set_quotation_stage(_qid, 5::SMALLINT, 'warehouse'::app_role,
      'Production complete — at warehouse', _label);
  END IF;

  RETURN COALESCE(NEW, OLD);
END; $function$;
