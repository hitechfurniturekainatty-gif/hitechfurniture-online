
CREATE OR REPLACE FUNCTION public.trip_quotations_mark_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _label TEXT;
BEGIN
  IF NEW.delivered_at IS NOT NULL AND (OLD.delivered_at IS NULL) THEN
    -- Stamp all remaining items as delivered so existing completion logic stays consistent
    UPDATE public.quotation_items
       SET delivered_at = COALESCE(delivered_at, NEW.delivered_at)
     WHERE quotation_id = NEW.quotation_id
       AND delivered_at IS NULL;

    -- Move quotation to Delivered status + final pipeline stage (7 = Complete)
    UPDATE public.quotations
       SET status = 'delivered',
           pipeline_stage = GREATEST(COALESCE(pipeline_stage, 0)::int, 7)::smallint,
           updated_at = now()
     WHERE id = NEW.quotation_id
       AND status IS DISTINCT FROM 'delivered';

    -- Notify office/admin
    SELECT party_name || ' — ' || COALESCE(party_place,'')
      INTO _label FROM public.quotations WHERE id = NEW.quotation_id;
    INSERT INTO public.pipeline_notifications(quotation_id, stage, target_role, title, body)
    VALUES (NEW.quotation_id, 7, 'staff', 'Order delivered', _label);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trip_quotations_mark_delivered ON public.trip_quotations;
CREATE TRIGGER trg_trip_quotations_mark_delivered
AFTER UPDATE OF delivered_at ON public.trip_quotations
FOR EACH ROW EXECUTE FUNCTION public.trip_quotations_mark_delivered();
